const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const dist = path.join(__dirname, '..', 'dist', 'index.html');
if (!fs.existsSync(dist)) {
  console.error('Falta dist/index.html. Execute npm run build antes de test:gui.');
  process.exit(1);
}

const { ffmpegPath, ffprobePath, assertPixelCutBinaries } = require('../electron/ffmpeg.cjs');
const bins = assertPixelCutBinaries();
console.log(`test-gui: PixelCut n6.1.1 ffmpeg=${bins.ffmpegSha} ffprobe=${bins.ffprobeSha}`);
const electronBin = require('electron');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixelcut-gui-'));
const userData = path.join(root, 'userData');
const media = path.join(root, 'media');
fs.mkdirSync(userData, { recursive: true });
fs.mkdirSync(media, { recursive: true });

function ffmpegRun(args) {
  const result = spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.error);
}

ffmpegRun([
  '-f', 'lavfi', '-i', 'color=c=0x2244aa:s=1280x720:r=30:d=4',
  '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4',
  '-shortest', path.join(media, 'clip.mp4'),
]);
ffmpegRun([
  '-f', 'lavfi', '-i', 'color=c=0x00ff00:s=640x360:r=30:d=2',
  '-vf', 'drawbox=x=200:y=80:w=240:h=200:color=0x3366ff:t=fill',
  path.join(media, 'green.mp4'),
]);
ffmpegRun(['-f', 'lavfi', '-i', 'color=c=0xff6644:s=320x180', '-frames:v', '1', path.join(media, 'overlay.png')]);
ffmpegRun(['-f', 'lavfi', '-i', 'sine=frequency=220:duration=3', path.join(media, 'music.wav')]);

const exportFile = path.join(root, 'gui-export.mp4');
const mediaList = [
  path.join(media, 'clip.mp4'),
  path.join(media, 'green.mp4'),
  path.join(media, 'overlay.png'),
  path.join(media, 'music.wav'),
].join('|');

const child = spawn(electronBin, ['.'], {
  cwd: path.join(__dirname, '..'),
  env: {
    ...process.env,
    PIXELCUT_USER_DATA: userData,
    FVE_GUI_FLOW: root,
    FVE_GUI_MEDIA: mediaList,
    FVE_GUI_EXPORT: exportFile,
    ELECTRON_ENABLE_LOGGING: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
const onData = (chunk) => {
  const text = chunk.toString();
  output += text;
  process.stdout.write(text);
};
child.stdout.on('data', onData);
child.stderr.on('data', onData);

const timer = setTimeout(() => {
  child.kill();
  console.error('test-gui-flow: timeout');
  process.exit(1);
}, 190000);

child.on('exit', (code) => {
  clearTimeout(timer);
  fs.writeFileSync(path.join(root, 'electron.log'), output, 'utf8');
  if (code !== 0 || !/GUI FLOW OK/.test(output)) {
    console.error(`test-gui-flow: exit ${code}`);
    console.error(`artifacts: ${root}`);
    process.exit(code || 1);
  }
  if (!fs.existsSync(exportFile) || fs.statSync(exportFile).size < 2000) {
    console.error('export mp4 missing after GUI flow');
    process.exit(1);
  }
  const probed = spawnSync(ffprobePath, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height', '-of', 'json', exportFile], { encoding: 'utf8' });
  if (probed.status !== 0) {
    console.error(probed.stderr);
    process.exit(1);
  }
  const info = JSON.parse(probed.stdout);
  const duration = Number(info.format?.duration || 0);
  const hasVideo = (info.streams || []).some((stream) => stream.codec_type === 'video');
  const hasAudio = (info.streams || []).some((stream) => stream.codec_type === 'audio');
  if (!hasVideo || duration < 1) {
    console.error('ffprobe export inválido', probed.stdout);
    process.exit(1);
  }
  console.log(`GUI FLOW PROBE OK duration=${duration.toFixed(2)}s video=${hasVideo} audio=${hasAudio} file=${exportFile}`);
  console.log(`GUI artifacts: ${root}`);
  process.exit(0);
});

// Real FFmpeg exports that must match the editor timeline duration (projectDuration).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { ffmpegPath, ffprobePath, probe, runExport, buildExportArgs, assertPixelCutBinaries } = require('../electron/ffmpeg.cjs');
const { projectDuration, exportDuration } = require('../shared/timeline-duration.cjs');

const near = (a, b, eps = 0.2) => Math.abs(Number(a) - Number(b)) <= eps;

function gen(args) {
  execFileSync(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', ...args]);
}

function rgbAt(file, ss, x, y, dir) {
  const raw = path.join(dir, `px-${path.basename(file)}-${ss}-${x}-${y}.rgb`);
  gen(['-ss', String(ss), '-i', file, '-frames:v', '1', '-vf', `crop=1:1:${x}:${y},format=rgb24`, '-f', 'rawvideo', raw]);
  return [...fs.readFileSync(raw).subarray(0, 3)];
}

function isBlue(rgb) {
  return rgb[2] > 140 && rgb[2] > rgb[0] + 40 && rgb[2] > rgb[1] + 40;
}
function isRed(rgb) {
  return rgb[0] > 140 && rgb[0] > rgb[1] + 40 && rgb[0] > rgb[2] + 40;
}
function isBlack(rgb) {
  return rgb[0] < 40 && rgb[1] < 40 && rgb[2] < 40;
}
function isWhiteish(rgb) {
  return rgb[0] > 180 && rgb[1] > 180 && rgb[2] > 180;
}
function isGreen(rgb) {
  return rgb[1] > 140 && rgb[1] > rgb[0] + 40 && rgb[1] > rgb[2] + 40;
}

function wavPeakDb(mediaFile, fromSec, toSec, dir, sr = 48000) {
  const wav = path.join(dir, `${path.basename(mediaFile, path.extname(mediaFile))}-${fromSec}-${toSec}.wav`);
  gen(['-i', mediaFile, '-ac', '1', '-ar', String(sr), wav]);
  const buf = fs.readFileSync(wav);
  const dataAt = buf.indexOf('data') + 8;
  const from = Math.max(0, Math.floor(fromSec * sr));
  const to = Math.max(from + 1, Math.floor(toSec * sr));
  let peak = 0;
  for (let i = from; i < to; i += 1) {
    const offset = dataAt + i * 2;
    if (offset + 1 >= buf.length) break;
    peak = Math.max(peak, Math.abs(buf.readInt16LE(offset) / 32768));
  }
  return 20 * Math.log10(peak + 1e-12);
}

function codecsOf(file) {
  const info = JSON.parse(execFileSync(ffprobePath, ['-v', 'error', '-print_format', 'json', '-show_streams', file], { encoding: 'utf8' }));
  const v = (info.streams || []).find((s) => s.codec_type === 'video');
  const a = (info.streams || []).find((s) => s.codec_type === 'audio');
  return { video: v && v.codec_name, audio: a && a.codec_name };
}

function expectMedia(file, info, { duration, width = 1280, height = 720 }) {
  if (!near(info.duration, duration, 0.25)) {
    throw new Error(`duration ${info.duration} expected ~${duration}`);
  }
  if (info.width !== width || info.height !== height) {
    throw new Error(`size ${info.width}x${info.height} expected ${width}x${height}`);
  }
  if (info.hasVideo !== true || info.hasAudio !== true) {
    throw new Error(`streams video=${info.hasVideo} audio=${info.hasAudio}`);
  }
  const codecs = codecsOf(file);
  if (codecs.video !== 'h264' || codecs.audio !== 'aac') {
    throw new Error(`codecs ${codecs.video}/${codecs.audio} expected h264/aac`);
  }
}

(async () => {
  const bins = assertPixelCutBinaries();
  console.log(`test-export-duration: PixelCut n6.1.1 ffmpeg=${bins.ffmpegSha} ffprobe=${bins.ffprobeSha}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-dur-'));
  const red = path.join(dir, 'red-3s.mp4');
  const yellow = path.join(dir, 'yellow-2s.mp4');
  const magenta = path.join(dir, 'magenta-2s.mp4');
  const blueJpg = path.join(dir, 'blue.jpg');
  const tone6 = path.join(dir, 'tone-6s.wav');
  const keyed = path.join(dir, 'keyed.mp4');

  gen(['-f', 'lavfi', '-i', 'color=c=red:s=1280x720:r=30:d=3', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', red]);
  gen(['-f', 'lavfi', '-i', 'color=c=yellow:s=1280x720:r=30:d=2', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=2', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', yellow]);
  gen(['-f', 'lavfi', '-i', 'color=c=0xff00ff:s=1280x720:r=30:d=2', '-f', 'lavfi', '-i', 'sine=frequency=550:duration=2', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', magenta]);
  gen(['-f', 'lavfi', '-i', 'color=c=blue:s=320x240:d=1', '-frames:v', '1', '-update', '1', blueJpg]);
  gen(['-f', 'lavfi', '-i', 'sine=frequency=660:duration=6', '-ar', '44100', '-ac', '1', tone6]);
  const keyedSilent = path.join(dir, 'keyed-silent.mp4');
  gen([
    '-f', 'lavfi', '-i', 'color=c=0x00ff00:s=1280x720:r=30:d=3',
    '-vf', 'drawbox=x=0:y=0:w=80:h=720:color=red:t=fill,drawbox=x=520:y=200:w=240:h=320:color=0x3366ff:t=fill',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', keyedSilent,
  ]);
  gen(['-i', keyedSilent, '-f', 'lavfi', '-i', 'sine=frequency=220:duration=3', '-shortest', '-c:v', 'copy', '-c:a', 'aac', keyed]);

  const media = (id, file, extra) => ({ id, path: file, name: path.basename(file), ...extra });
  const base = (extra = {}) => ({
    width: 1280, height: 720, fps: 30,
    media: [
      media('mv', red, { type: 'video', duration: 3, hasVideo: true, hasAudio: true, width: 1280, height: 720 }),
      media('mi', blueJpg, { type: 'image', duration: 5, hasVideo: true, hasAudio: false, width: 320, height: 240 }),
      media('ma', tone6, { type: 'audio', duration: 6, hasVideo: false, hasAudio: true, width: 0, height: 0 }),
      media('c1', yellow, { type: 'video', duration: 2, hasVideo: true, hasAudio: true, width: 1280, height: 720 }),
      media('c2', magenta, { type: 'video', duration: 2, hasVideo: true, hasAudio: true, width: 1280, height: 720 }),
      media('mk', keyed, { type: 'video', duration: 3, hasVideo: true, hasAudio: true, width: 1280, height: 720 }),
    ],
    videoClips: [{ id: 'v1', mediaId: 'mv', in: 0, out: 3, volume: 1, muted: false, linkedAudio: true, speed: 1 }],
    overlayClips: [], textClips: [], audioClips: [],
    ...extra,
  });

  const run = async (name, project) => {
    const out = path.join(dir, `${name}.mp4`);
    const built = buildExportArgs(project, out, dir);
    if (built.args.includes('tpad=')) throw new Error(`${name}: graph used tpad`);
    const t = built.args.indexOf('-t');
    if (!near(Number(built.args[t + 1]), built.total, 0.001)) throw new Error(`${name}: -t ${built.args[t + 1]} != total ${built.total}`);
    await runExport(project, out, () => {}).promise;
    const info = await probe(out);
    return { out, info, total: built.total, graph: built.args[built.args.indexOf('-filter_complex') + 1] };
  };

  // 1. Video 3s only
  const videoOnly = await run('video-only', base());
  if (!near(projectDuration(base()), 3) || !near(exportDuration(base()), 3)) throw new Error('video-only duration helpers');
  expectMedia(videoOnly.out, videoOnly.info, { duration: 3 });
  if (!isRed(rgbAt(videoOnly.out, 1.5, 640, 360, dir))) throw new Error('video-only frame is not red');
  if (videoOnly.graph.includes('[vcanvas]')) throw new Error('video-only should not extend onto a canvas');

  // 2. Video 3s + overlay image 5s
  const overlayProject = base({
    overlayClips: [{ id: 'o1', mediaId: 'mi', start: 0, in: 0, out: 5, x: 0.5, y: 0.5, scale: 1, opacity: 1, speed: 1 }],
  });
  const overlay = await run('overlay-5s', overlayProject);
  if (!near(projectDuration(overlayProject), 5) || !near(exportDuration(overlayProject), 3)) throw new Error('overlay helper mismatch');
  expectMedia(overlay.out, overlay.info, { duration: 5 });
  const overlayTailCenter = rgbAt(overlay.out, 4.0, 640, 360, dir);
  const overlayTailCorner = rgbAt(overlay.out, 4.0, 20, 20, dir);
  if (!isBlue(overlayTailCenter)) throw new Error(`overlay missing at 4s center (${overlayTailCenter.join(',')})`);
  if (!isBlack(overlayTailCorner)) throw new Error(`V1 freeze at 4s corner (${overlayTailCorner.join(',')})`);
  if (!overlay.graph.includes('eof_action=pass') || overlay.graph.includes('tpad=')) throw new Error('overlay tail must use black canvas, not tpad');

  // 3. Video 3s + text 5s
  const textProject = base({
    textClips: [{ id: 't1', text: 'PIXELCUT', start: 0, duration: 5, x: 0.5, y: 0.5, size: 96, color: '#ffffff', letterEffect: 'none', font: 'arial', bold: true }],
  });
  const text = await run('text-5s', textProject);
  expectMedia(text.out, text.info, { duration: 5 });
  const textSamples = [[640, 360], [600, 360], [680, 360], [640, 340], [560, 360], [720, 360]]
    .map(([x, y]) => rgbAt(text.out, 4.0, x, y, dir));
  if (!textSamples.some((rgb) => isWhiteish(rgb))) {
    throw new Error(`text missing at 4s (${textSamples.map((rgb) => rgb.join(',')).join(' | ')})`);
  }
  if (!isBlack(rgbAt(text.out, 4.0, 20, 20, dir))) throw new Error('text tail corner is not black');
  if (!isRed(rgbAt(text.out, 1.2, 20, 20, dir))) throw new Error('text export lost V1');

  // 4. Video 3s + extra audio 6s
  const audioProject = base({
    audioClips: [{ id: 'a1', mediaId: 'ma', start: 0, in: 0, out: 6, volume: 1, speed: 1 }],
  });
  const audio = await run('audio-6s', audioProject);
  expectMedia(audio.out, audio.info, { duration: 6 });
  if (!audio.graph.includes('duration=longest')) throw new Error('audio mix must use duration=longest');
  const tailDb = wavPeakDb(audio.out, 4.5, 5.8, dir);
  const earlyDb = wavPeakDb(audio.out, 0.4, 1.2, dir);
  if (tailDb < -28) throw new Error(`audio tail is silent (${tailDb.toFixed(1)} dB)`);
  if (earlyDb < -28) throw new Error(`audio start is silent (${earlyDb.toFixed(1)} dB)`);

  // 5. Overlay inside the 3s video
  const insideProject = base({
    overlayClips: [{ id: 'o1', mediaId: 'mi', start: 1, in: 0, out: 2, x: 0.5, y: 0.5, scale: 1, opacity: 1, speed: 1 }],
  });
  const inside = await run('overlay-inside', insideProject);
  expectMedia(inside.out, inside.info, { duration: 3 });
  if (inside.graph.includes('[vcanvas]')) throw new Error('in-range overlay should not extend V1');
  if (!isRed(rgbAt(inside.out, 2.6, 20, 20, dir))) throw new Error('in-range overlay lost the V1 tail');

  // 6. Transitions: 2s + 2s with 0.5s dissolve => 3.5s, not 4s
  const xfadeProject = base({
    videoClips: [
      { id: 'va', mediaId: 'c1', in: 0, out: 2, volume: 1, muted: false, linkedAudio: true, speed: 1 },
      { id: 'vb', mediaId: 'c2', in: 0, out: 2, volume: 1, muted: false, linkedAudio: true, speed: 1, transitionIn: { type: 'dissolve', duration: 0.5 } },
    ],
  });
  if (!near(projectDuration(xfadeProject), 3.5, 0.05)) throw new Error(`xfade timeline ${projectDuration(xfadeProject)}`);
  const xfade = await run('xfade', xfadeProject);
  expectMedia(xfade.out, xfade.info, { duration: 3.5 });
  if (near(xfade.info.duration, 4, 0.15)) throw new Error('xfade summed clip lengths instead of overlapping');
  const first = rgbAt(xfade.out, 0.4, 640, 360, dir);
  const last = rgbAt(xfade.out, 3.2, 640, 360, dir);
  if (!(first[0] > 140 && first[1] > 140 && first[2] < 80)) throw new Error(`xfade start is not yellow (${first.join(',')})`);
  if (!(last[0] > 140 && last[2] > 140 && last[1] < 80)) throw new Error(`xfade end is not magenta (${last.join(',')})`);

  // 7. Chroma key still keys, and a 5s overlay still extends the file
  const chromaProject = base({
    videoClips: [{ id: 'vk', mediaId: 'mk', in: 0, out: 3, volume: 1, muted: false, linkedAudio: true, speed: 1, chroma: { enabled: true, color: '#00ff00', similarity: 0.4 } }],
    overlayClips: [{ id: 'o1', mediaId: 'mi', start: 0, in: 0, out: 5, x: 0.5, y: 0.5, scale: 1, opacity: 1, speed: 1 }],
  });
  const chroma = await run('chroma-overlay', chromaProject);
  expectMedia(chroma.out, chroma.info, { duration: 5 });
  if (!chroma.graph.includes('chromakey=')) throw new Error('chroma path lost chromakey');
  const chromaEdge = rgbAt(chroma.out, 0.4, 20, 360, dir);
  const chromaKeyed = rgbAt(chroma.out, 0.4, 200, 360, dir);
  if (!isRed(chromaEdge)) throw new Error(`chroma edge should stay red (${chromaEdge.join(',')})`);
  if (isGreen(chromaKeyed)) throw new Error(`chroma did not key green (${chromaKeyed.join(',')})`);
  if (!isBlack(chromaKeyed)) throw new Error(`keyed green should reveal the black canvas (${chromaKeyed.join(',')})`);
  const chromaTail = rgbAt(chroma.out, 4.0, 640, 360, dir);
  const chromaCorner = rgbAt(chroma.out, 4.0, 20, 20, dir);
  if (!isBlue(chromaTail)) throw new Error(`chroma overlay missing in the tail (${chromaTail.join(',')})`);
  if (!isBlack(chromaCorner)) throw new Error(`chroma tail froze V1 (${chromaCorner.join(',')})`);

  console.log('EXPORT DURATION OK');
  console.log(JSON.stringify({
    videoOnly: videoOnly.info.duration,
    overlay: overlay.info.duration,
    text: text.info.duration,
    audio: audio.info.duration,
    inside: inside.info.duration,
    xfade: xfade.info.duration,
    chroma: chroma.info.duration,
    overlayTail: overlayTailCenter,
    audioTailDb: Number(tailDb.toFixed(1)),
  }));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

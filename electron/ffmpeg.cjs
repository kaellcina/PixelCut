// Builds FFmpeg arguments for exporting a project to MP4.
// Pure module (no Electron imports) so it can be tested from plain Node.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');

const AUDIO_FX = require('../shared/audio-effects.json');
const TEXT_GLOW = require('../shared/text-glow.json');
const {
  clipLength,
  clipSpeed,
  transitionOverlap,
  videoLayout,
  projectDuration,
} = require('../shared/timeline-duration.cjs');

const EXPECTED_FFMPEG_SHA256 = '050577AFFE30A13282A5145E9FD8220D3A3940CAE4E81E61987B340CD3C2D291';
const EXPECTED_FFPROBE_SHA256 = '0BB9D300815A59AA26B7F8494D5A4BE84F6803FCBC069486FADF63A62AE8668E';
const GYAN_FFMPEG_SHA256 = '04E1307997530F9CF2FE35CBA2CA7E8875CA91DA02F89D6C7243DF819C94AD00';
const GYAN_FFPROBE_SHA256 = '3A7E2DC003DC2CD1472827E4C7C4F056AE1AE0AE7C5BBC580C99B49827351BA4';

function bundledExeName(file) {
  return process.platform === 'win32' ? file : file.replace(/\.exe$/i, '');
}

function resolveBundledExe(file) {
  const packed = path.join(__dirname, '..', 'third-party', 'ffmpeg', bundledExeName(file));
  const unpacked = packed.replace('app.asar', 'app.asar.unpacked');
  if (fs.existsSync(unpacked)) return unpacked;
  throw new Error(`Bundled ${file} missing (${unpacked})`);
}

function resolveFfmpegPath() {
  if (process.env.PIXELCUT_FFMPEG && fs.existsSync(process.env.PIXELCUT_FFMPEG)) {
    return process.env.PIXELCUT_FFMPEG;
  }
  if (process.env.PIXELCUT_FFMPEG_DIR) {
    const named = path.join(process.env.PIXELCUT_FFMPEG_DIR, bundledExeName('ffmpeg.exe'));
    if (fs.existsSync(named)) return named;
  }
  return resolveBundledExe('ffmpeg.exe');
}

function resolveBundledFfprobe() {
  if (process.env.PIXELCUT_FFPROBE && fs.existsSync(process.env.PIXELCUT_FFPROBE)) {
    return process.env.PIXELCUT_FFPROBE;
  }
  if (process.env.PIXELCUT_FFMPEG_DIR) {
    const named = path.join(process.env.PIXELCUT_FFMPEG_DIR, bundledExeName('ffprobe.exe'));
    if (fs.existsSync(named)) return named;
  }
  return resolveBundledExe('ffprobe.exe');
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
}

function assertPixelCutBinaries() {
  const ffmpegPathValue = ffmpegPath;
  const ffprobePathValue = ffprobePath;
  const joined = `${ffmpegPathValue}\n${ffprobePathValue}`;
  if (/ffmpeg-static|gyan-6\.1\.1-rollback|essentials_build|gyan\.dev/i.test(joined)) {
    throw new Error(`caminho Gyan/ffmpeg-static recusado:\n${joined}`);
  }
  const ffmpegSha = sha256File(ffmpegPathValue);
  const ffprobeSha = sha256File(ffprobePathValue);
  if (ffmpegSha === GYAN_FFMPEG_SHA256 || ffprobeSha === GYAN_FFPROBE_SHA256) {
    throw new Error(`hash Gyan recusado ffmpeg=${ffmpegSha} ffprobe=${ffprobeSha}`);
  }
  if (process.env.PIXELCUT_SKIP_FFPROBE_SHA !== '1') {
    if (ffmpegSha !== EXPECTED_FFMPEG_SHA256) {
      throw new Error(`ffmpeg SHA-256 ${ffmpegSha} != ${EXPECTED_FFMPEG_SHA256} (${ffmpegPathValue})`);
    }
    if (ffprobeSha !== EXPECTED_FFPROBE_SHA256) {
      throw new Error(`ffprobe SHA-256 ${ffprobeSha} != ${EXPECTED_FFPROBE_SHA256} (${ffprobePathValue})`);
    }
  }
  const version = execFileSync(ffmpegPathValue, ['-version'], { encoding: 'utf8', windowsHide: true });
  if (/gyan\.dev|essentials_build/i.test(version)) {
    throw new Error(`ffmpeg -version ainda identifica Gyan:\n${version.slice(0, 400)}`);
  }
  if (!/--enable-gpl/.test(version) || /--enable-version3/.test(version) || !/--enable-libx264/.test(version) || !/--enable-libharfbuzz/.test(version)) {
    throw new Error(`ffmpeg -version sem a configuração PixelCut:\n${version.slice(0, 800)}`);
  }
  return { ffmpegPath: ffmpegPathValue, ffprobePath: ffprobePathValue, ffmpegSha, ffprobeSha };
}

const ffmpegPath = resolveFfmpegPath();
const ffprobePath = resolveBundledFfprobe();

const DEFAULT_FONT = 'C:/Windows/Fonts/arial.ttf';
const FONT_DIR = 'C:/Windows/Fonts';
const FONT_FILES = {
  montserrat: ['arialbd.ttf', 'arial.ttf'],
  poppins: ['arialbd.ttf', 'arial.ttf'],
  oswald: ['arialbd.ttf', 'impact.ttf'],
  anton: ['impact.ttf', 'arialbd.ttf'],
  bebas: ['impact.ttf', 'arialbd.ttf'],
  roboto: ['arial.ttf'],
  playfair: ['georgia.ttf', 'times.ttf'],
  pacifico: ['segoesc.ttf', 'Inkfree.ttf'],
  dancing: ['segoesc.ttf', 'Inkfree.ttf'],
  comfortaa: ['calibri.ttf', 'arial.ttf'],
  arial: ['arial.ttf'],
  impact: ['impact.ttf'],
  georgia: ['georgia.ttf'],
  times: ['times.ttf'],
  comic: ['comic.ttf'],
  courier: ['cour.ttf'],
  verdana: ['verdana.ttf'],
  trebuchet: ['trebuc.ttf'],
  segoe: ['segoeui.ttf', 'arial.ttf'],
  script: ['segoesc.ttf', 'Inkfree.ttf'],
  ink: ['Inkfree.ttf', 'segoesc.ttf'],
  consolas: ['consola.ttf', 'cour.ttf'],
  calibri: ['calibri.ttf', 'arial.ttf'],
  gabriola: ['Gabriola.ttf', 'georgia.ttf'],
};
const XFADE = {
  dissolve: 'fade', fadeblack: 'fadeblack', fadewhite: 'fadewhite',
  slideleft: 'slideleft', slideright: 'slideright', slideup: 'slideup', slidedown: 'slidedown',
  wipeleft: 'wipeleft', wiperight: 'wiperight', circle: 'circleopen', zoom: 'zoomin',
  radial: 'radial', pixelize: 'pixelize', hblur: 'hblur', distance: 'distance',
  smoothleft: 'smoothleft', vertopen: 'vertopen', horzopen: 'horzopen',
  wipeup: 'wipeup', wipedown: 'wipedown', circleclose: 'circleclose',
  diagtl: 'diagtl', squeezeh: 'squeezeh', fadegrays: 'fadegrays',
};

function resolveFont(id, bold) {
  if (id && (id.includes('/') || id.includes('\\') || id.endsWith('.ttf'))) return fs.existsSync(id) ? id : DEFAULT_FONT;
  const names = [...(FONT_FILES[id] || ['arial.ttf'])];
  if (bold && (!id || id === 'arial')) names.unshift('arialbd.ttf');
  for (const name of names) {
    const full = path.join(FONT_DIR, name);
    if (fs.existsSync(full)) return full;
  }
  return DEFAULT_FONT;
}

function videoEffectChain(clip) {
  const parts = [];
  const params = clip.effectParams || {};
  const effects = clip.effects || [];
  const blur = (params.blur || 0) + (effects.includes('blur') ? 4 : 0);
  if (blur > 0) parts.push(`gblur=sigma=${Math.max(0.2, blur / 2).toFixed(2)}`);
  const brightness = params.brightness || 0;
  const contrast = 1 + (params.contrast || 0);
  const saturation = 1 + (params.saturation || 0);
  if (brightness || contrast !== 1 || saturation !== 1) {
    parts.push(`eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}`);
  }
  if (effects.includes('bw') || effects.includes('noir')) parts.push('hue=s=0');
  if (effects.includes('sepia') || effects.includes('vintage') || effects.includes('warm')) {
    parts.push('colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131');
  }
  if (effects.includes('invert')) parts.push('negate');
  if (effects.includes('mirror')) parts.push('hflip');
  if (effects.includes('vignette') || effects.includes('vintage') || effects.includes('cinematic') || effects.includes('noir')) {
    parts.push('vignette=angle=PI/4');
  }
  if (effects.includes('grain')) parts.push('noise=alls=12:allf=t+u');
  if (effects.includes('vivid')) parts.push('eq=saturation=1.45:contrast=1.1');
  if (effects.includes('cold')) parts.push('hue=h=-14,eq=saturation=0.92:brightness=0.03');
  if (effects.includes('glow') || effects.includes('dream')) parts.push('eq=brightness=0.06:contrast=1.05');
  if (effects.includes('sunset')) parts.push('colortemperature=temperature=4200:mix=0.4');
  if (effects.includes('night')) parts.push('eq=brightness=-0.16:saturation=0.65:contrast=1.08,hue=h=-20');
  if (effects.includes('teal')) parts.push('eq=contrast=1.12:saturation=1.2');
  if (effects.includes('bleach')) parts.push('eq=contrast=1.3:saturation=0.55');
  if (effects.includes('cartoon')) parts.push('eq=contrast=1.35:saturation=1.4');
  return parts.length ? ',' + parts.join(',') : '';
}

function chromaChain(clip) {
  if (!clip || !clip.chroma || !clip.chroma.enabled) return '';
  const color = String(clip.chroma.color || '#00ff00').replace('#', '0x');
  const sim = Number(clip.chroma.similarity);
  return `,chromakey=${color}:${Number.isFinite(sim) ? sim.toFixed(2) : '0.32'}:0.08`;
}

// Same smoothstep as src/motion.js. Scale expressions use t and sit inside single quotes.
function heldSmooth(origin, dur) {
  const u = `max(0,min(1,(t-${num(origin)})/${num(dur)}))`;
  return `(${u})*(${u})*(3-2*(${u}))`;
}

// geq names the frame time T, not t. Verified on the bundled FFmpeg 6.1.1.
function geqSmooth(origin, dur) {
  const u = `max(0,min(1,(T-${num(origin)})/${num(dur)}))`;
  return `${u}*${u}*(3-2*${u})`;
}

function zoompanChain(clip, fps, width, height) {
  const zoom = clip && clip.zoom;
  if (!zoom || !zoom.preset || zoom.preset === 'none') return '';
  const from = Math.max(1, Number(zoom.from) || 1);
  const to = Math.max(1, Number(zoom.to) || from);
  const dur = Math.min(5, Math.max(0.05, Number(zoom.duration) || 1), clipLength(clip));
  const frames = Math.max(1, dur * fps);
  const u = `min(1,on/${num(frames)})`;
  const s = `(${u})*(${u})*(3-2*(${u}))`;
  const z = `${num(from)}+(${num(to)}-${num(from)})*(${s})`;
  return `,zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${width}x${height}:fps=${fps}`;
}

function overlayAnim(clip, scaleW) {
  const start = clip.start || 0;
  const length = clipLength(clip);
  const opacity = clip.opacity == null ? 1 : Number(clip.opacity);
  const enter = clip.enter || {};
  const type = enter.type || 'none';
  const zoom = clip.zoom;
  const hasZoom = !!(zoom && zoom.preset && zoom.preset !== 'none');
  const hasEnter = type === 'fade' || type === 'scale' || type === 'both';
  if (!hasZoom && !hasEnter && opacity >= 0.999) return { scale: '', alpha: '' };
  let factor = '1';
  if (type === 'scale' || type === 'both') {
    const from = Math.min(1, Math.max(0.05, Number(enter.scale) || 0.85));
    const dur = Math.min(5, Math.max(0.05, Number(enter.duration) || 0.6), length);
    factor = `(${num(from)}+(${num(1 - from)})*(${heldSmooth(start, dur)}))`;
  }
  if (hasZoom) {
    const from = Math.max(1, Number(zoom.from) || 1);
    const to = Math.max(1, Number(zoom.to) || from);
    const dur = Math.min(5, Math.max(0.05, Number(zoom.duration) || 1), length);
    factor += `*(${num(from)}+(${num(to - from)})*(${heldSmooth(start, dur)}))`;
  }
  const base = Number.isFinite(opacity) ? opacity : 1;
  let alpha = '';
  if (type === 'fade' || type === 'both') {
    const dur = Math.min(5, Math.max(0.05, Number(enter.duration) || 0.6), length);
    // geq is the filter in this FFmpeg that accepts the same smoothstep as the preview.
    // colorchannelmixer and the linear fade filter do not. T is the frame time; the clamp holds the final opacity.
    alpha = `,format=yuva420p,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*${num(base)}*(${geqSmooth(start, dur)})'`;
  } else if (base < 0.999) {
    alpha = `,format=yuva420p,colorchannelmixer=aa=${num(base)}`;
  }
  return {
    scale: factor === '1' ? '' : `,scale=w='${num(scaleW)}*(${factor})':h=-1:eval=frame`,
    alpha,
  };
}

function atempoChain(speed) {
  let value = Number(speed);
  if (!Number.isFinite(value) || Math.abs(value - 1) < 0.02) return '';
  value = Math.max(0.25, Math.min(4, value));
  const parts = [];
  while (value > 2.0001) { parts.push('atempo=2.0'); value /= 2; }
  while (value < 0.5) { parts.push('atempo=0.5'); value /= 0.5; }
  parts.push(`atempo=${value.toFixed(3)}`);
  return parts.join(',');
}

// Same stage list the preview turns into a Web Audio graph (src/audioFx.js).
function audioStageFilter(stage) {
  const v = (n) => Number(Number(n).toFixed(4));
  switch (stage.type) {
    case 'highpass': return `highpass=f=${v(stage.f)}`;
    case 'lowpass': return `lowpass=f=${v(stage.f)}`;
    case 'peak': return `equalizer=f=${v(stage.f)}:t=q:w=${v(stage.q)}:g=${v(stage.g)}`;
    case 'lowshelf': return `lowshelf=f=${v(stage.f)}:g=${v(stage.g)}:t=s:w=1`;
    case 'highshelf': return `highshelf=f=${v(stage.f)}:g=${v(stage.g)}:t=s:w=1`;
    case 'gain': return `volume=${v(stage.g)}`;
    case 'drive': return `volume=${v(stage.k)},asoftclip=type=tanh,volume=${v(1 / Math.tanh(stage.k))}`;
    case 'crush': return `acrusher=bits=${v(stage.bits)}:mode=lin:mix=1:aa=0`;
    case 'ring': return `aeval=exprs='val(ch)*(${v(1 - stage.mix)}+${v(stage.mix)}*sin(2*PI*${v(stage.f)}*t))':c=same`;
    // FFmpeg's vibrato filter emits a full-scale click at stream start; a wet-only chorus is the same modulated delay.
    case 'vibrato': return `chorus=0:1:0.5:1:${v(stage.f)}:${v(stage.depth * 5)}`;
    case 'echo': return `aecho=${v(stage.in)}:${v(stage.out)}:${stage.delays.map(v).join('|')}:${stage.decays.map(v).join('|')}`;
    case 'chorus': return `chorus=${v(stage.in)}:${v(stage.out)}:${v(stage.delay)}:${v(stage.decay)}:${v(stage.speed)}:${v(stage.depth)}`;
    case 'pitch': return `rubberband=pitch=${v(stage.ratio)}`;
    case 'robotize': return `afftfilt=real='hypot(re,im)*cos(PI*b)':imag=0:win_size=${stage.size}:overlap=0.75`;
    default: return '';
  }
}

function audioEffectStages(ids) {
  const list = Array.isArray(ids) ? ids : [];
  return AUDIO_FX.filter((fx) => list.includes(fx.id)).flatMap((fx) => fx.stages);
}

// Input must already be resampled to 48 kHz. Speed is applied first so echoes and fades
// follow timeline time, exactly like the preview (playbackRate -> effects -> volume envelope).
function audioFxChain(clip, effectIds) {
  const parts = [];
  const speedValue = Number(clip && clip.speed) > 0.1 ? Number(clip.speed) : 1;
  const speed = atempoChain(speedValue);
  if (speed) parts.push(speed);
  audioEffectStages(effectIds).forEach((stage) => {
    const filter = audioStageFilter(stage);
    if (filter) parts.push(filter);
  });
  const fadeIn = Number(clip && clip.fadeIn) || 0;
  const fadeOut = Number(clip && clip.fadeOut) || 0;
  const dur = clip ? Math.max(0.05, (clip.out - clip.in) / speedValue) : 0;
  if (parts.length && dur) parts.push(`apad=whole_dur=${dur.toFixed(3)},atrim=end=${dur.toFixed(3)}`);
  if (fadeIn > 0) parts.push(`afade=t=in:st=0:d=${Math.min(fadeIn, dur).toFixed(3)}`);
  if (fadeOut > 0) parts.push(`afade=t=out:st=${Math.max(0, dur - fadeOut).toFixed(3)}:d=${Math.min(fadeOut, dur).toFixed(3)}`);
  return parts.length ? ',' + parts.join(',') : '';
}

function extractWaveform(file, bins = 720) {
  return new Promise((resolve) => {
    const args = ['-v', 'error', '-i', file, '-ac', '1', '-ar', '8000', '-map', '0:a:0', '-f', 's16le', '-acodec', 'pcm_s16le', 'pipe:1'];
    const proc = spawn(ffmpegPath, args, { windowsHide: true });
    const chunks = [];
    proc.stdout.on('data', (chunk) => chunks.push(chunk));
    proc.stderr.on('data', () => {});
    proc.on('error', () => resolve(null));
    proc.on('close', () => {
      const buffer = Buffer.concat(chunks);
      if (buffer.length < 4) return resolve(null);
      const samples = new Int16Array(buffer.buffer, buffer.byteOffset, Math.floor(buffer.length / 2));
      const block = Math.max(1, Math.floor(samples.length / bins));
      const peaks = [];
      for (let i = 0; i < bins; i += 1) {
        let max = 0;
        const start = i * block;
        for (let j = 0; j < block && start + j < samples.length; j += 1) {
          max = Math.max(max, Math.abs(samples[start + j]) / 32768);
        }
        peaks.push(Math.min(1, max));
      }
      resolve({ peaks, duration: samples.length / 8000 });
    });
  });
}

function textStyle(t, color) {
  const effect = t.letterEffect || 'outline';
  const width = Math.max(1, Number(t.strokeWidth) || 2);
  const stroke = String(t.strokeColor || '#000000').replace('#', '0x');
  if (effect === 'shadow' || effect === '3d') return 'shadowx=3:shadowy=3:shadowcolor=black:';
  if (TEXT_GLOW[effect]) return '';
  if (effect === 'thick' || effect === 'sticker' || effect === 'double') return `borderw=${Math.max(4, width + 2)}:bordercolor=${stroke}:`;
  if (effect === 'background') return 'box=1:boxborderw=12:boxcolor=black@0.72:';
  if (effect === 'none' || effect === 'spacious') return '';
  return `borderw=${width}:bordercolor=${stroke}:`;
}

function maskAlphaExpr(clips) {
  const parts = videoLayout(clips).filter((item) => {
    const mask = item.clip.subjectMask;
    return mask && mask.w > 0.015 && mask.h > 0.015;
  });
  if (!parts.length) return null;
  let expr = '0';
  parts.forEach((item) => {
    const mask = item.clip.subjectMask;
    const cx = (mask.x || 0) + (mask.w || 0) / 2;
    const cy = (mask.y || 0) + (mask.h || 0) / 2;
    const rx = Math.max(0.01, (mask.w || 0) / 2);
    const ry = Math.max(0.01, (mask.h || 0) / 2);
    const ellipse = `lte(pow((X-W*${num(cx)})/(W*${num(rx)}+1)\\,2)+pow((Y-H*${num(cy)})/(H*${num(ry)}+1)\\,2)\\,1)`;
    expr = `if(between(t\\,${num(item.start)}\\,${num(item.end)})\\,if(${ellipse}\\,255\\,0)\\,${expr})`;
  });
  return expr;
}

function textAlpha(t) {
  if (!t.animation || t.animation === 'none' || t.animation === 'typewriter') return '';
  const start = t.start || 0;
  const end = start + (t.duration || 0);
  const d = Math.min(t.animationDuration || 0.45, Math.max(0.08, (t.duration || 0.5) / 2));
  const expr = `if(lt(t\\,${num(start)}+${num(d)})\\,(t-${num(start)})/${num(d)}\\,if(gt(t\\,${num(end)}-${num(d)})\\,(${num(end)}-t)/${num(d)}\\,1))`;
  return `alpha='${expr}':`;
}

// Escape a path for use as a quoted filter option value: C:/x -> 'C\:/x'
function filterPath(p) {
  return "'" + p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "'\\''") + "'";
}

const num = (n) => Number(n).toFixed(3);

function mixWhite(hex, amount) {
  const value = String(hex || '#ffffff').replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value.padEnd(6, '0');
  return '#' + [0, 2, 4]
    .map((i) => parseInt(full.slice(i, i + 2), 16) || 0)
    .map((c) => Math.round(c + (255 - c) * amount).toString(16).padStart(2, '0'))
    .join('');
}

function probe(file) {
  return new Promise((resolve, reject) => {
    const args = ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file];
    const p = spawn(ffprobePath, args, { windowsHide: true });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(err || `ffprobe exited with ${code}`));
      const info = JSON.parse(out);
      const streams = info.streams || [];
      const v = streams.find((s) => s.codec_type === 'video' && !(s.disposition && s.disposition.attached_pic));
      const a = streams.find((s) => s.codec_type === 'audio');
      resolve({
        duration: parseFloat(info.format && info.format.duration) || 0,
        hasVideo: !!v,
        hasAudio: !!a,
        width: v ? v.width : 0,
        height: v ? v.height : 0,
      });
    });
  });
}

// project: { width, height, fps, media[], videoClips[], overlayClips[], textClips[], audioClips[] }
// Output length is projectDuration (max of V1, overlay, text, audio). After V1 the
// canvas is black, matching the editor stage. Android keeps using exportDuration.
function buildExportArgs(project, outFile, tmpDir) {
  const { width: W, height: H, fps } = project;
  const mediaById = Object.fromEntries(project.media.map((m) => [m.id, m]));
  const inputs = [];
  const filters = [];

  const clips = project.videoClips.filter((c) => mediaById[c.mediaId]);
  if (clips.length === 0) throw new Error('The video track is empty.');

  const anyChroma = clips.some((c) => c.chroma && c.chroma.enabled);
  const pix = anyChroma ? 'yuva420p' : 'yuv420p';

  clips.forEach((clip, i) => {
    const m = mediaById[clip.mediaId];
    const dur = clipLength(clip);
    inputs.push('-i', m.path);
    const speed = clipSpeed(clip);
    filters.push(
      `[${i}:v]trim=start=${num(clip.in)}:end=${num(clip.out)},setpts=PTS-STARTPTS,` +
        (Math.abs(speed - 1) > 0.02 ? `setpts=PTS/${speed.toFixed(3)},` : '') +
        `scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
        `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${fps}` +
        zoompanChain(clip, fps, W, H) +
        videoEffectChain(clip) + chromaChain(clip) +
        `,format=${pix}[v${i}]`
    );
    const vol = clip.volume ?? 1;
    if (m.hasAudio && !clip.muted) {
      filters.push(
        `[${i}:a]atrim=start=${num(clip.in)}:end=${num(clip.out)},asetpts=PTS-STARTPTS,volume=${vol},aresample=48000` +
          `${audioFxChain(clip, clip.audioEffects)},aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`
      );
    } else {
      filters.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${num(dur)},aformat=sample_fmts=fltp[a${i}]`);
    }
  });

  const hasXfade = clips.some((c, i) => i > 0 && transitionOverlap(clips[i - 1], c) > 0.05);
  let videoEnd = clips.reduce((s, c) => s + clipLength(c), 0);
  if (!hasXfade) {
    filters.push(clips.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${clips.length}:v=1:a=1[vcat][acat]`);
  } else {
    let vOut = 'v0';
    let aOut = 'a0';
    let offset = clipLength(clips[0]);
    for (let i = 1; i < clips.length; i += 1) {
      const overlap = Math.max(0.04, transitionOverlap(clips[i - 1], clips[i]));
      const fade = XFADE[(clips[i].transitionIn && clips[i].transitionIn.type) || 'dissolve'] || 'fade';
      filters.push(`[${vOut}][v${i}]xfade=transition=${fade}:duration=${num(overlap)}:offset=${num(offset - overlap)}[vx${i}]`);
      filters.push(`[${aOut}][a${i}]acrossfade=d=${num(overlap)}[ax${i}]`);
      vOut = `vx${i}`;
      aOut = `ax${i}`;
      offset += clipLength(clips[i]) - overlap;
    }
    filters.push(`[${vOut}]format=${pix}[vcat]`);
    filters.push(`[${aOut}]aformat=sample_fmts=fltp:channel_layouts=stereo[acat]`);
    videoEnd = offset;
  }

  // Same clock as the editor. Overlay/text/audio tails keep the file open; V1 alone
  // does not. After V1 the preview stage is black (#000), not a frozen last frame.
  const total = Math.max(videoEnd, projectDuration(project));
  const extendPastVideo = total > videoEnd + 0.02;

  let vLabel = 'vcat';
  if (extendPastVideo && !anyChroma) {
    filters.push(`color=c=black:s=${W}x${H}:d=${num(total)}:r=${fps},format=${pix}[vcanvas]`);
    filters.push(`[vcanvas][vcat]overlay=eof_action=pass:format=auto[vext]`);
    vLabel = 'vext';
  }
  let inputIndex = clips.length;
  const overlays = (project.overlayClips || []).filter((c) => mediaById[c.mediaId]);

  const appendOverlay = (clip, tag) => {
    const media = mediaById[clip.mediaId];
    const idx = inputIndex;
    inputIndex += 1;
    if (media.type === 'image') inputs.push('-loop', '1', '-t', num(total), '-i', media.path);
    else inputs.push('-i', media.path);
    const dur = clipLength(clip);
    const speed = clipSpeed(clip);
    const scaleW = Math.max(16, Math.round((clip.scale || 1) * W * 0.56));
    const anim = overlayAnim(clip, scaleW);
    let chain = `[${idx}:v]`;
    if (media.type !== 'image') {
      chain += `trim=start=${num(clip.in)}:end=${num(clip.out)},setpts=PTS-STARTPTS,`;
      if (Math.abs(speed - 1) > 0.02) chain += `setpts=PTS/${speed.toFixed(3)},`;
      chain += `setpts=PTS+${num(clip.start)}/TB,`;
    } else {
      chain += `setpts=PTS+${num(clip.start)}/TB,`;
    }
    chain += (anim.scale || `,scale=${scaleW}:-1`).replace(/^,/, '');
    chain += `${chromaChain(clip)}${videoEffectChain(clip)}${anim.alpha}`;
    if (clip.chroma && clip.chroma.enabled && !anim.alpha) chain += ',format=yuva420p';
    chain += `[${tag}]`;
    filters.push(chain);
    const next = `${tag}o`;
    const alpha = (clip.chroma && clip.chroma.enabled) || anim.alpha ? ':format=auto' : '';
    filters.push(
      `[${vLabel}][${tag}]overlay=x=W*${num(clip.x ?? 0.5)}-w/2:y=H*${num(clip.y ?? 0.5)}-h/2${alpha}:` +
        `enable='between(t,${num(clip.start)},${num(clip.start + dur)})'[${next}]`
    );
    vLabel = next;
  };

  const appendText = (t, i) => {
    const txtFile = path.join(tmpDir, `text_${i}.txt`);
    fs.writeFileSync(txtFile, t.text, 'utf8');
    const base = t.color || '#ffffff';
    const glow = TEXT_GLOW[t.letterEffect];
    const color = (glow ? mixWhite(base, glow.core) : base).replace('#', '0x');
    const next = `vt${i}`;
    const font = resolveFont(t.font, t.bold !== false);
    const size = Math.round(t.size || 48);
    const end = t.start + t.duration;
    const draw = (fontcolor, style) =>
      `drawtext=fontfile=${filterPath(font)}:textfile=${filterPath(txtFile)}:` +
      `expansion=none:fontsize=${size}:fontcolor=${fontcolor}:${style}${textAlpha(t)}` +
      `x=(w*${num(t.x ?? 0.5)})-text_w/2:y=(h*${num(t.y ?? 0.85)})-text_h/2:` +
      `enable='between(t,${num(t.start)},${num(end)})'`;
    if (glow) {
      const glowColor = base.replace('#', '0x');
      filters.push(
        `color=c=${glowColor}@0:s=${W}x${H}:r=${fps}:d=${num(end + 0.1)},format=yuva420p,` +
          `${draw(`${glowColor}@${glow.alpha}`, '')},gblur=sigma=${num(glow.sigma * size)}[gl${i}]`
      );
      filters.push(`[${vLabel}][gl${i}]overlay=format=auto:eof_action=pass[vg${i}]`);
      vLabel = `vg${i}`;
    }
    filters.push(`[${vLabel}]${draw(color, textStyle(t, color))}[${next}]`);
    vLabel = next;
  };

  const behindOverlays = overlays.filter((c) => c.layer === 'behind');
  const frontOverlays = overlays.filter((c) => c.layer !== 'behind');
  const behindTexts = (project.textClips || []).filter((t) => t.layer === 'behind');
  const frontTexts = (project.textClips || []).filter((t) => t.layer !== 'behind');
  const maskExpr = anyChroma ? null : maskAlphaExpr(clips);

  const applyBehind = () => {
    behindOverlays.forEach((clip, j) => appendOverlay(clip, `ovb${j}`));
    behindTexts.forEach((t, i) => appendText(t, `b${i}`));
  };
  const applyFront = () => {
    frontOverlays.forEach((clip, j) => appendOverlay(clip, `ovf${j}`));
    frontTexts.forEach((t, i) => appendText(t, `f${i}`));
  };

  if (anyChroma) {
    filters.push(`color=c=black:s=${W}x${H}:d=${num(total)}:r=${fps},format=yuva420p[vbase]`);
    const keyed = vLabel;
    vLabel = 'vbase';
    applyBehind();
    const keyedEof = extendPastVideo ? ':eof_action=pass' : '';
    filters.push(`[${vLabel}][${keyed}]overlay=format=auto${keyedEof}[vck]`);
    vLabel = 'vck';
    applyFront();
  } else if (maskExpr) {
    filters.push(`[${vLabel}]split=2[vbg][vsrc]`);
    vLabel = 'vbg';
    applyBehind();
    filters.push(`[vsrc]format=yuva444p,geq=lum='lum(X\\,Y)':cb='cb(X\\,Y)':cr='cr(X\\,Y)':a='${maskExpr}'[vcut]`);
    filters.push(`[${vLabel}][vcut]overlay=format=auto[vmasked]`);
    vLabel = 'vmasked';
    applyFront();
  } else {
    applyBehind();
    applyFront();
  }
  filters.push(`[${vLabel}]format=yuv420p[vout]`);
  vLabel = 'vout';

  const music = (project.audioClips || []).filter((c) => mediaById[c.mediaId]);
  const mixLabels = ['[acat]'];
  music.forEach((c, j) => {
    const idx = inputIndex;
    inputIndex += 1;
    inputs.push('-i', mediaById[c.mediaId].path);
    const delay = Math.round(c.start * 1000);
    filters.push(
      `[${idx}:a]atrim=start=${num(c.in)}:end=${num(c.out)},asetpts=PTS-STARTPTS,volume=${c.volume ?? 1},aresample=48000` +
        `${audioFxChain(c, c.effects)},aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=${delay}|${delay}[m${j}]`
    );
    mixLabels.push(`[m${j}]`);
  });
  let aLabel = 'acat';
  if (music.length) {
    filters.push(`${mixLabels.join('')}amix=inputs=${mixLabels.length}:duration=longest:normalize=0[amix]`);
    aLabel = 'amix';
  }
  filters.push(`[${aLabel}]apad=whole_dur=${num(total)},aformat=sample_fmts=fltp:channel_layouts=stereo[aout]`);
  aLabel = 'aout';

  const args = [
    '-y', '-hide_banner',
    ...inputs,
    '-filter_complex', filters.join(';'),
    '-map', `[${vLabel}]`, '-map', `[${aLabel}]`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k',
    '-t', num(total),
    '-movflags', '+faststart',
    '-progress', 'pipe:1', '-nostats',
    outFile,
  ];
  return { args, total };
}

// Runs the export; onProgress receives a 0..1 fraction. Returns { promise, cancel }.
function runExport(project, outFile, onProgress) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fve-'));
  const { args, total } = buildExportArgs(project, outFile, tmpDir);
  const proc = spawn(ffmpegPath, args, { windowsHide: true });
  let log = '';
  const promise = new Promise((resolve, reject) => {
    proc.stdout.on('data', (d) => {
      const m = /out_time_us=(\d+)/.exec(d.toString());
      if (m && total > 0) onProgress?.(Math.min(1, Number(m[1]) / 1e6 / total));
    });
    proc.stderr.on('data', (d) => {
      log += d;
      if (log.length > 20000) log = log.slice(-20000);
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      if (code === 0) {
        onProgress?.(1);
        resolve(outFile);
      } else {
        reject(new Error(`FFmpeg failed (code ${code}):\n${log.slice(-3000)}`));
      }
    });
  });
  return { promise, cancel: () => proc.kill('SIGKILL') };
}

module.exports = {
  ffmpegPath,
  ffprobePath,
  probe,
  buildExportArgs,
  runExport,
  extractWaveform,
  audioFxChain,
  assertPixelCutBinaries,
  EXPECTED_FFMPEG_SHA256,
  EXPECTED_FFPROBE_SHA256,
};

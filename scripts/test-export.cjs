// Generates sample media with FFmpeg, then exports a small project through the real pipeline.
// Also checks every voice effect: the FFmpeg chain (export) and the AudioWorklet code (preview).
const fs = require('fs');
const os = require('os');
const vm = require('vm');
const path = require('path');
const { pathToFileURL } = require('url');
const { execFileSync, spawnSync } = require('child_process');
const { ffmpegPath, probe, runExport, buildExportArgs, audioFxChain, assertPixelCutBinaries } = require('../electron/ffmpeg.cjs');
const AUDIO_FX = require('../shared/audio-effects.json');

// src/*.js are ES modules in a package without "type"; Node detects them but warns once per file.
process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.name !== 'Warning' || !/MODULE_TYPELESS|reparsing/i.test(`${w.code} ${w.message}`)) console.warn(w); });

const SR = 48000;

function readWav(file) {
  const buf = fs.readFileSync(file);
  const dataAt = buf.indexOf('data') + 8;
  const samples = new Float32Array((buf.length - dataAt) / 2);
  for (let i = 0; i < samples.length; i += 1) samples[i] = buf.readInt16LE(dataAt + i * 2) / 32768;
  return samples;
}

const rmsDb = (x, from = 0) => {
  let sum = 0;
  for (let i = from; i < x.length; i += 1) sum += x[i] * x[i];
  return 10 * Math.log10(sum / Math.max(1, x.length - from) + 1e-12);
};

// Dominant frequency by counting rising zero crossings (good enough for a pure tone).
function toneHz(x, from) {
  let crossings = 0;
  for (let i = from + 1; i < x.length; i += 1) if (x[i - 1] < 0 && x[i] >= 0) crossings += 1;
  return crossings / ((x.length - from) / SR);
}

// Runs a processor from shared/voice-worklet.js like the browser does (fixed-size blocks).
// `params` may be a function of the block start to emulate parameter changes.
function runWorklet(name, options, params, input, block = 128) {
  const registry = {};
  const context = {
    sampleRate: SR,
    AudioWorkletProcessor: class {},
    registerProcessor: (id, cls) => { registry[id] = cls; },
    Math, Float32Array,
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../shared/voice-worklet.js'), 'utf8'), context);
  const node = new registry[name]({ processorOptions: options });
  const out = new Float32Array(input.length);
  for (let i = 0; i + block <= input.length; i += block) {
    const chunk = new Float32Array(block);
    node.process([[input.subarray(i, i + block)]], [[chunk]], typeof params === 'function' ? params(i) : params);
    out.set(chunk, i);
  }
  return out;
}

function renderEffects(dir, source, ids, tag) {
  const graph = ids.map((id, i) => `[s${i}]${audioFxChain({ in: 0, out: 2 }, [id]).slice(1)}[o${i}]`);
  const outFiles = ids.map((id) => path.join(dir, `${tag}-${id}.wav`));
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', source, '-filter_complex',
    `[0:a]asplit=${ids.length}${ids.map((_, i) => `[s${i}]`).join('')};${graph.join(';')}`];
  outFiles.forEach((file, i) => args.push('-map', `[o${i}]`, '-ac', '1', '-ar', String(SR), file));
  const res = spawnSync(ffmpegPath, args, { encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`Voice effects failed in FFmpeg:\n${res.stderr.slice(-2000)}`);
  return outFiles.map(readWav);
}

function checkVoiceEffects(dir) {
  const tone = path.join(dir, 'tone.wav');
  const saw = path.join(dir, 'saw.wav');
  execFileSync(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=2', '-ar', String(SR), '-ac', '1', tone]);
  execFileSync(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `aevalsrc='0.25*(2*mod(220*t\\,1)-1)':s=${SR}:d=2`, '-ac', '1', saw]);
  const input = readWav(tone);
  const voice = readWav(saw);
  const inDb = rmsDb(voice);
  const half = SR / 2;

  const report = [];
  const rendered = renderEffects(dir, saw, AUDIO_FX.map((fx) => fx.id), 'fx');
  AUDIO_FX.forEach((fx, i) => {
    const out = rendered[i];
    const db = rmsDb(out, half);
    const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    console.log(`${fx.id.padEnd(11)} ${db.toFixed(1)} dB (in ${inDb.toFixed(1)}), peak ${peak.toFixed(2)}`);
    if (db < inDb - 18) throw new Error(`Voice effect "${fx.id}" is almost silent in export (${db.toFixed(1)} dB)`);
    if (peak >= 0.999) throw new Error(`Voice effect "${fx.id}" clips in export`);
  });

  const [thin, thick] = renderEffects(dir, tone, ['thin', 'thick'], 'pitch');
  const thinHz = toneHz(thin, half);
  const thickHz = toneHz(thick, half);
  report.push(`export pitch: thin ${thinHz.toFixed(0)} Hz, thick ${thickHz.toFixed(0)} Hz (source 220 Hz)`);
  if (Math.abs(thinHz - 220 * 1.9) > 25) throw new Error(`Export "thin" pitch is ${thinHz} Hz`);
  if (Math.abs(thickHz - 220 * 0.62) > 12) throw new Error(`Export "thick" pitch is ${thickHz} Hz`);

  const ratio = (r) => ({ ratio: new Float32Array([r]) });
  const pThin = runWorklet('pc-pitch', {}, ratio(1.9), input);
  const pThick = runWorklet('pc-pitch', {}, ratio(0.62), input);
  const wThin = toneHz(pThin, half);
  const wThick = toneHz(pThick, half);
  report.push(`preview pitch: thin ${wThin.toFixed(0)} Hz, thick ${wThick.toFixed(0)} Hz`);
  if (Math.abs(wThin - 220 * 1.9) > 25) throw new Error(`Preview "thin" pitch is ${wThin} Hz`);
  if (Math.abs(wThick - 220 * 0.62) > 12) throw new Error(`Preview "thick" pitch is ${wThick} Hz`);

  const robotSpec = AUDIO_FX.find((fx) => fx.id === 'robot').stages.find((s) => s.type === 'robotize');
  const robotFile = path.join(dir, 'robotize.wav');
  execFileSync(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', '-i', tone, '-af',
    `afftfilt=real='hypot(re,im)*cos(PI*b)':imag=0:win_size=${robotSpec.size}:overlap=0.75`, robotFile]);
  const exportRobot = rmsDb(readWav(robotFile), half);
  const previewRobot = rmsDb(runWorklet('pc-robot', { size: robotSpec.size }, {}, input), half);
  report.push(`robotize level: export ${exportRobot.toFixed(1)} dB, preview ${previewRobot.toFixed(1)} dB`);
  if (Math.abs(exportRobot - previewRobot) > 3) throw new Error('Robot level differs between preview and export');

  console.log(report.join('\n'));
}

const synth = (seconds, fn) => Float32Array.from({ length: Math.round(seconds * SR) }, (_, i) => fn(i / SR, i));
const glideHz = (t) => 120 + 47 * t + 3 * Math.sin(2 * Math.PI * 5 * t);
// Voice-like test signal: 20 harmonics, pitch gliding 120 -> 260 Hz with a natural 5 Hz vibrato.
function glideVoice(seconds = 3) {
  let phase = 0;
  return synth(seconds, (t) => {
    phase += glideHz(t) / SR;
    let s = 0;
    for (let k = 1; k <= 20; k += 1) s += Math.sin(2 * Math.PI * k * phase) / k;
    return 0.18 * s;
  });
}
function seededNoise(seconds, amp) {
  let state = 12345;
  return synth(seconds, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return amp * ((state / 2 ** 32) * 2 - 1);
  });
}
const pct = (values, p) => [...values].sort((a, b) => a - b)[Math.floor(p * (values.length - 1))];
const peakOf = (x, from = 0) => { let m = 0; for (let i = from; i < x.length; i += 1) m = Math.max(m, Math.abs(x[i])); return m; };
const maxStep = (x, from) => { let m = 0; for (let i = from + 1; i < x.length; i += 1) m = Math.max(m, Math.abs(x[i] - x[i - 1])); return m; };

// Power averaged over exactly one output period: a periodic signal gives a flat line, so whatever
// varies is real amplitude modulation (flutter). Returns dB values every 1 ms.
function periodEnvelope(x, periodAt, from = SR / 2, to = x.length - SR / 10) {
  const C = new Float64Array(x.length + 1);
  for (let i = 0; i < x.length; i += 1) C[i + 1] = C[i] + x[i] * x[i];
  const at = (p) => { const i = Math.floor(p); return C[i] + (p - i) * (C[i + 1] - C[i]); };
  const env = [];
  for (let n = from; n < to; n += SR / 1000) {
    const P = periodAt(n / SR);
    env.push(10 * Math.log10((at(n + P) - at(n)) / P + 1e-12));
  }
  return env;
}
const flutterDb = (env) => pct(env, 0.97) - pct(env, 0.03);
function windowDb(x, from, to, size = SR / 100) {
  const out = [];
  for (let i = from; i + size <= to; i += size) out.push(rmsDb(x.subarray(i, i + size)));
  return out;
}
function pitchStats(x, from = SR / 2) {
  const zc = [];
  for (let i = from + 1; i < x.length - SR / 10; i += 1) if (x[i - 1] < 0 && x[i] >= 0) zc.push(i - 1 + x[i - 1] / (x[i - 1] - x[i]));
  const hz = [];
  for (let i = 1; i < zc.length; i += 1) hz.push(SR / (zc[i] - zc[i - 1]));
  const mean = hz.reduce((a, b) => a + b, 0) / hz.length;
  const cents = hz.map((v) => 1200 * Math.log2(v / mean));
  return { hz: mean, sdCents: Math.sqrt(cents.reduce((a, b) => a + b * b, 0) / cents.length) };
}
function assertFinite(name, x) {
  for (let i = 0; i < x.length; i += 1) if (!Number.isFinite(x[i])) throw new Error(`${name}: invalid sample ${x[i]} at ${i}`);
}
// Level (dB re 0.5 amplitude) of one frequency, by direct DFT.
function toneDb(x, f, from = SR / 4) {
  let re = 0;
  let im = 0;
  const n = x.length - from - SR / 10;
  for (let i = 0; i < n; i += 1) {
    re += x[from + i] * Math.cos((2 * Math.PI * f * i) / SR);
    im += x[from + i] * Math.sin((2 * Math.PI * f * i) / SR);
  }
  return 20 * Math.log10((2 * Math.hypot(re, im)) / n / 0.5 + 1e-12);
}
// 4th-order Butterworth-like filter (two Q = 0.707 biquads).
function filter4(x, type, f) {
  const w0 = (2 * Math.PI * f) / SR;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Math.SQRT1_2);
  const a0 = 1 + alpha;
  const k = type === 'low' ? (1 - cos) / 2 : (1 + cos) / 2;
  const b = [k / a0, (type === 'low' ? 1 - cos : -(1 + cos)) / a0, k / a0];
  const a = [(-2 * cos) / a0, (1 - alpha) / a0];
  let y = x;
  for (let pass = 0; pass < 2; pass += 1) {
    const out = new Float32Array(y.length);
    let z1 = 0;
    let z2 = 0;
    for (let i = 0; i < y.length; i += 1) {
      const v = b[0] * y[i] + z1;
      z1 = b[1] * y[i] - a[0] * v + z2;
      z2 = b[2] * y[i] - a[1] * v;
      out[i] = v;
    }
    y = out;
  }
  return y;
}
// 24 decaying noise bursts (consonant-like attacks), optionally over a quiet band-limited vowel.
const BURSTS = Array.from({ length: 24 }, (_, k) => Math.round((0.25 + k * 0.113) * SR));
function burstTrain(vowel) {
  const x = synth(3, (t) => {
    let s = 0;
    for (let k = 1; k <= 10; k += 1) s += Math.sin(2 * Math.PI * 150 * k * t) / k;
    return vowel * s;
  });
  const n = seededNoise(0.005, 0.5);
  for (const b of BURSTS) for (let j = 0; j < n.length; j += 1) x[b + j] += n[j] * Math.exp(-j / 48);
  return x;
}
// Counts how each burst comes out: once, repeated (pitch up re-reads) or lost (pitch down skips).
// Measured above 5 kHz, where only the bursts have energy, in 0.5 ms frames.
function burstCounts(out) {
  const hf = filter4(out, 'high', 5000);
  const counts = { single: 0, repeated: 0, lost: 0, delayMs: 0 };
  for (const b of BURSTS) {
    const frames = [];
    for (let i = b; i < b + 0.09 * SR; i += 24) frames.push(rmsDb(hf.subarray(i, i + 24)));
    const max = Math.max(...frames);
    let clusters = 0;
    let gap = 99;
    frames.forEach((v) => {
      if (v > max - 9) { if (gap >= 3) clusters += 1; gap = 0; } else gap += 1;
    });
    counts.delayMs = Math.max(counts.delayMs, frames.findIndex((v) => v > max - 9) * 0.5);
    if (max < -40) counts.lost += 1; else if (clusters >= 2) counts.repeated += 1; else counts.single += 1;
  }
  return counts;
}

// Preview pitch shifter quality on known signals; FFmpeg/rubberband figures are printed for reference.
function checkPreviewVoiceQuality(dir, { PRIME_SECONDS, SWAP_SECONDS }) {
  const presets = AUDIO_FX.flatMap((fx) => fx.stages.filter((s) => s.type === 'pitch').map((s) => ({ id: fx.id, ratio: s.ratio })));
  if (presets.length < 4) throw new Error('Pitch presets missing from shared/audio-effects.json');
  const half = SR / 2;
  const sine = synth(3, (t) => 0.5 * Math.sin(2 * Math.PI * 220 * t));
  const saw = synth(3, (t) => 0.3 * (2 * ((220 * t) % 1) - 1));
  const voice = glideVoice();
  // Below 8 kHz: pitch up must drop what would land above Nyquist, so white noise would lose level.
  const noise = filter4(seededNoise(3, 0.4), 'low', 8000);
  const burstsAlone = burstTrain(0);
  const burstsOnVowel = burstTrain(0.03);
  // A new chain starts processing when it is created; it must be audible before the swap hold ends
  // (minus one 128-sample render quantum for the node to start).
  const primeLimit = PRIME_SECONDS * SR - 128;
  const tailInput = synth(1.5, (t, i) => (t < 1 ? voice[i] : 0));
  const sineFile = path.join(dir, 'q-sine.wav');
  execFileSync(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=3', '-ar', String(SR), '-ac', '1', sineFile]);
  // Reference: only the export's pitch stage (the full presets add intentional ring/vibrato/EQ).
  const exported = presets.map(({ id, ratio }) => {
    const stage = `rubberband=pitch=${ratio}`;
    if (!audioFxChain({ in: 0, out: 2 }, [id]).includes(stage)) throw new Error(`Export chain of "${id}" does not use ${stage}`);
    const file = path.join(dir, `q-${id}.wav`);
    execFileSync(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', '-i', sineFile, '-af', stage, '-ar', String(SR), '-ac', '1', file]);
    return readWav(file);
  });
  const params = (ratio) => ({ ratio: new Float32Array([ratio]) });
  const lines = [];
  const voiceSteps = [];

  presets.forEach(({ id, ratio }, index) => {
    const fail = (what) => { throw new Error(`Preview "${id}" (ratio ${ratio}): ${what}`); };
    const target = 220 * ratio;
    const period = () => SR / target;

    const s = runWorklet('pc-pitch', {}, params(ratio), sine);
    assertFinite(id, s);
    const pitch = pitchStats(s);
    const sineFlutter = flutterDb(periodEnvelope(s, period));
    const sineDip = Math.min(...periodEnvelope(s, period)) - pct(periodEnvelope(s, period), 0.5);
    if (Math.abs(pitch.hz - target) > target * 0.01) fail(`pitch ${pitch.hz.toFixed(1)} Hz, expected ${target.toFixed(1)}`);
    if (pitch.sdCents > 5) fail(`unstable pitch (${pitch.sdCents.toFixed(1)} cents)`);
    if (sineFlutter > 1) fail(`tone flutters ${sineFlutter.toFixed(2)} dB`);
    if (sineDip < -2) fail(`level dips ${sineDip.toFixed(1)} dB`);
    if (maxStep(s, half) > 1.15 * (2 * Math.PI * target * 0.5) / SR) fail('discontinuity (click) in a pure tone');
    if (peakOf(s, half) > 0.5 * 1.05) fail(`tone peak grew to ${peakOf(s, half).toFixed(3)}`);
    const onset = s.findIndex((v) => Math.abs(v) > 0.01);
    if (onset < 0 || onset > 0.06 * SR) fail(`latency ${(onset / SR * 1000).toFixed(0)} ms`);

    const sawOut = runWorklet('pc-pitch', {}, params(ratio), saw);
    const sawFlutter = flutterDb(periodEnvelope(sawOut, period));
    if (sawFlutter > 1) fail(`sawtooth flutters ${sawFlutter.toFixed(2)} dB`);

    const v = runWorklet('pc-pitch', {}, params(ratio), voice);
    assertFinite(id, v);
    const voiceFlutter = flutterDb(periodEnvelope(v, (t) => SR / (glideHz(t) * ratio)));
    if (voiceFlutter > 1.5) fail(`voice-like signal flutters ${voiceFlutter.toFixed(2)} dB`);
    if (Math.abs(rmsDb(v, half) - rmsDb(voice, half)) > 3) fail('voice level changed by more than 3 dB');
    if (peakOf(v) > 0.99 || peakOf(v) > 1.3 * peakOf(voice)) fail(`voice peak ${peakOf(v).toFixed(2)} (clipping risk)`);
    if (Math.min(...windowDb(v, half, v.length)) < rmsDb(voice, half) - 12) fail('unexpected silence in voice');
    voiceSteps.push(maxStep(v, half));

    const n = runWorklet('pc-pitch', {}, params(ratio), noise);
    const nIn = windowDb(noise, half, noise.length);
    const nOut = windowDb(n, half, n.length);
    const levelDiff = rmsDb(n, half) - rmsDb(noise, half);
    if (Math.abs(levelDiff) > 1.5) fail(`noise level changed ${levelDiff.toFixed(2)} dB`);
    if (flutterDb(nOut) > flutterDb(nIn) + 2) fail(`noise level pumps (${flutterDb(nOut).toFixed(1)} dB vs ${flutterDb(nIn).toFixed(1)} dB in)`);

    const small = runWorklet('pc-pitch', {}, params(ratio), voice, 32);
    let diff = 0;
    for (let i = 0; i < v.length; i += 1) diff = Math.max(diff, Math.abs(v[i] - small[i]));
    if (diff > 1e-6) fail(`output depends on block size (${diff})`);

    const tail = runWorklet('pc-pitch', {}, params(ratio), tailInput);
    if (peakOf(tail, Math.round(1.3 * SR)) > 1e-6) fail('audio keeps playing after the input stops');

    const ready = s.findIndex((v) => Math.abs(v) > 0.25);
    if (ready < 0 || ready > primeLimit) fail(`full level only ${(ready / SR * 1000).toFixed(1)} ms after start (swap hold ${PRIME_SECONDS * 1000} ms)`);

    // Spectrum: the speech band is kept, nothing is folded back below Nyquist (aliasing) and pitch
    // down keeps its highs.
    const tone = (f) => runWorklet('pc-pitch', {}, params(ratio), synth(1.2, (t) => 0.5 * Math.sin(2 * Math.PI * f * t)));
    const fmt = (values) => values.map((db) => db.toFixed(1)).join('/');
    const band = [1000, 3000, 8000].map((f) => toneDb(tone(f), f * ratio));
    if (band.some((db) => db < -1 || db > 0.5)) fail(`1k/3k/8k tones at ${fmt(band)} dB`);
    let highs;
    if (ratio > 1) {
      const folded = [14000, 16000, 18000, 20000].filter((f) => f * ratio > SR / 2);
      const alias = folded.map((f) => toneDb(tone(f), SR - f * ratio));
      if (alias.some((db) => db > -30)) fail(`aliasing: ${folded.map((f) => f / 1000).join('/')} kHz fold back at ${fmt(alias)} dB`);
      highs = `aliases ${fmt(alias)} dB`;
    } else {
      const top = [12000, 16000].map((f) => toneDb(tone(f), f * ratio));
      if (top.some((db) => db < -3)) fail(`12k/16k tones at ${fmt(top)} dB (highs cut)`);
      highs = `12k/16k ${fmt(top)} dB`;
    }

    const attacks = [['alone', burstsAlone], ['over a vowel', burstsOnVowel]].map(([what, input]) => {
      const c = burstCounts(runWorklet('pc-pitch', {}, params(ratio), input));
      if (c.lost > 0) fail(`${c.lost}/24 attacks ${what} lost`);
      if (c.single < 22) fail(`only ${c.single}/24 attacks ${what} heard once (${c.repeated} repeated)`);
      if (c.delayMs > 40) fail(`attacks ${what} delayed up to ${c.delayMs} ms`);
      return c;
    });

    const e = exported[index];
    const exportPitch = pitchStats(e);
    lines.push(`${id.padEnd(8)} preview ${pitch.hz.toFixed(1)} Hz ±${pitch.sdCents.toFixed(1)}c flutter tone ${sineFlutter.toFixed(2)} / saw ${sawFlutter.toFixed(2)} / voice ${voiceFlutter.toFixed(2)} dB, start ${(onset / SR * 1000).toFixed(1)} ms`
      + ` | export (rubberband) ${exportPitch.hz.toFixed(1)} Hz ±${exportPitch.sdCents.toFixed(1)}c flutter tone ${flutterDb(periodEnvelope(e, period)).toFixed(2)} dB`);
    lines.push(`${''.padEnd(8)} band ${fmt(band)} dB, ${highs}; attacks once ${attacks[0].single}/24 alone, ${attacks[1].single}/24 over vowel (max delay ${Math.max(attacks[0].delayMs, attacks[1].delayMs)} ms)`);
  });

  // Preset swap on a playing clip, as src/audioFx.js schedules it: the old chain fades out over
  // SWAP_SECONDS while the new one (created at the switch) fades in, after `hold`.
  const swapAt = Math.round(1.2 * SR);
  const swapDip = (from, to, hold) => {
    const a = runWorklet('pc-pitch', {}, params(from), voice);
    const b = runWorklet('pc-pitch', {}, params(to), voice.subarray(swapAt));
    const start = swapAt + Math.round(hold * SR);
    const mix = new Float32Array(voice.length);
    for (let i = 0; i < voice.length; i += 1) {
      const g = Math.min(1, Math.max(0, (i - start) / (SWAP_SECONDS * SR)));
      mix[i] = a[i] * (1 - g) + (i >= swapAt ? b[i - swapAt] * g : 0);
    }
    let low = Infinity;
    for (let i = swapAt - SR / 50; i < swapAt + SR / 10; i += SR / 1000) low = Math.min(low, rmsDb(mix.subarray(i, i + SR / 100)));
    return low - rmsDb(voice, half);
  };
  const swaps = presets.map((p, i) => {
    const from = presets[(i + presets.length - 1) % presets.length];
    const held = swapDip(from.ratio, p.ratio, PRIME_SECONDS);
    if (held < -6) throw new Error(`Preview swap ${from.id} -> ${p.id} dips ${held.toFixed(1)} dB`);
    return `${from.id}->${p.id} ${held.toFixed(1)} dB (without hold ${swapDip(from.ratio, p.ratio, 0).toFixed(1)})`;
  });
  lines.push(`preset swap, lowest 10 ms level vs input: ${swaps.join(', ')}`);

  // Fast preset switching: the ratio changes every block, then every ~27 ms.
  const ratios = [...presets.map((p) => p.ratio), 1];
  for (const every of [128, 1280]) {
    const out = runWorklet('pc-pitch', {}, (i) => params(ratios[Math.floor(i / every) % ratios.length]), voice);
    assertFinite('pitch switching', out);
    if (peakOf(out) > 0.99) throw new Error(`Preview pitch switching every ${every} samples clips`);
    if (maxStep(out, half) > 1.25 * Math.max(...voiceSteps)) throw new Error(`Preview pitch switching every ${every} samples clicks`);
    if (Math.min(...windowDb(out, half, out.length)) < rmsDb(voice, half) - 12) throw new Error('Preview pitch switching drops out');
  }

  // Robot: preview must be the same algorithm as FFmpeg afftfilt (same waveform, up to latency).
  const robotSpec = AUDIO_FX.find((fx) => fx.id === 'robot').stages.find((s) => s.type === 'robotize');
  const voiceFile = path.join(dir, 'q-voice.raw');
  fs.writeFileSync(voiceFile, Buffer.from(voice.buffer));
  const robotFile = path.join(dir, 'q-robot.wav');
  execFileSync(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', voiceFile,
    '-af', `afftfilt=real='hypot(re,im)*cos(PI*b)':imag=0:win_size=${robotSpec.size}:overlap=0.75`, '-ar', String(SR), '-ac', '1', robotFile]);
  const robotExport = readWav(robotFile);
  const robotPreview = runWorklet('pc-robot', { size: robotSpec.size }, {}, voice);
  assertFinite('robot', robotPreview);
  let best = { corr: -1, lag: 0 };
  for (let lag = 0; lag <= 2 * robotSpec.size; lag += 1) {
    let ab = 0; let aa = 0; let bb = 0;
    for (let i = SR; i < 2 * SR; i += 2) {
      const a = robotPreview[i + lag];
      const b = robotExport[i];
      ab += a * b; aa += a * a; bb += b * b;
    }
    const corr = ab / Math.sqrt(aa * bb + 1e-12);
    if (corr > best.corr) best = { corr, lag };
  }
  if (best.corr < 0.99) throw new Error(`Robot preview differs from export (correlation ${best.corr.toFixed(3)})`);
  const robotSmall = runWorklet('pc-robot', { size: robotSpec.size }, {}, voice, 32);
  if (robotSmall.some((x, i) => Math.abs(x - robotPreview[i]) > 1e-6)) throw new Error('Robot output depends on block size');
  const robotReady = robotPreview.findIndex((v) => Math.abs(v) > 0.5 * peakOf(robotPreview, half));
  if (robotReady < 0 || robotReady > primeLimit) throw new Error(`Robot reaches its level only after ${(robotReady / SR * 1000).toFixed(1)} ms`);
  lines.push(`robot    preview = export waveform (correlation ${best.corr.toFixed(4)}, preview ${(best.lag / SR * 1000).toFixed(1)} ms later)`);
  console.log(lines.join('\n'));
}

(async () => {
  const bins = assertPixelCutBinaries();
  console.log(`test-export: PixelCut n6.1.1 ffmpeg=${bins.ffmpegSha} ffprobe=${bins.ffprobeSha}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fve-test-'));
  const gen = (args) => execFileSync(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', ...args]);
  const a = path.join(dir, 'a.mp4');
  const b = path.join(dir, 'b no audio.mp4');
  const music = path.join(dir, 'music.wav');
  gen(['-f', 'lavfi', '-i', 'testsrc=size=1920x1080:rate=30:duration=5', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=5', '-shortest', a]);
  gen(['-f', 'lavfi', '-i', 'smptebars=size=640x480:rate=25:duration=4', b]);
  gen(['-f', 'lavfi', '-i', 'sine=frequency=880:duration=10', music]);

  checkVoiceEffects(dir);
  checkPreviewVoiceQuality(dir, await import(pathToFileURL(path.join(__dirname, '../src/previewAudio.js')).href));

  const media = [];
  for (const [id, p] of [['m1', a], ['m2', b], ['m3', music]]) {
    const info = await probe(p);
    media.push({ id, path: p, name: path.basename(p), type: info.hasVideo ? 'video' : 'audio', ...info });
  }
  const project = {
    width: 1280, height: 720, fps: 30, media,
    videoClips: [
      { id: 'c1', mediaId: 'm1', in: 1, out: 3, audioEffects: ['robot', 'echo'] },
      { id: 'c2', mediaId: 'm2', in: 0, out: 2.5, transitionIn: { type: 'dissolve', duration: 0.5 } },
      { id: 'c3', mediaId: 'm1', in: 3, out: 5, speed: 2, audioEffects: ['thin'] },
    ],
    overlayClips: [{ id: 'o1', mediaId: 'm2', start: 1, in: 0, out: 2, x: 0.75, y: 0.3, scale: 0.4, speed: 1 }],
    textClips: [
      { id: 't1', text: "Salam: 100% free 'test'", start: 0.5, duration: 3, x: 0.5, y: 0.85, size: 56, color: '#ffcc00' },
      { id: 't2', text: 'UAU', start: 0, duration: 2, x: 0.5, y: 0.4, size: 90, color: '#ffffff', letterEffect: 'neon' },
    ],
    audioClips: [{ id: 'a1', mediaId: 'm3', start: 1, in: 0, out: 4, volume: 0.5, effects: ['thick', 'megaphone'], fadeIn: 0.5, fadeOut: 0.5 }],
  };
  // Timeline: 2 s + 2.5 s - 0.5 s overlap + (2 s / speed 2) = 5 s.
  const expected = 5;
  const out = path.join(dir, 'out.mp4');
  const job = runExport(project, out, (p) => process.stdout.write(`\rprogress ${(p * 100).toFixed(0)}%`));
  await job.promise;
  const info = await probe(out);
  console.log('\n', out, info);
  if (Math.abs(info.duration - expected) > 0.2 || !info.hasAudio || info.width !== 1280) throw new Error('Unexpected output');
  if (!buildExportArgs(project, out, dir).args.join(' ').includes('gblur=sigma=')) throw new Error('Neon text glow layer missing');
  const frame = path.join(dir, 'neon.png');
  // -ss is an input option. -frames:v and -update belong to the image2 output:
  // -update before -i is rejected, and a single PNG without it warns about a sequence pattern.
  gen(['-ss', '1', '-i', out, '-frames:v', '1', '-update', '1', frame]);
  const still = fs.readFileSync(frame);
  if (still.length < 32 || still[0] !== 0x89 || still.toString('ascii', 1, 4) !== 'PNG') throw new Error('Neon frame was not written as a PNG');
  console.log('neon frame', frame);

  const border = path.join(dir, 'border.mp4');
  const green = path.join(dir, 'green.mp4');
  gen(['-f', 'lavfi', '-i', 'color=c=0x2244aa:s=320x180:r=30:d=1.2', '-vf', 'drawbox=x=0:y=0:w=28:h=180:color=red:t=fill', '-frames:v', '36', border]);
  gen(['-f', 'lavfi', '-i', 'color=c=0x22aa55:s=320x180:r=30:d=1.2', '-frames:v', '36', green]);
  const zoomProject = {
    width: 320, height: 180, fps: 30,
    media: [
      { id: 'm', path: border, type: 'video', hasAudio: false, hasVideo: true, duration: 1.2 },
      { id: 'g', path: green, type: 'video', hasAudio: false, hasVideo: true, duration: 1.2 },
    ],
    videoClips: [{ id: 'c', mediaId: 'm', in: 0, out: 1.2, zoom: { preset: 'zoomIn', from: 1, to: 1.6, duration: 0.8 } }],
    overlayClips: [{ id: 'o', mediaId: 'g', start: 0, in: 0, out: 1.2, x: 0.5, y: 0.5, scale: 1, opacity: 1, enter: { type: 'fade', duration: 0.8, scale: 0.85 } }],
    textClips: [], audioClips: [],
  };
  const zoomFile = path.join(dir, 'zoom.mp4');
  await runExport(zoomProject, zoomFile, () => {}).promise;
  const sample = (ss, x, y) => {
    const raw = path.join(dir, `px-${ss}-${x}.rgb`);
    gen(['-ss', String(ss), '-i', zoomFile, '-frames:v', '1', '-vf', `crop=1:1:${x}:${y},format=rgb24`, '-f', 'rawvideo', raw]);
    return [...fs.readFileSync(raw).subarray(0, 3)];
  };
  const earlyEdge = sample(0.05, 4, 90);
  const lateEdge = sample(1.05, 4, 90);
  const earlyCenter = sample(0.05, 160, 90);
  const lateCenter = sample(1.05, 160, 90);
  if (earlyEdge[0] < 180) throw new Error(`zoom starts without the red edge (${earlyEdge.join(',')})`);
  if (lateEdge[0] > 80 || lateEdge[2] < 120) throw new Error(`zoom did not crop the edge (${lateEdge.join(',')})`);
  if (earlyCenter[1] > 80) throw new Error(`overlay fade is already opaque (${earlyCenter.join(',')})`);
  if (lateCenter[1] < 120) throw new Error(`overlay fade did not reach the green layer (${lateCenter.join(',')})`);
  console.log('zoom/fade frames', earlyEdge.join(','), '->', lateEdge.join(','), '|', earlyCenter.join(','), '->', lateCenter.join(','));

  const blue = path.join(dir, 'blue.mp4');
  const red = path.join(dir, 'red.mp4');
  const keyed = path.join(dir, 'keyed.mp4');
  gen(['-f', 'lavfi', '-i', 'color=c=blue:s=320x180:r=30:d=1.4', '-frames:v', '42', blue]);
  gen(['-f', 'lavfi', '-i', 'color=c=red:s=320x180:r=30:d=1.4', '-frames:v', '42', red]);
  gen(['-f', 'lavfi', '-i', 'color=c=0x00ff00:s=320x180:r=30:d=1.2', '-vf', 'drawbox=x=0:y=0:w=24:h=180:color=red:t=fill,drawbox=x=120:y=40:w=80:h=100:color=0x3366ff:t=fill', '-frames:v', '36', keyed]);
  const cover = (rgb) => {
    const sum = rgb[0] + rgb[2];
    return sum > 8 ? rgb[0] / sum : 0;
  };
  const paint = (file, opacity) => {
    const job = {
      width: 320, height: 180, fps: 30,
      media: [
        { id: 'b', path: blue, type: 'video', hasAudio: false, hasVideo: true, duration: 1.4 },
        { id: 'r', path: red, type: 'video', hasAudio: false, hasVideo: true, duration: 1.4 },
      ],
      videoClips: [{ id: 'c', mediaId: 'b', in: 0, out: 1.4 }],
      overlayClips: [{ id: 'o', mediaId: 'r', start: 0, in: 0, out: 1.4, x: 0.5, y: 0.5, scale: 1, opacity, enter: { type: 'fade', duration: 1, scale: 1 } }],
      textClips: [], audioClips: [],
    };
    return runExport(job, file, () => {}).promise;
  };
  const plainFade = path.join(dir, 'fade-curve.mp4');
  const halfFade = path.join(dir, 'fade-half.mp4');
  await paint(plainFade, 1);
  await paint(halfFade, 0.5);
  const read = (file, ss) => {
    const raw = path.join(dir, `fade-${path.basename(file)}-${ss}.rgb`);
    gen(['-ss', String(ss), '-i', file, '-frames:v', '1', '-vf', 'crop=1:1:160:90,format=rgb24', '-f', 'rawvideo', raw]);
    return [...fs.readFileSync(raw).subarray(0, 3)];
  };
  const smooth = (t) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
  const curvePoints = [0.02, 0.25, 0.5, 0.75, 1.02, 1.2];
  const curve = curvePoints.map((t) => ({ t, rgb: read(plainFade, t), cover: cover(read(plainFade, t)) }));
  const at = (t) => curve.find((point) => point.t === t);
  const close = (value, expected, slack, label) => {
    if (Math.abs(value - expected) > slack) throw new Error(`${label}: cover ${value.toFixed(3)} expected ${expected.toFixed(3)}`);
  };
  close(at(0.02).cover, 0, 0.08, 'fade start');
  close(at(0.25).cover, smooth(0.25), 0.05, 'fade 25%');
  close(at(0.5).cover, 0.5, 0.07, 'fade 50%');
  close(at(0.75).cover, smooth(0.75), 0.05, 'fade 75%');
  close(at(1.02).cover, 1, 0.08, 'fade end');
  close(at(1.2).cover, at(1.02).cover, 0.05, 'fade hold');
  if (at(0.25).cover > 0.21) throw new Error(`fade 25% is still the linear ramp (${at(0.25).cover.toFixed(3)})`);
  if (at(0.75).cover < 0.8) throw new Error(`fade 75% is still the linear ramp (${at(0.75).cover.toFixed(3)})`);
  const halfPoints = [0.25, 0.5, 1.05, 1.25].map((t) => ({ t, cover: cover(read(halfFade, t)) }));
  const halfAt = (t) => halfPoints.find((point) => point.t === t).cover;
  close(halfAt(0.25), 0.5 * smooth(0.25), 0.05, 'base opacity at 25%');
  close(halfAt(0.5), 0.25, 0.06, 'base opacity at 50%');
  close(halfAt(1.05), 0.5, 0.08, 'base opacity at the end');
  close(halfAt(1.25), halfAt(1.05), 0.05, 'base opacity hold');
  console.log('fade curve', curve.map((point) => `${point.t}:${point.cover.toFixed(3)}`).join(' '));
  console.log('fade half', halfPoints.map((point) => `${point.t}:${point.cover.toFixed(3)}`).join(' '));

  const tone = (rgb) => {
    const [r, g, b] = rgb;
    if (r > 140 && r > g + 40 && r > b + 40) return 'red';
    if (g > 120 && g > r + 30 && g > b + 30) return 'green';
    if (b > 110 && b > r + 20 && b >= g) return 'blue';
    if (r < 55 && g < 55 && b < 55) return 'black';
    return `other(${rgb.join(',')})`;
  };
  const zoomClip = { id: 'c', mediaId: 'k', in: 0, out: 1.2, zoom: { preset: 'zoomIn', from: 1, to: 2, duration: 1 } };
  const exportZoom = async (name, chroma) => {
    const file = path.join(dir, name);
    await runExport({
      width: 320, height: 180, fps: 30,
      media: [{ id: 'k', path: keyed, type: 'video', hasAudio: false, hasVideo: true, duration: 1.2 }],
      videoClips: [{ ...zoomClip, chroma }],
      overlayClips: [], textClips: [], audioClips: [],
    }, file, () => {}).promise;
    return file;
  };
  const plainZoom = await exportZoom('zoom-plain.mp4', null);
  const chromaZoom = await exportZoom('zoom-chroma.mp4', { enabled: true, color: '#00ff00', similarity: 0.4 });
  const swatch = (file, ss, x) => {
    const raw = path.join(dir, `sw-${path.basename(file)}-${ss}-${x}.rgb`);
    gen(['-ss', String(ss), '-i', file, '-frames:v', '1', '-vf', `crop=1:1:${x}:90,format=rgb24`, '-f', 'rawvideo', raw]);
    return [...fs.readFileSync(raw).subarray(0, 3)];
  };
  const moments = [0.04, 0.5, 1.0];
  const zoomReport = {};
  for (const [label, file] of [['plain', plainZoom], ['chroma', chromaZoom]]) {
    zoomReport[label] = moments.map((t) => ({
      t,
      edge: tone(swatch(file, t, 6)),
      center: tone(swatch(file, t, 160)),
      edgeRgb: swatch(file, t, 6).join(','),
      centerRgb: swatch(file, t, 160).join(','),
    }));
  }
  const expectZoom = (label, index, edge, center) => {
    const row = zoomReport[label][index];
    if (row.edge !== edge || row.center !== center) {
      throw new Error(`${label} zoom at ${row.t}s is ${row.edge}/${row.center} (${row.edgeRgb} | ${row.centerRgb}), expected ${edge}/${center}`);
    }
  };
  expectZoom('plain', 0, 'red', 'blue');
  expectZoom('plain', 1, 'green', 'blue');
  expectZoom('plain', 2, 'green', 'blue');
  expectZoom('chroma', 0, 'red', 'blue');
  expectZoom('chroma', 1, 'black', 'blue');
  expectZoom('chroma', 2, 'black', 'blue');
  console.log('zoom chroma', JSON.stringify(zoomReport));
  console.log('EXPORT OK');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

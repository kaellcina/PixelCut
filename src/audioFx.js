import AUDIO_FX from '../shared/audio-effects.json';
// Loaded as a file: the page CSP (default-src 'self') rejects blob: and data: worklet modules.
import WORKLET_URL from '../shared/voice-worklet.js?url';
import { SWAP_SECONDS, swapHold } from './previewAudio.js';

const workletHref = () => new URL(WORKLET_URL, document.baseURI).href;

const graphs = new WeakMap();
let sharedCtx = null;
let workletReady = null;

// 48 kHz like the export (ffmpeg.cjs resamples before effects): the robot's buzz pitch is
// sampleRate / hop, so a 44.1 kHz device context would sound ~1.5 semitones lower.
export function getAudioContext() {
  if (!sharedCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    try {
      sharedCtx = new Ctx({ sampleRate: 48000, latencyHint: 'interactive' });
    } catch {
      sharedCtx = new Ctx();
    }
  }
  return sharedCtx;
}

export function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}

function ensureWorklet(ctx) {
  if (!workletReady) {
    if (!ctx.audioWorklet) {
      workletReady = Promise.resolve(false);
    } else {
      workletReady = ctx.audioWorklet.addModule(workletHref()).then(() => true, () => false);
    }
  }
  return workletReady;
}

// Effects are always applied in catalog order so preview and export (electron/ffmpeg.cjs) match.
export function effectStages(ids = []) {
  return AUDIO_FX.filter((fx) => ids.includes(fx.id)).flatMap((fx) => fx.stages);
}

const needsWorklet = (stages) => stages.some((s) => s.type === 'pitch' || s.type === 'robotize');

function ensureGraph(element) {
  let graph = graphs.get(element);
  if (graph) return graph;
  const ctx = getAudioContext();
  const source = ctx.createMediaElementSource(element);
  graph = { ctx, source, chain: null, pending: null, retiring: new Set(), version: 0 };
  graphs.set(element, graph);
  return graph;
}

function shaperCurve(fn) {
  const samples = 2048;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i += 1) curve[i] = fn((i * 2) / (samples - 1) - 1);
  return curve;
}

function buildStage(ctx, stage, input, keep) {
  const gainNode = (value) => {
    const node = keep(ctx.createGain());
    node.gain.value = value;
    return node;
  };
  const biquad = (type, freq, q, gain) => {
    const node = keep(ctx.createBiquadFilter());
    node.type = type;
    node.frequency.value = freq;
    if (q != null) node.Q.value = q;
    if (gain != null) node.gain.value = gain;
    input.connect(node);
    return node;
  };
  const oscillator = (freq, amount, target) => {
    const osc = keep(ctx.createOscillator());
    osc.frequency.value = freq;
    const depth = gainNode(amount);
    osc.connect(depth);
    depth.connect(target);
    osc.start();
  };

  switch (stage.type) {
    // Butterworth (Q = -3.01 dB) matches FFmpeg highpass/lowpass defaults.
    case 'highpass': return biquad('highpass', stage.f, -3.0103);
    case 'lowpass': return biquad('lowpass', stage.f, -3.0103);
    case 'peak': return biquad('peaking', stage.f, stage.q, stage.g);
    case 'lowshelf': return biquad('lowshelf', stage.f, null, stage.g);
    case 'highshelf': return biquad('highshelf', stage.f, null, stage.g);
    case 'gain': {
      const node = gainNode(stage.g);
      input.connect(node);
      return node;
    }
    case 'drive': {
      const node = keep(ctx.createWaveShaper());
      const k = stage.k;
      node.curve = shaperCurve((x) => Math.tanh(k * x) / Math.tanh(k));
      node.oversample = '2x';
      input.connect(node);
      return node;
    }
    case 'crush': {
      const node = keep(ctx.createWaveShaper());
      const steps = 2 ** (stage.bits - 1);
      node.curve = shaperCurve((x) => Math.round(x * steps) / steps);
      input.connect(node);
      return node;
    }
    case 'ring': {
      const node = gainNode(1 - stage.mix);
      input.connect(node);
      oscillator(stage.f, stage.mix, node.gain);
      return node;
    }
    case 'vibrato': {
      // Export uses chorus=0:1:0.5:1:f:depth*5 -> delay sweeps 0.5 ms .. 0.5 + depth * 5 ms.
      const delay = keep(ctx.createDelay(0.05));
      const half = stage.depth * 0.0025;
      delay.delayTime.value = 0.0005 + half;
      input.connect(delay);
      oscillator(stage.f, half, delay.delayTime);
      return delay;
    }
    case 'echo': {
      const sum = gainNode(stage.out);
      const dry = gainNode(stage.in);
      input.connect(dry);
      dry.connect(sum);
      stage.delays.forEach((ms, i) => {
        const delay = keep(ctx.createDelay(2));
        delay.delayTime.value = ms / 1000;
        const decay = gainNode(stage.decays[i] ?? 0.3);
        input.connect(delay);
        delay.connect(decay);
        decay.connect(sum);
      });
      return sum;
    }
    case 'chorus': {
      const sum = gainNode(stage.out);
      const dry = gainNode(stage.in);
      input.connect(dry);
      dry.connect(sum);
      const delay = keep(ctx.createDelay(1));
      delay.delayTime.value = (stage.delay + stage.depth / 2) / 1000;
      oscillator(stage.speed, stage.depth / 2000, delay.delayTime);
      const decay = gainNode(stage.decay);
      input.connect(delay);
      delay.connect(decay);
      decay.connect(sum);
      return sum;
    }
    case 'pitch': {
      const node = keep(new AudioWorkletNode(ctx, 'pc-pitch', { parameterData: { ratio: stage.ratio } }));
      input.connect(node);
      return node;
    }
    case 'robotize': {
      const node = keep(new AudioWorkletNode(ctx, 'pc-robot', { processorOptions: { size: stage.size } }));
      input.connect(node);
      return node;
    }
    default:
      return input;
  }
}

function teardown(graph, chain) {
  try { graph.source.disconnect(chain.input); } catch { /* already disconnected */ }
  chain.nodes.forEach((node) => {
    try { node.disconnect(); } catch { /* ignore */ }
    try { if (node.stop) node.stop(); } catch { /* ignore */ }
  });
  graph.retiring.delete(chain);
}

// The previous chain fades out and is then destroyed, so echo tails and worklet buffers never
// carry over into the next clip; only SWAP_SECONDS of overlap is audible.
function retire(graph, chain) {
  const now = graph.ctx.currentTime;
  const gain = chain.output.gain;
  graph.retiring.add(chain);
  try {
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + SWAP_SECONDS);
  } catch { /* context closed */ }
  window.setTimeout(() => teardown(graph, chain), SWAP_SECONDS * 1000 + 40);
}

// A chain still priming was never audible: drop it right away when another swap replaces it.
function dropPending(graph) {
  if (!graph.pending) return;
  window.clearTimeout(graph.pending.timer);
  teardown(graph, graph.pending.chain);
  graph.pending = null;
}

function wire(graph, stages, hold = 0) {
  const { ctx } = graph;
  const nodes = [];
  const keep = (node) => { nodes.push(node); return node; };
  const input = keep(ctx.createGain());
  const output = keep(ctx.createGain());
  let current = input;
  stages.forEach((stage) => {
    try {
      current = buildStage(ctx, stage, current, keep);
    } catch {
      // A stage that cannot be created (e.g. worklet unavailable) is skipped.
    }
  });
  current.connect(output);
  output.connect(ctx.destination);
  dropPending(graph);
  const chain = { input, output, nodes };
  const previous = graph.chain;
  if (!previous) {
    graph.source.connect(input);
    graph.chain = chain;
    return;
  }
  output.gain.value = 0;
  graph.source.connect(input);
  const swap = () => {
    graph.pending = null;
    const now = ctx.currentTime;
    output.gain.setValueAtTime(0, now);
    output.gain.linearRampToValueAtTime(1, now + SWAP_SECONDS);
    retire(graph, graph.chain);
    graph.chain = chain;
  };
  if (hold > 0) graph.pending = { chain, timer: window.setTimeout(swap, hold * 1000) };
  else swap();
}

// `key` identifies what the element is playing (usually the clip id). A new key rebuilds the
// chain even with identical effects, so echo tails or worklet buffers never leak between clips.
export function applyAudioEffects(element, effects = [], key = '') {
  if (!element) return;
  const signature = JSON.stringify([key, effects || []]);
  if (graphs.get(element)?.signature === signature) return;
  let graph;
  try {
    unlockAudio();
    graph = ensureGraph(element);
  } catch {
    return;
  }
  const stages = effectStages(effects || []);
  const hold = graph.chain ? swapHold(graph.info?.key, key) : 0;
  graph.signature = signature;
  graph.info = { key, effects: [...(effects || [])] };
  graph.version += 1;
  const version = graph.version;
  if (!needsWorklet(stages)) {
    wire(graph, stages, hold);
    return;
  }
  ensureWorklet(graph.ctx).then((ok) => {
    if (graph.version !== version) return;
    wire(graph, ok ? stages : stages.filter((s) => s.type !== 'pitch' && s.type !== 'robotize'), hold);
  });
}

// Used by electron/smoke.cjs: renders a 220 Hz tone through the voice worklet inside the real renderer.
export async function voiceSelfTest(ratio = 1.9) {
  const sr = 48000;
  const offline = new OfflineAudioContext(1, sr * 2, sr);
  await offline.audioWorklet.addModule(workletHref());
  const osc = offline.createOscillator();
  osc.frequency.value = 220;
  const node = new AudioWorkletNode(offline, 'pc-pitch', { parameterData: { ratio } });
  osc.connect(node);
  node.connect(offline.destination);
  osc.start();
  const data = (await offline.startRendering()).getChannelData(0);
  let crossings = 0;
  for (let i = sr + 1; i < data.length; i += 1) if (data[i - 1] < 0 && data[i] >= 0) crossings += 1;
  const ctx = getAudioContext();
  const liveWorklet = await ensureWorklet(ctx);
  return { pitchHz: crossings / ((data.length - sr) / sr), liveWorklet, liveSampleRate: ctx.sampleRate };
}

// Output latency of the preview audio graph, in ms (used by electron/smoke.cjs). Media elements
// routed through Web Audio are not delayed to match it, so it adds to any audio/video offset.
export function audioLatency() {
  const ctx = getAudioContext();
  const ms = (s) => (Number.isFinite(s) ? Math.round(s * 10000) / 10 : null);
  return { state: ctx.state, sampleRate: ctx.sampleRate, baseMs: ms(ctx.baseLatency), outputMs: ms(ctx.outputLatency) };
}

// Debug view of the chain wired on an element (used by electron/smoke.cjs).
export function audioChainInfo(element) {
  const graph = element && graphs.get(element);
  return graph?.info ? { ...graph.info, retiring: graph.retiring.size, priming: !!graph.pending } : null;
}

let auditionEl = null;
let auditionTimer = null;
let auditionTicker = null;
let auditionToken = 0;

export function stopAudition() {
  auditionToken += 1;
  window.clearTimeout(auditionTimer);
  window.clearInterval(auditionTicker);
  if (auditionEl && !auditionEl.paused) auditionEl.pause();
}

// Plays a plan from previewAudio.auditionPlan through the same effect graph used by the preview,
// on a single dedicated element (a new audition always stops the previous one).
export function auditionEffect(plan, url, onEnd) {
  stopAudition();
  const token = auditionToken;
  if (!auditionEl) {
    auditionEl = document.createElement('audio');
    auditionEl.preload = 'auto';
  }
  const element = auditionEl;
  applyAudioEffects(element, plan.effects, `audition:${plan.clipId}`);
  const finish = () => {
    if (token !== auditionToken) return;
    stopAudition();
    onEnd?.();
  };
  const start = () => {
    if (token !== auditionToken) return;
    try { element.currentTime = Math.max(0, plan.from); } catch { /* not seekable yet */ }
    try {
      element.preservesPitch = true;
      element.playbackRate = Math.max(0.1, Math.min(4, plan.rate || 1));
    } catch { /* ignore */ }
    const began = performance.now();
    const setGain = () => { element.volume = Math.max(0, Math.min(1, plan.gainAt((performance.now() - began) / 1000))); };
    setGain();
    auditionTicker = window.setInterval(setGain, 50);
    element.play().catch(finish);
    auditionTimer = window.setTimeout(finish, plan.seconds * 1000);
  };
  if (element.dataset.src !== url) {
    element.dataset.src = url;
    element.src = url;
    element.addEventListener('loadedmetadata', start, { once: true });
    element.load();
  } else {
    start();
  }
}

export { envelopeVolume } from './previewAudio.js';

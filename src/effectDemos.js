// How the library demonstrates each effect. The resting image is the real preview treatment
// (catalog filter, transform and overlay). In-between frames only weaken that same treatment.
// Cold and night fade that finished treatment over the same picture: wiping it in would look
// like a second clip arriving. Invert still wipes, because a half-inverted frame is a gray
// the effect never produces.

const AMOUNT = new Set([
  'blur', 'dream', 'glow', 'pixel', 'glitch', 'bw', 'sepia', 'vintage', 'cinematic', 'warm',
  'vivid', 'noir', 'sunset', 'teal', 'polaroid', 'bleach', 'cartoon', 'vignette', 'grain',
]);
const TINT = new Set(['cold', 'night']);
const REVEAL = new Set(['invert']);

export function demoKind(id) {
  if (id === 'mirror') return 'flip';
  if (TINT.has(id)) return 'tint';
  if (REVEAL.has(id)) return 'reveal';
  return AMOUNT.has(id) ? 'amount' : 'reveal';
}

function clamp(v) {
  return Math.max(0, Math.min(1, v));
}

function ease(t) {
  return t * t * (3 - 2 * t);
}

// 0 = clean scene, 1 = the effect exactly as the preview applies it.
// The full effect stays on screen for most of the loop; the short ramps only show the change.
export function demoAmount(step, period = 44) {
  const p = (step % period) / period;
  if (p < 0.08) return 0;
  if (p < 0.2) return ease((p - 0.08) / 0.12);
  if (p < 0.88) return 1;
  return 1 - ease((p - 0.88) / 0.12);
}

export function demoReveal(step, period = 44) {
  return demoAmount(step, period);
}

function num(v, digits = 2) {
  return Number(v).toFixed(digits).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

// `full` is the catalog entry. At 0 the scene is untouched; at 1 the strings match it exactly.
export function effectTreatment(full, amount) {
  const effect = full || {};
  const exact = {
    filter: effect.filter || '',
    transform: effect.transform || '',
    overlays: effect.overlay ? [effect.overlay] : [],
  };
  const a = clamp(amount);
  if (a >= 1) return exact;
  if (a <= 0) return { filter: '', transform: '', overlays: [] };
  return partial(effect.id, a, exact);
}

function partial(id, a, exact) {
  const overlays = exact.overlays;
  switch (id) {
    case 'blur':
      return { filter: `blur(${num(4 * a)}px)`, transform: '', overlays };
    case 'dream':
      return { filter: `blur(${num(1.1 * a)}px) brightness(${num(1 + 0.08 * a)}) contrast(${num(1 - 0.04 * a)})`, transform: '', overlays };
    case 'glow':
      return { filter: `brightness(${num(1 + 0.12 * a)}) contrast(${num(1 + 0.06 * a)})`, transform: '', overlays };
    case 'pixel':
      return { filter: `contrast(${num(1 + 0.2 * a)})`, transform: '', overlays };
    case 'glitch':
      return { filter: `hue-rotate(${num(20 * a, 1)}deg) saturate(${num(1 + 0.4 * a)})`, transform: '', overlays };
    case 'bw':
      return { filter: `grayscale(${num(a)})`, transform: '', overlays };
    case 'sepia':
      return { filter: `sepia(${num(0.85 * a)})`, transform: '', overlays };
    case 'vintage':
      return { filter: `sepia(${num(0.42 * a)}) contrast(${num(1 + 0.12 * a)}) saturate(${num(1 - 0.18 * a)})`, transform: '', overlays };
    case 'cinematic':
      return { filter: `contrast(${num(1 + 0.18 * a)}) saturate(${num(1 - 0.22 * a)}) brightness(${num(1 - 0.04 * a)})`, transform: '', overlays };
    case 'warm':
      return { filter: `sepia(${num(0.22 * a)}) saturate(${num(1 + 0.18 * a)}) brightness(${num(1 + 0.04 * a)})`, transform: '', overlays };
    case 'vivid':
      return { filter: `saturate(${num(1 + 0.55 * a)}) contrast(${num(1 + 0.12 * a)})`, transform: '', overlays };
    case 'noir':
      return { filter: `grayscale(${num(a)}) contrast(${num(1 + 0.32 * a)}) brightness(${num(1 - 0.1 * a)})`, transform: '', overlays };
    case 'sunset':
      return { filter: `sepia(${num(0.35 * a)}) hue-rotate(${num(-15 * a, 1)}deg) saturate(${num(1 + 0.4 * a)}) contrast(${num(1 + 0.1 * a)})`, transform: '', overlays };
    case 'teal':
      return { filter: `contrast(${num(1 + 0.15 * a)}) saturate(${num(1 + 0.25 * a)}) hue-rotate(${num(-8 * a, 1)}deg)`, transform: '', overlays };
    case 'polaroid':
      return { filter: `contrast(${num(1 - 0.08 * a)}) saturate(${num(1 + 0.2 * a)}) sepia(${num(0.18 * a)}) brightness(${num(1 + 0.06 * a)})`, transform: '', overlays };
    case 'bleach':
      return { filter: `contrast(${num(1 + 0.35 * a)}) saturate(${num(1 - 0.45 * a)}) brightness(${num(1 + 0.08 * a)})`, transform: '', overlays };
    case 'cartoon':
      return { filter: `contrast(${num(1 + 0.4 * a)}) saturate(${num(1 + 0.45 * a)}) brightness(${num(1 + 0.05 * a)})`, transform: '', overlays };
    case 'mirror':
      return { filter: '', transform: `scaleX(${num(1 - 2 * a, 3)})`, overlays };
    case 'vignette':
    case 'grain':
      return { filter: '', transform: '', overlays };
    default:
      return exact;
  }
}

// First scene, then the real transition, then the second scene, then a short gap so the
// loop restart is not mistaken for the transition running backwards.
export function transitionDemo(step, period = 46) {
  const p = (step % period) / period;
  if (p < 0.18) return { phase: 'a', progress: 0 };
  if (p < 0.62) return { phase: 'mix', progress: (p - 0.18) / 0.44 };
  if (p < 0.86) return { phase: 'b', progress: 1 };
  return { phase: 'gap', progress: 1 };
}

const TAU = Math.PI * 2;

function samples(n, fn) {
  return Array.from({ length: n }, (_, i) => fn(i / (n - 1)));
}

function pathFrom(ys) {
  return ys.map((y, i) => {
    const x = 8 + (i / (ys.length - 1)) * 104;
    const py = 18 - Math.max(-1, Math.min(1, y)) * 12;
    return `${i ? 'L' : 'M'}${x.toFixed(1)} ${py.toFixed(1)}`;
  }).join(' ');
}

function sine(cycles, amp = 1, n = 48, phase = 0) {
  return samples(n, (t) => amp * Math.sin(TAU * cycles * t + phase));
}

function pulse(t, at, amp, width = 0.035) {
  const d = Math.abs(t - at);
  return d < width ? amp * (1 - d / width) : 0;
}

function noise(t, salt) {
  const v = Math.sin(t * 180 + salt) * 0.6 + Math.sin(t * 73 + salt * 2) * 0.4;
  return v;
}

// One schematic waveform per voice effect: the shape is the idea (pitch, echo, clip),
// and the ▶ button plays the real effect on the selected clip.
const WAVES = {
  robot: () => samples(33, (t) => (Math.floor(t * 8) % 2 ? 0.8 : -0.8)),
  thin: () => sine(10, 0.72, 72),
  thick: () => sine(2, 0.95, 40),
  monster: () => samples(40, (t) => Math.max(-0.42, Math.min(0.42, Math.sin(TAU * 1.4 * t) * 1.5))),
  alien: () => samples(72, (t) => Math.sin(TAU * 8 * t) * (0.35 + 0.55 * (0.5 + 0.5 * Math.sin(TAU * 2 * t)))),
  ghost: () => samples(64, (t) => [0, 0.32, 0.62].reduce((sum, at, i) => sum + (t >= at ? Math.sin(TAU * 5 * (t - at)) * 0.9 * (0.62 ** i) * Math.exp(-(t - at) * 2.2) : 0), 0)),
  whisper: () => samples(40, (t) => noise(t, 1) * 0.22),
  echo: () => samples(56, (t) => pulse(t, 0.08, 1) + pulse(t, 0.42, 0.62) + pulse(t, 0.72, 0.34)),
  reverb: () => samples(56, (t) => pulse(t, 0.06, 1, 0.04) + (t > 0.1 ? noise(t, 3) * 0.55 * Math.exp(-(t - 0.1) * 2.4) : 0)),
  stadium: () => samples(56, (t) => [0.06, 0.26, 0.46, 0.66, 0.84].reduce((sum, at, i) => sum + pulse(t, at, 0.95 * (0.72 ** i), 0.03), 0)),
  cave: () => samples(48, (t) => Math.sin(TAU * 0.8 * t) * 0.35 + [0.12, 0.4, 0.68].reduce((sum, at, i) => sum + pulse(t, at, 0.5 * (0.6 ** i), 0.06), 0)),
  underwater: () => sine(1.3, 0.85, 36),
  radio: () => samples(48, (t) => Math.max(-0.7, Math.min(0.7, noise(t, 5) * 0.9)) * (0.35 + 0.65 * Math.sin(Math.PI * t))),
  tv: () => samples(33, (t) => Math.round(Math.sin(TAU * 3 * t) * 3) / 3),
  phone: () => samples(48, (t) => (t > 0.2 && t < 0.8 ? Math.sin(TAU * 6 * t) * 0.45 : 0)),
  megaphone: () => samples(48, (t) => Math.max(-0.38, Math.min(0.38, Math.sin(TAU * 4 * t) * 1.3))),
  bass: () => sine(0.75, 1, 32),
  chorus: () => sine(3, 0.8, 48),
  vibrato: () => samples(64, (t) => Math.sin(TAU * (2.2 + 1.6 * t) * t)),
  distortion: () => samples(48, (t) => Math.max(-0.34, Math.min(0.34, Math.sin(TAU * 2.5 * t) * 1.6))),
};

const SECOND = {
  chorus: () => sine(3, 0.55, 48, 0.8),
};

const PITCH = { thin: 'up', alien: 'up', thick: 'down', monster: 'down', bass: 'down' };

export function audioMark(id) {
  const build = WAVES[id];
  if (!build) return null;
  const paths = [pathFrom(build())];
  if (SECOND[id]) paths.push(pathFrom(SECOND[id]()));
  return { paths, pitch: PITCH[id] || '' };
}

/* global sampleRate, registerProcessor, AudioWorkletProcessor */
// Loaded by the preview AudioWorklet (src/audioFx.js) and also evaluated by scripts/test-export.cjs.

const XFADE_SECONDS = 0.01;
const SEEK_SECONDS = 0.0075; // +-7.5 ms covers one period of voices down to ~67 Hz
const GRAIN_SECONDS = 0.03;
// Onsets (consonants, attacks): a jump in high-frequency energy over the recent maximum.
const ONSET_HOP_SECONDS = 0.0013;
const ONSET_MEMORY_HOPS = 12; // ~16 ms, longer than one voice period, so pitch pulses are not onsets
const ONSET_RATIO = 4;
const ONSET_FLOOR = 1e-7;
const ONSET_PRE_SECONDS = 0.0015;
const ONSET_POST_SECONDS = 0.006;
const ONSET_SLOTS = 8;
// 8th-order Butterworth low-pass as four biquads.
const BUTTERWORTH_Q = [0.5097955791, 0.6013448869, 0.8999762231, 2.5629154477];

// Delay-line pitch shifter with a single read tap. Every grain the tap is spliced to a new delay
// chosen by waveform correlation (WSOLA style), so the short crossfade joins two in-phase copies
// instead of permanently mixing two taps 25 ms apart (that mix cancelled itself periodically and
// was heard as a 12-36 Hz flutter). Splices avoid repeating (pitch up) or skipping (pitch down)
// a fresh onset, and pitch-up input is band-limited so reading faster cannot alias.
// The export uses rubberband; this stays light enough for live use.
class PitchShifter extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'ratio', defaultValue: 1, minValue: 0.25, maxValue: 4, automationRate: 'k-rate' }];
  }

  constructor() {
    super();
    this.xfade = Math.max(16, Math.round(sampleRate * XFADE_SECONDS));
    this.seek = Math.max(8, Math.round(sampleRate * SEEK_SECONDS));
    this.grain = Math.round(sampleRate * GRAIN_SECONDS);
    // Largest delay needed (ratio 4): grain travel + seek range + fade travel + onset detours.
    const need = this.xfade * 6 + this.grain * 6 + this.seek * 4 + 64;
    let size = 1024;
    while (size < need) size <<= 1;
    this.size = size;
    this.mask = size - 1;
    this.buffers = [];
    this.mono = new Float32Array(size);
    this.write = 0;
    this.written = 0; // absolute index of the sample being written
    this.ratio = NaN;
    this.delay = 0;
    this.nextDelay = 0;
    this.fade = -1;
    this.fadeLen = this.xfade;
    this.fadeW = 0;
    this.minFade = Math.round(sampleRate * 0.002); // shortest crossfade, only used to clear an onset
    this.fadeIn = new Float32Array(this.xfade);
    this.fadeOut = new Float32Array(this.xfade);
    this.sinT = new Float32Array(this.xfade);
    for (let k = 0; k < this.xfade; k += 1) this.sinT[k] = Math.sin((Math.PI / 2) * ((k + 0.5) / this.xfade));

    this.hop = Math.max(16, Math.round(sampleRate * ONSET_HOP_SECONDS));
    this.pre = Math.round(sampleRate * ONSET_PRE_SECONDS);
    this.post = Math.round(sampleRate * ONSET_POST_SECONDS);
    this.refractory = Math.round(sampleRate * 0.02);
    this.hopEnergy = 0;
    this.hopCount = 0;
    this.hopHistory = new Float64Array(ONSET_MEMORY_HOPS);
    this.hopIndex = 0;
    this.prevMono = 0;
    this.lastOnset = -Infinity;
    this.onsets = new Float64Array(ONSET_SLOTS).fill(-Infinity);
    this.onsetIndex = 0;
    this.watch = -Infinity; // newest onset not yet checked for an early pitch-up splice

    this.filters = [];
    this.coef = new Float64Array(20);
    this.cutoff = 0;
    this.cutoffTarget = 0;
    this.mix = 0;
    this.mixTarget = 0;
  }

  configure(ratio) {
    const first = Number.isNaN(this.ratio);
    this.ratio = ratio;
    this.rate = 1 - ratio; // delay change per output sample
    const X = this.xfade;
    this.span = X; // correlation length: 10 ms is more than one voice period
    this.fadeTravel = Math.ceil(X * Math.abs(this.rate));
    // Shortest grain travel that still lets a +-seek candidate finish its fade inside the range.
    this.travel = Math.max(this.grain * Math.abs(this.rate), this.seek + this.fadeTravel + 16);
    if (this.rate < 0) {
      this.end = Math.max(this.span, this.fadeTravel) + 2;
      this.start = this.end + this.travel;
    } else {
      this.start = this.span + this.seek + 2;
      this.end = this.rate > 0 ? this.start + this.travel : Infinity;
    }
    this.limit = this.size - this.seek - this.span - 8;
    // Pitch down can start reading right behind the write head: no silence before the first grain.
    if (!(this.delay >= 2 && this.delay <= this.limit)) this.delay = this.rate > 0 ? 2 : this.start;

    // Reading `ratio` times faster maps input f to f * ratio: keep it below Nyquist and 20 kHz.
    if (ratio > 1.0001) {
      this.cutoffTarget = Math.min((0.9 * sampleRate) / 2 / ratio, 20000 / ratio, 0.45 * sampleRate);
      this.mixTarget = 1;
      if (!this.cutoff) this.setCutoff(this.cutoffTarget);
    } else {
      this.mixTarget = 0;
    }
    if (first) this.mix = this.mixTarget;
  }

  setCutoff(fc) {
    this.cutoff = fc;
    const w0 = (2 * Math.PI * fc) / sampleRate;
    const cos = Math.cos(w0);
    const sin = Math.sin(w0);
    BUTTERWORTH_Q.forEach((q, s) => {
      const alpha = sin / (2 * q);
      const a0 = 1 + alpha;
      const o = s * 5;
      this.coef[o] = (1 - cos) / 2 / a0;
      this.coef[o + 1] = (1 - cos) / a0;
      this.coef[o + 2] = (1 - cos) / 2 / a0;
      this.coef[o + 3] = (-2 * cos) / a0;
      this.coef[o + 4] = (1 - alpha) / a0;
    });
  }

  lowpass(state, x) {
    const c = this.coef;
    let v = x;
    for (let s = 0, o = 0; s < 4; s += 1, o += 5) {
      const y = c[o] * v + state[2 * s];
      state[2 * s] = c[o + 1] * v - c[o + 3] * y + state[2 * s + 1];
      state[2 * s + 1] = c[o + 2] * v - c[o + 4] * y;
      v = y;
    }
    return v;
  }

  detectOnset(m) {
    const diff = m - this.prevMono;
    this.prevMono = m;
    this.hopEnergy += diff * diff;
    this.hopCount += 1;
    if (this.hopCount < this.hop) return;
    const energy = this.hopEnergy / this.hop;
    // An attack split over two hops is compared with the hops before both, and starts in the first.
    const last = (this.hopIndex + ONSET_MEMORY_HOPS - 1) % ONSET_MEMORY_HOPS;
    let recent = 0;
    for (let k = 0; k < ONSET_MEMORY_HOPS; k += 1) if (k !== last) recent = Math.max(recent, this.hopHistory[k]);
    const rising = this.hopHistory[last] > 2 * recent + ONSET_FLOOR;
    const at = this.written - this.hop + 1 - (rising ? this.hop : 0);
    if (energy > ONSET_RATIO * recent + ONSET_FLOOR && at - this.lastOnset > this.refractory) {
      this.onsets[this.onsetIndex] = at;
      this.onsetIndex = (this.onsetIndex + 1) % ONSET_SLOTS;
      this.lastOnset = at;
      this.watch = at;
      if (this.fade >= 0 && this.rate < 0) this.hurryFade(at);
    }
    this.hopHistory[this.hopIndex] = energy;
    this.hopIndex = (this.hopIndex + 1) % ONSET_MEMORY_HOPS;
    this.hopEnergy = 0;
    this.hopCount = 0;
  }

  // An onset detected during a pitch-up crossfade: the fading-out tap would play it too, just
  // before the new tap does (a flam). The rest of the fade is sped up to end before that.
  hurryFade(onset) {
    const read = this.written - this.delay;
    if (onset - this.pre <= read) return;
    const n = Math.max(this.minFade >> 1, Math.floor((onset - this.pre - read) / this.ratio));
    if (this.fade + n >= this.fadeLen) return;
    const from = (this.fade + 0.5) / this.fadeLen;
    const w = this.fadeW;
    for (let j = 1; j < n; j += 1) {
      const p = from + ((1 - from) * j) / n;
      const s = Math.sin((Math.PI / 2) * p);
      const c = Math.cos((Math.PI / 2) * p);
      this.fadeIn[this.fade + j] = w * s * s + (1 - w) * s;
      this.fadeOut[this.fade + j] = w * c * c + (1 - w) * c;
    }
    this.fadeLen = this.fade + n;
  }

  // Normalized correlation between the playing segment and a candidate one (both in the past).
  score(a0, c, step) {
    const { mono, mask, span } = this;
    const b0 = this.write - c;
    let ab = 0;
    let bb = 0;
    for (let k = 0; k < span; k += step) {
      const b = mono[(b0 + k) & mask];
      ab += mono[(a0 + k) & mask] * b;
      bb += b * b;
    }
    return { ab, bb };
  }

  // Candidate delays for the next grain. Pitch up re-reads [new tap, old tap]: keep onsets out of it.
  // Pitch down skips [old tap, new tap]: start the new tap before the first onset not yet played.
  // Returns null when pitch down should wait until the read head has played the onset, or when an
  // early pitch-up splice (minDelay set) has no valid candidate.
  candidates(forced, minDelay = -Infinity, fadeLen = this.xfade) {
    const { seek, rate, pre, post } = this;
    const now = this.written;
    const read = now - this.delay;
    const target = Math.round(this.start);
    let lo = target - seek;
    let hi = target + seek;
    let fLo;
    let fHi;
    if (rate < 0) {
      fLo = Math.ceil(this.end + this.fadeTravel + 2);
      fHi = Math.min(this.limit, now - 2);
    } else {
      fLo = this.span + 2;
      fHi = Math.min(this.limit, Math.floor(this.delay) - 1, Math.floor(this.end - this.fadeTravel - 2));
    }
    let bound = rate < 0 ? Infinity : -Infinity;
    for (let k = 0; k < ONSET_SLOTS; k += 1) {
      const o = this.onsets[k];
      if (!(o <= now)) continue;
      if (rate < 0) {
        // Onsets the old tap has played (or plays loudly while fading out) must stay behind the new tap.
        if (o - pre < read + fadeLen * this.ratio * 0.5) bound = Math.min(bound, now - o - post);
      } else if (o + post > read) {
        bound = Math.max(bound, now - o + pre);
      }
    }
    if (rate < 0 && bound < Infinity) {
      if (bound < lo) { hi = bound; lo = bound - 2 * seek; } else hi = Math.min(hi, bound);
    } else if (rate > 0 && bound > -Infinity) {
      if (bound > hi) { lo = bound; hi = bound + 2 * seek; } else lo = Math.max(lo, bound);
    }
    if (minDelay > hi) { lo = minDelay; hi = minDelay + 2 * seek; } else lo = Math.max(lo, minDelay);
    if (minDelay > -Infinity && bound < hi) hi = bound;
    lo = Math.max(lo, fLo);
    hi = Math.min(hi, fHi);
    if (lo <= hi) return [lo, hi];
    if (minDelay > -Infinity || (rate > 0 && !forced)) return null;
    lo = Math.max(target - seek, fLo);
    hi = Math.min(target + seek, fHi);
    if (lo > hi) { lo = Math.min(Math.max(target, fLo), Math.max(fLo, fHi)); hi = lo; }
    return [lo, hi];
  }

  // Pitch up re-reads the end of every grain. An onset that would be read there (or while the old
  // tap fades out) is protected by splicing before it, with a grain long enough that the following
  // splice can still leave it behind.
  checkEarlySplice() {
    const onset = this.watch;
    if (!(onset > -Infinity)) return;
    const { ratio, rate } = this;
    const read = this.written - this.delay;
    this.watch = -Infinity;
    if (onset - read - this.pre < this.minFade * ratio) return;
    const speed = ratio / -rate;
    const readAtSplice = read + speed * (this.delay - this.end);
    const reach = this.fadeTravel + 2 + this.post;
    if (onset < readAtSplice - reach || onset > readAtSplice + this.xfade * ratio + this.pre) return;
    this.splice(false, true);
  }

  // Next onset the read head has not reached yet (pitch up), or -Infinity.
  onsetAhead(read) {
    let next = Infinity;
    for (let k = 0; k < ONSET_SLOTS; k += 1) if (this.onsets[k] > read && this.onsets[k] < next) next = this.onsets[k];
    return next < Infinity ? next : -Infinity;
  }

  splice(forced, early = false) {
    let fadeLen = this.xfade;
    let minDelay = -Infinity;
    if (this.rate < 0) {
      // An onset just ahead: end the old tap's fade before it and give the new grain enough length.
      const read = this.written - this.delay;
      const onset = this.onsetAhead(read);
      if (onset > -Infinity && onset - read - this.pre < this.xfade * this.ratio) {
        fadeLen = Math.max(this.minFade, Math.floor((onset - read - this.pre) / this.ratio));
      }
      if (onset > -Infinity && (early || fadeLen < this.xfade)) {
        const speed = this.ratio / -this.rate;
        const reach = this.fadeTravel + 2 + this.post;
        minDelay = Math.ceil((speed * this.end + reach - (this.written - onset)) / (speed - 1));
      }
    }
    let range = this.candidates(forced, minDelay, fadeLen);
    if (!range && !early && minDelay > -Infinity) {
      fadeLen = this.xfade;
      range = this.candidates(forced);
    }
    if (!range) return;
    const [lo, hi] = range;
    const { mono, mask, span } = this;
    const current = Math.round(this.delay);
    let best = Math.round((lo + hi) / 2);
    let r = 0;
    if (current >= span + 1) {
      const a0 = this.write - current;
      let aa = 0;
      for (let k = 0; k < span; k += 1) aa += mono[(a0 + k) & mask] ** 2;
      if (aa > 1e-7 * span) {
        let bestScore = -Infinity;
        for (let c = lo; c <= hi; c += 2) {
          const { ab, bb } = this.score(a0, c, 4);
          const s = ab / Math.sqrt(bb + 1e-9);
          if (s > bestScore) { bestScore = s; best = c; }
        }
        // The 4-sample stride aliases tones near multiples of sr/8 (ties land on the window edge):
        // five consecutive lags, kept inside the window, cover their whole period.
        const first = Math.max(lo, Math.min(best - 2, hi - 4));
        bestScore = -Infinity;
        for (let c = first; c <= Math.min(hi, first + 4); c += 1) {
          const { ab, bb } = this.score(a0, c, 1);
          const s = ab / Math.sqrt(bb + 1e-9);
          if (s > bestScore) { bestScore = s; best = c; r = ab / Math.sqrt(aa * bb + 1e-12); }
        }
      }
    }
    // Same fractional part keeps the two taps an exact number of input samples apart.
    this.nextDelay = best + (this.delay - current);
    // In-phase material crossfades with constant amplitude, uncorrelated (noise) with constant power.
    const w = Math.max(0, Math.min(1, r));
    for (let k = 0; k < fadeLen; k += 1) {
      const s = fadeLen === this.xfade ? this.sinT[k] : Math.sin((Math.PI / 2) * ((k + 0.5) / fadeLen));
      const c = fadeLen === this.xfade ? this.sinT[fadeLen - 1 - k] : Math.cos((Math.PI / 2) * ((k + 0.5) / fadeLen));
      this.fadeIn[k] = w * s * s + (1 - w) * s;
      this.fadeOut[k] = w * c * c + (1 - w) * c;
    }
    this.fadeLen = fadeLen;
    this.fadeW = w;
    this.fade = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input.length) return true;
    const ratio = parameters.ratio[0];
    if (ratio !== this.ratio) this.configure(ratio);
    while (this.buffers.length < input.length) this.buffers.push(new Float32Array(this.size));
    while (this.filters.length < input.length) this.filters.push(new Float64Array(8));
    const channels = input.length;
    const frames = input[0].length;
    // Cutoff glides (~10 ms) and the filter fades in/out per sample, so ratio changes cannot click.
    const glide = 1 - Math.exp(-frames / (0.01 * sampleRate));
    if (this.cutoffTarget && this.cutoff !== this.cutoffTarget) {
      const next = this.cutoff * (this.cutoffTarget / this.cutoff) ** glide;
      this.setCutoff(Math.abs(next / this.cutoffTarget - 1) < 1e-3 ? this.cutoffTarget : next);
    }
    const mixStep = Math.max(-glide, Math.min(glide, this.mixTarget - this.mix)) / frames;
    const filtering = this.mix > 0 || this.mixTarget > 0;
    const { mask, mono, buffers, rate } = this;
    for (let i = 0; i < frames; i += 1) {
      const w = this.write;
      this.mix += mixStep;
      const mix = this.mix;
      let sum = 0;
      for (let ch = 0; ch < channels; ch += 1) {
        let v = input[ch][i];
        if (filtering) v += mix * (this.lowpass(this.filters[ch], v) - v);
        buffers[ch][w] = v;
        sum += v;
      }
      const m = sum / channels;
      mono[w] = m;
      this.detectOnset(m);
      if (this.fade < 0) {
        const due = (rate < 0 && this.delay <= this.end) || (rate > 0 && this.delay >= this.end);
        const forced = this.delay > this.limit || (rate > 0 && this.delay >= this.end + this.travel);
        if (due || forced) this.splice(forced);
        else if (rate < 0) this.checkEarlySplice();
      }
      const fading = this.fade >= 0;
      const p1 = w - this.delay;
      const p2 = w - this.nextDelay;
      const gOut = fading ? this.fadeOut[this.fade] : 1;
      const gIn = fading ? this.fadeIn[this.fade] : 0;
      for (let ch = 0; ch < channels; ch += 1) {
        if (!output[ch]) continue;
        const buf = buffers[ch];
        let y = cubicAt(buf, p1, mask);
        if (fading) y = gOut * y + gIn * cubicAt(buf, p2, mask);
        output[ch][i] = y;
      }
      this.delay = Math.min(this.limit, Math.max(2, this.delay + rate));
      if (fading) {
        this.nextDelay = Math.min(this.limit, Math.max(2, this.nextDelay + rate));
        this.fade += 1;
        if (this.fade >= this.fadeLen) {
          this.delay = this.nextDelay;
          this.fade = -1;
        }
      }
      this.write = (w + 1) & mask;
      this.written += 1;
    }
    this.mix = Math.max(0, Math.min(1, this.mix));
    return true;
  }
}

// Catmull-Rom interpolation (reads pos-1 .. pos+2; callers keep delays >= 2).
function cubicAt(buf, pos, mask) {
  const i = Math.floor(pos);
  const t = pos - i;
  const xm1 = buf[(i - 1) & mask];
  const x0 = buf[i & mask];
  const x1 = buf[(i + 1) & mask];
  const x2 = buf[(i + 2) & mask];
  const c1 = 0.5 * (x1 - xm1);
  const c2 = xm1 - 2.5 * x0 + 2 * x1 - 0.5 * x2;
  const c3 = 0.5 * (x2 - xm1) + 1.5 * (x0 - x1);
  return ((c3 * t + c2) * t + c1) * t + x0;
}

function fft(re, im, inverse) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / size;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < size / 2; k += 1) {
        const a = start + k;
        const b = a + size / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i += 1) { re[i] /= n; im[i] /= n; }
}

// Same algorithm as FFmpeg afftfilt real='hypot(re,im)*cos(PI*b)':imag='0' with a Hann window and 75% overlap.
class Robotizer extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const size = (options && options.processorOptions && options.processorOptions.size) || 1024;
    this.size = size;
    this.hop = size / 4;
    this.window = new Float32Array(size);
    for (let i = 0; i < size; i += 1) this.window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size);
    this.channels = [];
  }

  state(ch) {
    if (!this.channels[ch]) {
      this.channels[ch] = {
        input: new Float32Array(this.size),
        output: new Float32Array(this.size),
        fill: 0,
        re: new Float32Array(this.size),
        im: new Float32Array(this.size),
      };
    }
    return this.channels[ch];
  }

  frame(s) {
    const { size, hop, window } = this;
    for (let i = 0; i < size; i += 1) {
      s.re[i] = s.input[i] * window[i];
      s.im[i] = 0;
    }
    fft(s.re, s.im, false);
    for (let k = 0; k < size; k += 1) {
      const mag = Math.hypot(s.re[k], s.im[k]);
      s.re[k] = k % 2 ? -mag : mag;
      s.im[k] = 0;
    }
    fft(s.re, s.im, true);
    s.output.copyWithin(0, hop);
    s.output.fill(0, size - hop);
    for (let i = 0; i < size; i += 1) s.output[i] += s.re[i] * window[i] / 1.5;
    s.input.copyWithin(0, hop);
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input.length) return true;
    for (let ch = 0; ch < input.length; ch += 1) {
      const s = this.state(ch);
      const src = input[ch];
      const dst = output[ch];
      for (let i = 0; i < src.length; i += 1) {
        s.input[this.size - this.hop + s.fill] = src[i];
        if (dst) dst[i] = s.output[s.fill];
        s.fill += 1;
        if (s.fill === this.hop) {
          s.fill = 0;
          this.frame(s);
        }
      }
    }
    return true;
  }
}

registerProcessor('pc-pitch', PitchShifter);
registerProcessor('pc-robot', Robotizer);

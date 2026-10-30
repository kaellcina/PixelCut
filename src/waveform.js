import { toFileUrl } from './store.js';

const cache = new Map();

export function canDecodeWaveformInRenderer(media) {
  if (!media?.path) return false;
  if (media.type === 'video' && typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
    return false;
  }
  return true;
}

async function peaksFromBuffer(buffer, bins = 720) {
  const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 2, 8000);
  const audio = await ctx.decodeAudioData(buffer.slice(0));
  const data = audio.getChannelData(0);
  const block = Math.max(1, Math.floor(data.length / bins));
  const peaks = new Array(bins);
  for (let i = 0; i < bins; i += 1) {
    let max = 0;
    const start = i * block;
    for (let j = 0; j < block && start + j < data.length; j += 1) max = Math.max(max, Math.abs(data[start + j]));
    peaks[i] = Math.min(1, max);
  }
  return { peaks, duration: audio.duration };
}

export async function loadWaveform(media) {
  if (!media?.path) return null;
  if (cache.has(media.id)) return cache.get(media.id);
  const pending = (async () => {
    try {
      if (window.api?.waveform) {
        const result = await window.api.waveform(media.path);
        if (result?.peaks?.length) return result;
      }
    } catch { /* Fall through to decode in the renderer. */ }
    if (!canDecodeWaveformInRenderer(media)) {
      return { peaks: [], duration: media.duration || 1, placeholder: true };
    }
    try {
      const response = await fetch(toFileUrl(media.path));
      if (!response.ok) return null;
      return await peaksFromBuffer(await response.arrayBuffer());
    } catch {
      return null;
    }
  })();
  cache.set(media.id, pending);
  return pending;
}

export function drawWaveform(canvas, bundle, clipIn, clipOut, color = '#7ee0c8') {
  if (!canvas) return;
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  if (!bundle?.peaks?.length) {
    ctx.fillStyle = `${color}33`;
    ctx.fillRect(0, height / 2 - 1, width, 2);
    return;
  }
  const duration = Math.max(0.05, bundle.duration || 1);
  const start = Math.max(0, clipIn || 0) / duration;
  const end = Math.min(1, (clipOut || duration) / duration);
  const peaks = bundle.peaks;
  const from = Math.floor(start * (peaks.length - 1));
  const to = Math.max(from + 1, Math.ceil(end * (peaks.length - 1)));
  const slice = peaks.slice(from, to);
  const mid = height / 2;
  ctx.fillStyle = color;
  const gap = slice.length > width ? 0 : 0.4;
  const bar = Math.max(1, width / slice.length);
  slice.forEach((value, index) => {
    const amp = Math.max(1.2, value * (mid - 1));
    ctx.globalAlpha = 0.35 + value * 0.65;
    ctx.fillRect(index * bar, mid - amp, Math.max(1, bar - gap), amp * 2);
  });
  ctx.globalAlpha = 1;
  ctx.fillStyle = `${color}55`;
  ctx.fillRect(0, mid - 0.5, width, 1);
}

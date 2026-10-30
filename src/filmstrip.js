import { toFileUrl } from './store.js';

const cache = new Map();
let decodeChain = Promise.resolve();

export function filmstripFrameCount(duration, { compact = false } = {}) {
  const seconds = Math.max(0.1, Number(duration) || 1);
  const cap = compact ? 24 : 36;
  const density = compact ? 0.2 : 0.45;
  return Math.min(cap, Math.max(6, Math.ceil(seconds * density)));
}

export function filmstripTileCount(width, thumbW = 56, { compact = false } = {}) {
  const cap = compact ? 24 : 36;
  return Math.min(cap, Math.max(1, Math.ceil(Math.max(8, width) / Math.max(24, thumbW))));
}

function releaseVideo(video) {
  try {
    video.pause();
    video.removeAttribute('src');
    video.load();
  } catch {
    // Detaching is best-effort; the decoder must not stay pinned.
  }
}

function seekTo(video, time) {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.removeEventListener('seeked', done);
      video.removeEventListener('error', done);
      resolve();
    };
    const timer = window.setTimeout(done, 450);
    video.addEventListener('seeked', done);
    video.addEventListener('error', done);
    try {
      video.currentTime = Math.max(0, time);
    } catch {
      done();
    }
  });
}

function enqueueDecode(work) {
  const job = decodeChain.then(work, work);
  decodeChain = job.then(() => undefined, () => undefined);
  return job;
}

export function captureMediaFrames(media, options = {}) {
  if (!media?.id || media.type !== 'video') return Promise.resolve(null);
  const compact = options.compact === true;
  const key = `${media.id}:${compact ? 'm' : 'd'}`;
  if (cache.has(key)) return cache.get(key);

  const job = enqueueDecode(async () => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = toFileUrl(media.path);
    try {
      await new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('timeout')), 8000);
        video.addEventListener('loadeddata', () => {
          window.clearTimeout(timer);
          resolve();
        }, { once: true });
        video.addEventListener('error', () => {
          window.clearTimeout(timer);
          reject(new Error('decode'));
        }, { once: true });
      });

      const width = compact ? 96 : 160;
      const height = Math.max(40, Math.round(width * ((video.videoHeight || 9) / Math.max(1, video.videoWidth || 16))));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      const duration = video.duration || media.duration || 1;
      const count = filmstripFrameCount(duration, { compact });
      const frames = [];
      for (let i = 0; i < count; i += 1) {
        const time = ((i + 0.35) / count) * duration;
        await seekTo(video, Math.min(Math.max(0, duration - 0.04), time));
        try {
          ctx.drawImage(video, 0, 0, width, height);
          frames.push(canvas.toDataURL('image/jpeg', compact ? 0.5 : 0.62));
        } catch {
          frames.push(frames[frames.length - 1] || null);
        }
      }
      if (!frames.some(Boolean)) return null;
      return { duration, frames };
    } finally {
      releaseVideo(video);
    }
  }).catch(() => {
    cache.delete(key);
    return null;
  });

  cache.set(key, job);
  return job;
}

export function frameAt(bundle, time) {
  if (!bundle?.frames?.length) return null;
  const duration = bundle.duration || 1;
  const index = Math.max(0, Math.min(bundle.frames.length - 1, Math.floor((time / duration) * bundle.frames.length)));
  return bundle.frames[index];
}

export function prefetchFilmstrips(mediaList, options = {}) {
  (mediaList || []).filter((item) => item.type === 'video').slice(0, 3).forEach((item) => {
    captureMediaFrames(item, options);
  });
}

import { toFileUrl } from './store.js';

const cache = new Map();

function seekTo(video, time) {
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener('seeked', done);
      resolve();
    };
    video.addEventListener('seeked', done);
    try {
      video.currentTime = Math.max(0, time);
    } catch {
      resolve();
    }
  });
}

export function captureMediaFrames(media) {
  if (!media?.id || media.type !== 'video') return Promise.resolve(null);
  if (cache.has(media.id)) return cache.get(media.id);

  const job = (async () => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = toFileUrl(media.path);
    await new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('timeout')), 12000);
      video.addEventListener('loadeddata', () => {
        window.clearTimeout(timer);
        resolve();
      }, { once: true });
      video.addEventListener('error', () => {
        window.clearTimeout(timer);
        reject(new Error('decode'));
      }, { once: true });
    });

    // Shared by the timeline filmstrip (56 px) and the effect/transition previews (up to ~290 px).
    const width = 160;
    const height = Math.max(40, Math.round(width * ((video.videoHeight || 9) / Math.max(1, video.videoWidth || 16))));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    const duration = video.duration || media.duration || 1;
    const count = Math.min(64, Math.max(10, Math.ceil(duration * 1.6)));
    const frames = [];
    for (let i = 0; i < count; i += 1) {
      const time = ((i + 0.35) / count) * duration;
      await seekTo(video, Math.min(duration - 0.04, time));
      ctx.drawImage(video, 0, 0, width, height);
      frames.push(canvas.toDataURL('image/jpeg', 0.62));
    }
    video.removeAttribute('src');
    video.load();
    return { duration, frames };
  })().catch(() => {
    cache.delete(media.id);
    return null;
  });

  cache.set(media.id, job);
  return job;
}

export function frameAt(bundle, time) {
  if (!bundle?.frames?.length) return null;
  const duration = bundle.duration || 1;
  const index = Math.max(0, Math.min(bundle.frames.length - 1, Math.floor((time / duration) * bundle.frames.length)));
  return bundle.frames[index];
}

export function prefetchFilmstrips(mediaList) {
  (mediaList || []).filter((item) => item.type === 'video').forEach((item) => {
    captureMediaFrames(item);
  });
}

import { toFileUrl } from '../store.js';
import { firstVisualMedia } from './schema.js';

function wait(element, eventName, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('timeout')), timeout);
    const done = () => {
      window.clearTimeout(timer);
      resolve();
    };
    element.addEventListener(eventName, done, { once: true });
    element.addEventListener('error', () => {
      window.clearTimeout(timer);
      reject(new Error('decode'));
    }, { once: true });
  });
}

export async function captureProjectThumb(project) {
  const media = firstVisualMedia(project);
  if (!media?.path) return null;
  const width = 320;
  const height = 180;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return null;
  ctx.fillStyle = '#0b1118';
  ctx.fillRect(0, 0, width, height);
  try {
    if (media.type === 'image') {
      const image = new Image();
      const ready = wait(image, 'load');
      image.src = toFileUrl(media.path);
      await ready;
      ctx.drawImage(image, 0, 0, width, height);
    } else {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.src = toFileUrl(media.path);
      await wait(video, 'loadeddata');
      const mark = Math.min(0.5, Math.max(0, (video.duration || media.duration || 1) * 0.2));
      if (Number.isFinite(video.duration) && video.duration > 0) {
        await new Promise((resolve) => {
          const done = () => resolve();
          video.addEventListener('seeked', done, { once: true });
          try { video.currentTime = mark; } catch { resolve(); }
        });
      }
      ctx.drawImage(video, 0, 0, width, height);
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch { /* decoder must not stay pinned after the jpeg is ready */ }
    }
  } catch {
    return null;
  }
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.72), mediaId: media.id };
}

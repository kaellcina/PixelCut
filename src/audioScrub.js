const STORAGE_KEY = 'pixelcut.audioScrub';
const FAST_SPEED = 6;
const BLIP_MS = 70;
const MIN_GAP_MS = 90;

export function readAudioScrubPref() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === '0' || raw === 'false') return false;
  } catch { /* private mode */ }
  return true;
}

export function writeAudioScrubPref(on) {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
  } catch { /* private mode */ }
}

// Short audible ticks from the already-loaded <video>/<audio> element.
// Does not decode the whole file into RAM (waveform decode stays skipped on Android video).
export function createAudioScrubber() {
  let lastTime = 0;
  let lastWall = 0;
  let timer = null;
  let element = null;

  const stop = () => {
    if (timer != null) {
      globalThis.clearTimeout(timer);
      timer = null;
    }
    if (element && !element.paused) {
      try { element.pause(); } catch { /* element may have been detached */ }
    }
    element = null;
  };

  return {
    stop,
    move({ mediaEl, timelineTime, volume, muted, playing, enabled }) {
      if (!enabled || playing || muted || !mediaEl || volume <= 0) {
        stop();
        return { blip: false, reason: 'off' };
      }
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const dt = lastWall ? (now - lastWall) / 1000 : 0;
      const delta = Math.abs((Number(timelineTime) || 0) - lastTime);
      lastTime = Number(timelineTime) || 0;
      lastWall = now;
      if (dt > 0 && delta / dt > FAST_SPEED) {
        stop();
        return { blip: false, reason: 'fast' };
      }
      if (timer != null) return { blip: false, reason: 'busy' };
      if (delta < 0.008 && dt < MIN_GAP_MS / 1000) return { blip: false, reason: 'still' };
      element = mediaEl;
      try {
        mediaEl.muted = false;
        mediaEl.volume = Math.max(0, Math.min(1, volume));
        const play = mediaEl.play();
        if (play && typeof play.catch === 'function') play.catch(() => {});
      } catch {
        return { blip: false, reason: 'play' };
      }
      timer = globalThis.setTimeout(() => {
        timer = null;
        if (mediaEl && !mediaEl.paused) {
          try { mediaEl.pause(); } catch { /* ignore */ }
        }
      }, BLIP_MS);
      return { blip: true, reason: 'slow' };
    },
  };
}

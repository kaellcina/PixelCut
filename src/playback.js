// Play/pause decisions and the preview clock. A stopped session ignores late steps so an
// old animation frame cannot keep moving the playhead after pause.

export function togglePlaybackState(playing, time, duration) {
  const limit = Math.max(0, Number.isFinite(duration) ? duration : 0);
  const at = Number.isFinite(time) ? time : 0;
  if (playing) return { playing: false, time: at };
  const atEnd = at >= limit - 0.05;
  return { playing: limit > 0, time: atEnd ? 0 : at };
}

export function playbackStep(startTime, elapsedSeconds, duration) {
  const limit = Math.max(0, Number.isFinite(duration) ? duration : 0);
  const origin = Number.isFinite(startTime) ? startTime : 0;
  const elapsed = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
  const next = origin + elapsed;
  if (next >= limit) return { time: limit, ended: true };
  return { time: Math.max(0, next), ended: false };
}

export function createPlaybackSession() {
  let generation = 0;
  return {
    open() {
      generation += 1;
      const token = generation;
      return {
        step(startTime, elapsedSeconds, duration) {
          if (token !== generation) return null;
          return playbackStep(startTime, elapsedSeconds, duration);
        },
      };
    },
    close() {
      generation += 1;
    },
  };
}

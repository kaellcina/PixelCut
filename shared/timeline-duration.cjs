// Pure timeline duration used by the editor (src/store.js) and Windows FFmpeg export.
// Keep a single implementation so the MP4 length cannot drift from the preview clock.

const MIN_CLIP = 0.1;
const MAX_TRANSITION = 5;

function clipSpeed(clip) {
  const speed = Number(clip && clip.speed);
  return Number.isFinite(speed) && speed > 0.1 ? speed : 1;
}

function clipLength(clip) {
  if (!clip) return 0;
  if (clip.duration != null && clip.text != null) return Math.max(0, clip.duration);
  return Math.max(0, (clip.out - clip.in) / clipSpeed(clip));
}

function transitionRoom(prevClip, clip) {
  if (!prevClip || !clip) return 0.15;
  const prevLen = Math.max(MIN_CLIP, clipLength(prevClip));
  const len = Math.max(MIN_CLIP, clipLength(clip));
  return Math.max(0, Math.min(MAX_TRANSITION, prevLen / 2 - 0.04, len / 2 - 0.04));
}

function transitionOverlap(prevClip, clip) {
  const type = clip && clip.transitionIn && clip.transitionIn.type;
  if (!prevClip || !type || type === 'none') return 0;
  const requested = Number(clip.transitionIn.duration);
  const duration = Number.isFinite(requested) && requested > 0 ? requested : 0.5;
  return Math.min(duration, transitionRoom(prevClip, clip));
}

function videoLayout(videoClips) {
  let t = 0;
  return (videoClips || []).map((c, i) => {
    const length = clipLength(c);
    const overlap = i > 0 ? Math.max(0, transitionOverlap(videoClips[i - 1], c)) : 0;
    const start = Math.max(0, t - overlap);
    const end = start + length;
    t = end;
    return { clip: c, start, end, overlap };
  });
}

function exportDuration(p) {
  const v = videoLayout(p && p.videoClips);
  return v.length ? v[v.length - 1].end : 0;
}

function projectDuration(p) {
  const project = p || {};
  const v = videoLayout(project.videoClips);
  const ends = [v.length ? v[v.length - 1].end : 0];
  (project.textClips || []).forEach((c) => ends.push(c.start + c.duration));
  (project.audioClips || []).forEach((c) => ends.push(c.start + clipLength(c)));
  (project.overlayClips || []).forEach((c) => ends.push(c.start + clipLength(c)));
  return Math.max(0, ...ends);
}

module.exports = {
  MIN_CLIP,
  MAX_TRANSITION,
  clipSpeed,
  clipLength,
  transitionRoom,
  transitionOverlap,
  videoLayout,
  exportDuration,
  projectDuration,
};

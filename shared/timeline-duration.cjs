// Pure timeline duration used by the editor (src/store.js) and Windows FFmpeg export.
// Keep a single implementation so the MP4 length cannot drift from the preview clock.
//
// Transition rule (CapCut / Premiere "center" overlap, not a decorative cut effect):
// - The incoming clip starts D seconds before the outgoing clip ends.
// - Those D seconds play both clips (visual mix + audio acrossfade).
// - Clip in/out points are NOT trimmed. Source length stays the same.
// - Composed duration = sum(clip lengths) − sum(overlaps). That clock is the ruler,
//   the playhead, the preview and the Windows export. The shortening is the overlap,
//   never a silent crop of the media.

const MIN_CLIP = 0.1;
const MAX_TRANSITION = 5;
const MIN_TRANSITION = 0.05;
const DEFAULT_TRANSITION = 0.5;
const TRANSITION_JOIN = 0.02;

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
  if (!prevClip || !clip) return 0;
  const prevLen = Math.max(MIN_CLIP, clipLength(prevClip));
  const len = Math.max(MIN_CLIP, clipLength(clip));
  return Math.max(0, Math.min(MAX_TRANSITION, prevLen / 2 - 0.04, len / 2 - 0.04));
}

function resolveTransitionDuration(requested, room) {
  const space = Math.max(0, Number(room) || 0);
  if (space <= 0) return 0;
  const want = Number(requested);
  const fallback = Number.isFinite(want) && want > 0 ? want : Math.min(DEFAULT_TRANSITION, space);
  const floor = Math.min(0.15, space);
  return Math.min(space, Math.max(floor, fallback));
}

function transitionOverlap(prevClip, clip) {
  const type = clip && clip.transitionIn && clip.transitionIn.type;
  if (!prevClip || !type || type === 'none') return 0;
  const requested = Number(clip.transitionIn.duration);
  const duration = Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_TRANSITION;
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

function overlapTotal(videoClips) {
  const layout = videoLayout(videoClips);
  return layout.reduce((sum, item) => sum + (item.overlap || 0), 0);
}

function clipExclusiveRange(layout, index) {
  const item = layout[index];
  if (!item) return { start: 0, end: 0, length: 0 };
  const next = layout[index + 1];
  const start = item.start + (item.overlap || 0);
  const end = item.end - (next && next.overlap ? next.overlap : 0);
  return { start, end, length: Math.max(0, end - start) };
}

function transitionBand(item) {
  const start = item && Number.isFinite(item.start) ? item.start : 0;
  const overlap = item && item.overlap > 0 ? item.overlap : 0;
  return {
    start,
    end: start + overlap,
    length: overlap,
    cut: start + overlap / 2,
    active: overlap >= TRANSITION_JOIN,
  };
}

function clipLaneWidthPx(seconds, pps) {
  const span = Number(seconds);
  const scale = Number(pps);
  if (!(span > 0) || !(scale > 0)) return 1;
  return Math.max(1, span * scale);
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
  MIN_TRANSITION,
  DEFAULT_TRANSITION,
  TRANSITION_JOIN,
  clipSpeed,
  clipLength,
  transitionRoom,
  resolveTransitionDuration,
  transitionOverlap,
  videoLayout,
  overlapTotal,
  clipExclusiveRange,
  transitionBand,
  clipLaneWidthPx,
  exportDuration,
  projectDuration,
};

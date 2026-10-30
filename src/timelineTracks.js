import { isLinked } from './store.js';
import { textLaneRows } from './textLanes.js';

export function overlayLanes(project) {
  const overlays = project.overlayClips || [];
  return {
    overlay0: overlays.filter((clip) => (clip.lane || 0) === 0),
    overlay1: overlays.filter((clip) => clip.lane === 1),
  };
}

export function visibleTimelineTracks(project, { dragging = false } = {}) {
  const { overlay0, overlay1 } = overlayLanes(project);
  const hasLinked = (project.videoClips || []).some((clip) => isLinked(clip));
  const texts = textLaneRows(project.textClips);
  return {
    video: true,
    linked: hasLinked,
    audio: dragging || (project.audioClips || []).length > 0,
    overlay: dragging || overlay0.length > 0,
    overlay2: dragging || overlay1.length > 0,
    text: dragging || texts.length > 0,
    textRows: texts,
  };
}

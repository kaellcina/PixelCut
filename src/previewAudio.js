// Pure audio planning for the preview (no DOM / Web Audio), tested by scripts/test-editor.cjs.
import { clipLength, clipSpeed, isLinked, videoClipsAt, videoLayout } from './store.js';

export function envelopeVolume(clip, timelineLocal, length) {
  const fadeIn = Math.max(0, clip.fadeIn || 0);
  const fadeOut = Math.max(0, clip.fadeOut || 0);
  const dur = Math.max(0.05, length);
  let gain = clip.muted ? 0 : (clip.volume ?? 1);
  if (fadeIn > 0 && timelineLocal < fadeIn) gain *= Math.max(0, timelineLocal / fadeIn);
  if (fadeOut > 0 && timelineLocal > dur - fadeOut) gain *= Math.max(0, (dur - timelineLocal) / fadeOut);
  return gain;
}

// Effect chain swaps crossfade for SWAP_SECONDS (a cut clicked). A new preset on the same clip
// first keeps the old chain audible for PRIME_SECONDS while the new one fills its buffers (the
// voice worklets output silence at first); a clip change swaps at once so the previous clip's
// effect is never heard on the new one.
export const SWAP_SECONDS = 0.012;
export const PRIME_SECONDS = 0.03;
export const swapHold = (previousKey, key) => (previousKey === key ? PRIME_SECONDS : 0);

const IDLE = { clipId: null, key: 'idle', effects: [], volume: 0, localTime: 0 };

// What each main-track media element (A = current clip, B = clip entering during a transition)
// must play at `time`. Each slot carries its own clip's effect chain; `key` changes whenever the
// element switches clip so the chain is rebuilt instead of carrying state over.
// Volumes follow the export's acrossfade (default linear curves) during the overlap.
export function mainTrackAudio(project, time) {
  const layers = videoClipsAt(project, time);
  const incoming = layers[1];
  const progress = incoming && incoming.overlap > 0
    ? Math.max(0, Math.min(1, (time - incoming.start) / incoming.overlap))
    : null;
  const slot = (layer, gain) => {
    if (!layer) return IDLE;
    const clip = layer.clip;
    const audible = !clip.muted && isLinked(clip);
    return {
      clipId: clip.id,
      key: clip.id,
      effects: audible ? [...(clip.audioEffects || [])] : [],
      volume: audible ? (clip.volume ?? 1) * gain : 0,
      localTime: clip.in + (time - layer.start) * clipSpeed(clip),
    };
  };
  return {
    a: slot(layers[0], progress == null ? 1 : 1 - progress),
    b: slot(incoming, progress ?? 0),
  };
}

// The clip whose audio the "listen" buttons use: the selected music clip, or the selected main
// video clip while its audio is still linked. Anything else returns null (no silent fallback).
export function auditionTarget(project, selection) {
  if (!selection) return null;
  let clip;
  let start;
  let length;
  let baseEffects;
  if (selection.track === 'audio') {
    clip = project.audioClips.find((item) => item.id === selection.id);
    if (!clip) return null;
    start = clip.start;
    length = clipLength(clip);
    baseEffects = clip.effects || [];
  } else if (selection.track === 'video') {
    const item = videoLayout(project.videoClips).find((entry) => entry.clip.id === selection.id);
    if (!item || item.clip.muted || !isLinked(item.clip)) return null;
    clip = item.clip;
    start = item.start;
    length = item.end - item.start;
    baseEffects = clip.audioEffects || [];
  } else {
    return null;
  }
  const media = project.media.find((item) => item.id === clip.mediaId);
  if (!media || media.type === 'image' || media.hasAudio === false) return null;
  return { track: selection.track, clip, media, start, length, baseEffects };
}

// Starts at the playhead when it is inside the clip, otherwise at the clip's first frame.
export function auditionPlan(project, selection, time, effectId, maxSeconds = 4) {
  const target = auditionTarget(project, selection);
  if (!target) return null;
  const { clip, media, start, length, baseEffects, track } = target;
  const inside = time >= start && time < start + length - 0.05;
  const local = inside ? time - start : 0;
  const speed = clipSpeed(clip);
  const effects = baseEffects.includes(effectId) ? [...baseEffects] : [...baseEffects, effectId];
  return {
    clipId: clip.id,
    track,
    mediaPath: media.path,
    mediaName: media.name,
    from: clip.in + local * speed,
    rate: speed,
    seconds: Math.max(0.05, Math.min(maxSeconds, length - local)),
    effects,
    gainAt: (elapsed) => (track === 'audio'
      ? envelopeVolume(clip, local + elapsed, length)
      : (clip.volume ?? 1)),
  };
}

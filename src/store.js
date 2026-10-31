// Project model + reducer (with undo/redo).
//
// The video track is magnetic like CapCut's main track: clips play back to back,
// so their timeline position is derived from order. Text and music clips have a free `start`.
// Transitions overlap neighboring clips (xfade). They do not trim in/out; the composed
// clock is sum(lengths) − sum(overlaps), shared by the ruler, preview and Windows export.

import {
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
  projectDuration,
  exportDuration,
} from '../shared/timeline-duration.cjs';
import { firstFreeTextLane } from './textLanes.js';

export const uid = () => Math.random().toString(36).slice(2, 10);

export {
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
  projectDuration,
  exportDuration,
};

export function emptyProject() {
  return { name: 'Projeto sem título', width: 1280, height: 720, fps: 30, media: [], videoClips: [], overlayClips: [], textClips: [], audioClips: [] };
}

function mainVideoClip(id, media) {
  const duration = Math.max(MIN_CLIP, Number(media.duration) || (media.type === 'image' ? 5 : 1));
  return {
    id,
    mediaId: media.id,
    in: 0,
    out: duration,
    volume: 1,
    muted: media.type !== 'video',
    linkedAudio: media.type === 'video',
    effects: [],
    effectParams: {},
    audioEffects: [],
    speed: 1,
    chroma: { enabled: false, color: '#00ff00', similarity: 0.32 },
  };
}

export function buildProjectFromImportedMedia(items, base = emptyProject()) {
  const media = [];
  const videoClips = [];
  const audioClips = [];
  for (const raw of items || []) {
    if (!raw || raw.error) continue;
    const item = { ...raw, id: raw.id || uid() };
    media.push(item);
    const clipId = uid();
    if (item.type === 'audio') {
      audioClips.push({
        id: clipId,
        mediaId: item.id,
        start: audioClips.reduce((sum, clip) => sum + Math.max(0, (clip.out || 0) - (clip.in || 0)), 0),
        in: 0,
        out: Number(item.duration) || 1,
        volume: 1,
        effects: [],
        fadeIn: 0,
        fadeOut: 0,
        speed: 1,
      });
    } else if (item.type === 'video' || item.type === 'image') {
      videoClips.push(mainVideoClip(clipId, item));
    }
  }
  const firstName = media[0]?.name ? String(media[0].name).replace(/\.[^.]+$/, '') : '';
  return {
    ...base,
    name: firstName || base.name,
    media,
    videoClips,
    overlayClips: [],
    textClips: [],
    audioClips,
  };
}

export function defaultTextClip(id, at, preset = {}) {
  return {
    id,
    text: preset.text || 'Seu texto',
    start: at,
    duration: preset.duration || 3,
    x: preset.x ?? 0.5,
    y: preset.y ?? 0.85,
    size: preset.size ?? 56,
    color: preset.color || '#ffffff',
    font: preset.font || 'montserrat',
    bold: preset.bold ?? true,
    italic: preset.italic ?? false,
    animation: preset.animation || 'fade',
    animationDuration: preset.animationDuration ?? 0.45,
    letterEffect: preset.letterEffect || 'outline',
    layer: preset.layer || 'front',
    lane: Number.isFinite(preset.lane) ? preset.lane : 0,
    strokeColor: '#000000',
    strokeWidth: 2,
    shadowColor: '#000000',
    backgroundColor: 'rgba(0,0,0,0.72)',
  };
}

export function defaultOverlayClip(id, media, at, lane = 0) {
  const length = media.type === 'image' ? 5 : (media.duration || 5);
  return {
    id,
    mediaId: media.id,
    start: at,
    in: 0,
    out: length,
    x: 0.5,
    y: 0.5,
    scale: 1,
    opacity: 1,
    lane,
    layer: 'front',
    chroma: { enabled: false, color: '#00ff00', similarity: 0.32 },
    effects: [],
    effectParams: {},
    volume: 0,
    muted: true,
    speed: 1,
  };
}

// Index where a dragged main-track clip would land. The other clips stay packed, and the
// pointer has to pass a clip's midpoint before the dragged clip swaps with it.
export function videoInsertIndex(clips, movingId, time) {
  const others = videoLayout((clips || []).filter((clip) => clip.id !== movingId));
  const at = Number.isFinite(time) ? time : 0;
  return others.filter((item) => (item.start + item.end) / 2 < at).length;
}

export function videoClipsAt(p, t) {
  const layout = videoLayout(p.videoClips);
  if (!layout.length) return [];
  const hits = layout.filter((l) => t >= l.start && t < l.end);
  if (hits.length) return hits;
  const last = layout[layout.length - 1];
  if (t >= last.end - 1e-4) return [last];
  return [];
}

export function videoClipAt(p, t) {
  const hits = videoClipsAt(p, t);
  return hits[hits.length - 1] || hits[0] || null;
}

export function sourcePreviewTime(clip, timelineTime, layerStart, fps = 30) {
  if (!clip) return 0;
  const start = Number(clip.in) || 0;
  const raw = start + (timelineTime - (layerStart || 0)) * clipSpeed(clip);
  const pad = 1 / Math.max(12, Number(fps) || 30);
  const out = Number.isFinite(clip.out) ? clip.out : raw + pad;
  const span = Math.max(0, out - start);
  const edge = span > pad * 2 ? Math.min(pad, span / 4) : 0;
  const lo = start + edge;
  const hi = Math.max(lo, out - edge);
  return Math.min(Math.max(raw, lo), hi);
}

// A hard cut (no overlap) at t === next.start maps only to the incoming clip, whose
// decoder often shows black at exact `in`. Prefer the last safe frame of the outgoing clip.
export function nudgePreviewTime(p, t) {
  const layout = videoLayout(p?.videoClips);
  if (!layout.length || !Number.isFinite(t)) return t;
  const pad = 1 / Math.max(12, Number(p?.fps) || 30);
  for (let i = 1; i < layout.length; i += 1) {
    const item = layout[i];
    if (item.overlap > 0.02) continue;
    if (Math.abs(t - item.start) <= pad) {
      const before = item.start - pad;
      return before >= layout[i - 1].start ? Math.max(0, before) : Math.min(item.end - pad, item.start + pad);
    }
  }
  return t;
}

export function transitionApplyId(project, selection, time) {
  if (selection?.track === 'transition' && (project.videoClips || []).some((clip) => clip.id === selection.id)) {
    return selection.id;
  }
  return nearestVideoCut(project, time)?.clip.id || null;
}

export function nearestVideoCut(p, t) {
  const layout = videoLayout(p.videoClips);
  if (layout.length < 2) return null;
  let best = null;
  layout.forEach((item, index) => {
    if (index === 0) return;
    const band = transitionBand(item);
    const dist = Math.abs(band.cut - t);
    if (!best || dist < best.dist) best = { dist, index, clip: item.clip, cut: band.cut, prev: layout[index - 1] };
  });
  return best;
}

const TRACKS = { video: 'videoClips', text: 'textClips', audio: 'audioClips', overlay: 'overlayClips' };

export function isLinked(clip) {
  return clip && clip.linkedAudio !== false;
}

function reduceProject(p, a) {
  switch (a.type) {
    case 'load':
      return a.project;
    case 'addMedia':
      return { ...p, media: [...p.media, ...a.items] };
    case 'replaceMedia':
      return {
        ...p,
        media: p.media.map((item) => (item.id === a.item.id ? { ...item, ...a.item, id: item.id, missing: false } : item)),
      };
    case 'removeMedia':
      return {
        ...p,
        media: p.media.filter((m) => m.id !== a.id),
        videoClips: p.videoClips.filter((c) => c.mediaId !== a.id),
        overlayClips: (p.overlayClips || []).filter((c) => c.mediaId !== a.id),
        audioClips: p.audioClips.filter((c) => c.mediaId !== a.id),
      };
    case 'addToTimeline': {
      const m = p.media.find((x) => x.id === a.mediaId);
      if (!m) return p;
      if ((m.type === 'image' || a.track === 'overlay') && a.track !== 'video') {
        const lane = a.lane ?? 0;
        return { ...p, overlayClips: [...(p.overlayClips || []), defaultOverlayClip(a.clipId, m, a.at ?? 0, lane)] };
      }
      if (m.type === 'video' || a.track === 'video') {
        const clips = [...p.videoClips];
        const clip = mainVideoClip(a.clipId, m);
        const index = Number.isInteger(a.toIndex) ? Math.max(0, Math.min(a.toIndex, clips.length)) : clips.length;
        clips.splice(index, 0, clip);
        return { ...p, videoClips: clips };
      }
      return { ...p, audioClips: [...p.audioClips, { id: a.clipId, mediaId: m.id, start: a.at, in: 0, out: m.duration, volume: 1, effects: [], fadeIn: 0, fadeOut: 0, speed: 1 }] };
    }
    case 'moveToTrack': {
      const from = a.from;
      const to = a.to;
      if (from === 'audio' && (to === 'video' || to === 'overlay' || to === 'overlay2' || to === 'text')) return p;
      if (from === 'text' && to !== 'text') return p;
      if (from === 'video' && (to === 'overlay' || to === 'overlay2')) {
        const clip = p.videoClips.find((c) => c.id === a.id);
        const media = p.media.find((item) => item.id === clip?.mediaId);
        if (!clip || !media || media.type === 'audio') return p;
        const layout = videoLayout(p.videoClips).find((item) => item.clip.id === a.id);
        const overlay = defaultOverlayClip(clip.id, media, a.at ?? layout?.start ?? 0, to === 'overlay2' ? 1 : 0);
        overlay.in = clip.in;
        overlay.out = clip.out;
        overlay.effects = clip.effects || [];
        overlay.effectParams = clip.effectParams || {};
        overlay.chroma = clip.chroma;
        overlay.speed = clip.speed || 1;
        overlay.volume = 0;
        overlay.muted = true;
        let audioClips = p.audioClips;
        if (clip.linkedAudio !== false) {
          audioClips = [...audioClips, {
            id: a.audioId || `${clip.id}-a`,
            mediaId: clip.mediaId,
            start: a.at ?? layout?.start ?? 0,
            in: clip.in,
            out: clip.out,
            volume: clip.volume ?? 1,
            effects: clip.audioEffects || [],
            unlinkedFrom: clip.id,
          }];
        }
        return {
          ...p,
          videoClips: p.videoClips.filter((c) => c.id !== a.id),
          overlayClips: [...(p.overlayClips || []), overlay],
          audioClips,
        };
      }
      if (from === 'overlay' && to === 'video') {
        const clip = (p.overlayClips || []).find((c) => c.id === a.id);
        const media = p.media.find((item) => item.id === clip?.mediaId);
        if (!clip || !media || media.type !== 'video') return p;
        const next = {
          id: clip.id, mediaId: clip.mediaId, in: clip.in, out: clip.out, volume: 1, muted: true, linkedAudio: false,
          effects: clip.effects || [], effectParams: clip.effectParams || {}, audioEffects: [], speed: clip.speed || 1,
          chroma: clip.chroma || { enabled: false, color: '#00ff00', similarity: 0.32 },
        };
        const clips = [...p.videoClips];
        const index = Number.isInteger(a.toIndex) ? Math.max(0, Math.min(a.toIndex, clips.length)) : clips.length;
        clips.splice(index, 0, next);
        return { ...p, videoClips: clips, overlayClips: p.overlayClips.filter((c) => c.id !== a.id) };
      }
      if (from === 'overlay' && (to === 'overlay' || to === 'overlay2')) {
        return {
          ...p,
          overlayClips: (p.overlayClips || []).map((c) => (c.id === a.id ? { ...c, lane: to === 'overlay2' ? 1 : 0, start: a.at ?? c.start } : c)),
        };
      }
      return p;
    }
    case 'setName': {
      const name = String(a.name || '').trim();
      return { ...p, name: name || p.name || 'Projeto sem título' };
    }
    case 'setCanvas':
      return { ...p, width: a.width, height: a.height };
    case 'unlinkAudio': {
      const clip = p.videoClips.find((c) => c.id === a.id);
      if (!clip || clip.linkedAudio === false) return p;
      const layout = videoLayout(p.videoClips).find((item) => item.clip.id === a.id);
      const audioClip = {
        id: a.audioId,
        mediaId: clip.mediaId,
        start: layout ? layout.start : 0,
        in: clip.in,
        out: clip.out,
        volume: clip.volume ?? 1,
        effects: clip.audioEffects || [],
        fadeIn: 0,
        fadeOut: 0,
        speed: 1,
        unlinkedFrom: clip.id,
      };
      return {
        ...p,
        videoClips: p.videoClips.map((c) => (c.id === a.id ? { ...c, muted: true, linkedAudio: false } : c)),
        audioClips: [...p.audioClips, audioClip],
      };
    }
    case 'setName': {
      const name = String(a.name ?? '').trim() || p.name;
      if (name === p.name) return p;
      return { ...p, name };
    }
    case 'addText': {
      const preset = { ...(a.preset || {}) };
      if (!Number.isFinite(preset.lane)) {
        preset.lane = firstFreeTextLane(p.textClips, a.at, preset.duration || 3);
      }
      return { ...p, textClips: [...p.textClips, defaultTextClip(a.clipId, a.at, preset)] };
    }
    case 'toggleEffect': {
      const key = a.track === 'overlay' ? 'overlayClips' : 'videoClips';
      return {
        ...p,
        [key]: (p[key] || []).map((c) => {
          if (c.id !== a.id) return c;
          const effects = c.effects || [];
          const next = effects.includes(a.effect) ? effects.filter((id) => id !== a.effect) : [...effects, a.effect];
          return { ...c, effects: next };
        }),
      };
    }
    case 'toggleAudioEffect': {
      const key = a.track === 'video' ? 'videoClips' : 'audioClips';
      const field = a.track === 'video' ? 'audioEffects' : 'effects';
      return {
        ...p,
        [key]: p[key].map((c) => {
          if (c.id !== a.id) return c;
          const effects = c[field] || [];
          const next = effects.includes(a.effect) ? effects.filter((id) => id !== a.effect) : [...effects, a.effect];
          return { ...c, [field]: next };
        }),
      };
    }
    case 'setTransition': {
      return {
        ...p,
        videoClips: p.videoClips.map((c) => {
          if (c.id !== a.id) return c;
          if (!a.transition) return { ...c, transitionIn: null };
          const index = p.videoClips.findIndex((item) => item.id === c.id);
          if (index <= 0) return c;
          const room = transitionRoom(p.videoClips[index - 1], c);
          const duration = resolveTransitionDuration(a.transition.duration, room);
          if (duration < MIN_TRANSITION && room < MIN_TRANSITION) {
            return { ...c, transitionIn: { type: a.transition.type, duration: room } };
          }
          return { ...c, transitionIn: { type: a.transition.type, duration } };
        }),
      };
    }
    case 'update': {
      const key = TRACKS[a.track];
      if (!key) return p;
      return { ...p, [key]: p[key].map((c) => (c.id === a.id ? { ...c, ...a.patch } : c)) };
    }
    case 'delete': {
      if (a.track === 'transition') {
        return { ...p, videoClips: p.videoClips.map((c) => (c.id === a.id ? { ...c, transitionIn: null } : c)) };
      }
      const key = TRACKS[a.track];
      if (!key) return p;
      return { ...p, [key]: p[key].filter((c) => c.id !== a.id) };
    }
    case 'moveVideo': {
      const from = p.videoClips.findIndex((c) => c.id === a.id);
      if (from < 0) return p;
      const toIndex = Math.max(0, Math.min(a.toIndex, p.videoClips.length - 1));
      if (from === toIndex) return p;
      const list = [...p.videoClips];
      const [c] = list.splice(from, 1);
      list.splice(toIndex, 0, c);
      return { ...p, videoClips: list };
    }
    case 'split':
      return splitAt(p, a.track, a.id, a.t, a.newId);
    default:
      return p;
  }
}

function splitAt(p, track, id, t, newId) {
  if (track === 'video') {
    const l = videoLayout(p.videoClips).find((x) => x.clip.id === id);
    if (!l || t - l.start < MIN_CLIP || l.end - t < MIN_CLIP) return p;
    const cut = l.clip.in + (t - l.start) * clipSpeed(l.clip);
    const list = [];
    p.videoClips.forEach((c) => {
      if (c.id !== id) return list.push(c);
      list.push({ ...c, out: cut }, { ...c, id: newId, in: cut, transitionIn: null });
    });
    return { ...p, videoClips: list };
  }
  if (track === 'overlay') {
    const c = (p.overlayClips || []).find((x) => x.id === id);
    const len = c ? clipLength(c) : 0;
    if (!c || t - c.start < MIN_CLIP || c.start + len - t < MIN_CLIP) return p;
    const cut = c.in + (t - c.start) * clipSpeed(c);
    return {
      ...p,
      overlayClips: p.overlayClips.flatMap((x) => (x.id !== id ? [x] : [{ ...x, out: cut }, { ...x, id: newId, start: t, in: cut }])),
    };
  }
  if (track === 'audio') {
    const c = p.audioClips.find((x) => x.id === id);
    const len = c ? clipLength(c) : 0;
    if (!c || t - c.start < MIN_CLIP || c.start + len - t < MIN_CLIP) return p;
    const cut = c.in + (t - c.start) * clipSpeed(c);
    return {
      ...p,
      audioClips: p.audioClips.flatMap((x) => (x.id !== id ? [x] : [{ ...x, out: cut }, { ...x, id: newId, start: t, in: cut }])),
    };
  }
  if (track === 'text') {
    const c = p.textClips.find((x) => x.id === id);
    if (!c || t - c.start < MIN_CLIP || c.start + c.duration - t < MIN_CLIP) return p;
    return {
      ...p,
      textClips: p.textClips.flatMap((x) =>
        x.id !== id ? [x] : [{ ...x, duration: t - x.start }, { ...x, id: newId, start: t, duration: x.start + x.duration - t }]
      ),
    };
  }
  return p;
}

export function historyReducer(state, a) {
  if (a.type === 'undo') {
    if (!state.past.length) return state;
    return { past: state.past.slice(0, -1), present: state.past[state.past.length - 1], future: [state.present, ...state.future] };
  }
  if (a.type === 'redo') {
    if (!state.future.length) return state;
    return { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1) };
  }
  if (a.type === 'beginGesture') return { ...state, gestureStart: state.present };
  if (a.type === 'endGesture') {
    const start = state.gestureStart;
    if (!start || start === state.present) return { ...state, gestureStart: null };
    return { past: [...state.past, start].slice(-100), present: state.present, future: [], gestureStart: null };
  }
  if (a.type === 'cancelGesture') {
    const start = state.gestureStart;
    if (!start) return { ...state, gestureStart: null };
    return { ...state, present: start, gestureStart: null };
  }
  const next = reduceProject(state.present, a);
  if (next === state.present) return state;
  if (a.type === 'load') return { past: [], present: next, future: [] };
  if (a.type === 'setName') return { ...state, present: next };
  if (a.transient || state.gestureStart) return { ...state, present: next };
  return { past: [...state.past, state.present].slice(-100), present: next, future: [] };
}

export function toFileUrl(p) {
  if (!p || typeof p !== 'string') return '';
  if (/^(blob:|data:|https?:|capacitor:|content:)/i.test(p)) return p;
  if (p.startsWith('/') && typeof window !== 'undefined' && typeof window.Capacitor?.convertFileSrc === 'function') {
    const converted = window.Capacitor.convertFileSrc(p);
    if (converted && converted !== p && /^(https?:|capacitor:|content:)/i.test(converted)) return converted;
    const prefixed = window.Capacitor.convertFileSrc(`file://${p}`);
    if (prefixed && prefixed !== p && /^(https?:|capacitor:|content:)/i.test(prefixed)) return prefixed;
  }
  const parts = p.replace(/\\/g, '/').split('/');
  return 'file:///' + parts.map((s, i) => (i === 0 && /^[a-zA-Z]:$/.test(s) ? s : encodeURIComponent(s))).join('/');
}

export function clampPlayhead(time, duration) {
  const limit = Math.max(0, Number.isFinite(duration) ? duration : 0);
  const value = Number.isFinite(time) ? time : 0;
  return Math.min(Math.max(0, value), limit);
}

export function formatTime(t) {
  const safe = Number.isFinite(t) ? Math.max(0, t) : 0;
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const f = Math.floor((safe % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(f).padStart(2, '0')}`;
}

export function parseTime(text) {
  const parts = String(text ?? '').trim().split(':').map((part) => part.trim().replace(',', '.'));
  if (!parts.length || parts.some((part) => !/^\d+(\.\d+)?$/.test(part))) return null;
  const nums = parts.map(Number);
  if (nums.some((value) => !Number.isFinite(value))) return null;
  if (nums.length === 1) return nums[0];
  if (nums.length === 2) return nums[0] * 60 + nums[1];
  if (nums.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2];
  return null;
}

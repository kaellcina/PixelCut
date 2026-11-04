// Translates the real project into the main-track composition Android can encode.
// The magnetic timeline lives in store.js. Packed transition overlap is encoded
// with Media3 (two sequences + compositor). Hard cuts stay concatenations.
// Effects the encoder still skips are listed as warnings, never as exported fields.

import { clipLength, clipSpeed, isLinked, TRANSITION_JOIN, videoLayout } from '../store.js';
import { mediaOwnedPath } from './mediaPath.js';

export const ENCODED_TRANSITIONS = Object.freeze([
  'dissolve',
  'fadeblack',
  'fadewhite',
  'wipeleft',
  'wiperight',
  'wipeup',
  'wipedown',
]);

const ENCODED = new Set(ENCODED_TRANSITIONS);
const ANDROID_EFFECTS = new Set(['blur', 'bw', 'noir', 'mirror', 'vivid', 'cold', 'glow', 'dream', 'night', 'teal', 'bleach', 'cartoon']);

export const EXPORT_LIMITS = {
  transition: 'Esta transição sai como dissolver no arquivo Android. A prévia no editor continua com o efeito original.',
  wipe: 'Wipe ←/→/↑/↓ sai como corte seco no arquivo Android. A prévia no editor continua com o efeito original.',
  fadeThrough: 'Fade preto e Flash alteram o clipe de saída, mas o clipe de entrada ainda aparece de uma vez. A prévia no editor continua com o efeito original.',
  effect: 'Os efeitos visuais da faixa principal não entram no arquivo.',
  chroma: 'O chroma key não entra no arquivo.',
  overlay: 'Sobreposições de vídeo ainda não entram no arquivo Android. Sobreposições de imagem são mantidas.',
  voice: 'Os efeitos de voz não entram no arquivo. O áudio original sai sem tratamento, ou é removido se o clipe estiver mudo.',
};

function evenDimension(value) {
  const n = Math.max(2, Math.round(Number(value) || 2));
  return n % 2 === 0 ? n : n - 1;
}

function mediaName(media) {
  return media?.name || 'Mídia';
}

function encodedType(type) {
  if (!type || type === 'none') return null;
  return ENCODED.has(type) ? type : 'dissolve';
}

function visualEffectsFor(clip, warnings) {
  const stages = [];
  const params = clip.effectParams || {};
  const ids = Array.isArray(clip.effects) ? clip.effects : [];
  const blur = (Number(params.blur) || 0) + (ids.includes('blur') ? 4 : 0);
  if (blur > 0) stages.push({ type: 'blur', sigma: Math.max(0.2, blur / 2) });
  if (Number(params.brightness)) stages.push({ type: 'brightness', amount: Math.max(-1, Math.min(1, Number(params.brightness))) });
  if (Number(params.contrast)) stages.push({ type: 'contrast', amount: Math.max(-0.99, Math.min(1, Number(params.contrast))) });
  if (Number(params.saturation)) stages.push({ type: 'hsl', saturation: Math.max(-100, Math.min(100, Number(params.saturation) * 100)) });
  ids.forEach((id) => {
    if (!ANDROID_EFFECTS.has(id)) {
      warnings.add(EXPORT_LIMITS.effect);
      return;
    }
    if (id === 'blur') return;
    if (id === 'bw' || id === 'noir') stages.push({ type: 'hsl', saturation: -100 });
    else if (id === 'mirror') stages.push({ type: 'mirror' });
    else if (id === 'vivid') stages.push({ type: 'hsl', saturation: 45 }, { type: 'contrast', amount: 0.1 });
    else if (id === 'cold') stages.push({ type: 'hsl', hue: -14, saturation: -8 }, { type: 'brightness', amount: 0.03 });
    else if (id === 'glow') stages.push({ type: 'brightness', amount: 0.06 }, { type: 'contrast', amount: 0.05 });
    else if (id === 'dream') stages.push({ type: 'blur', sigma: 0.55 }, { type: 'brightness', amount: 0.06 }, { type: 'contrast', amount: 0.05 });
    else if (id === 'night') stages.push({ type: 'hsl', hue: -20, saturation: -35 }, { type: 'brightness', amount: -0.16 }, { type: 'contrast', amount: 0.08 });
    else if (id === 'teal') stages.push({ type: 'hsl', saturation: 20 }, { type: 'contrast', amount: 0.12 });
    else if (id === 'bleach') stages.push({ type: 'hsl', saturation: -45 }, { type: 'contrast', amount: 0.3 });
    else if (id === 'cartoon') stages.push({ type: 'hsl', saturation: 40 }, { type: 'contrast', amount: 0.35 });
  });
  return stages;
}

export function planMainExport(project) {
  const clips = project?.videoClips || [];
  if (!clips.length) {
    throw new Error('Adicione um vídeo à faixa principal antes de exportar.');
  }
  const mediaById = new Map((project.media || []).map((item) => [item.id, item]));
  const warnings = new Set();

  const joinMs = Math.round(TRANSITION_JOIN * 1000);
  const layout = videoLayout(clips);
  const items = layout.map(({ clip, start, end, overlap }, index) => {
    const media = mediaById.get(clip.mediaId);
    if (!media) throw new Error('Um clipe da faixa principal perdeu a mídia.');
    const source = mediaOwnedPath(media) || media.source || '';
    if (!source) {
      throw new Error(`“${mediaName(media)}” não está salvo no aparelho. Importe o arquivo de novo.`);
    }
    if (media.type !== 'video' && media.type !== 'image') {
      throw new Error(`“${mediaName(media)}” não pode ir para a faixa principal.`);
    }
    const speed = clipSpeed(clip);
    const inSec = Number(clip.in) || 0;
    const outSec = Number(clip.out);
    if (!(outSec > inSec)) throw new Error(`“${mediaName(media)}” tem um corte inválido.`);
    const shownMs = Math.max(1, Math.round(clipLength(clip) * 1000));
    const visualEffects = visualEffectsFor(clip, warnings);
    if (clip.chroma?.enabled) warnings.add(EXPORT_LIMITS.chroma);
    if (clip.audioEffects?.length) warnings.add(EXPORT_LIMITS.voice);

    const volume = Number(clip.volume);
    const volumeKnown = Number.isFinite(volume);
    const keepAudio = media.type === 'video'
      && media.hasAudio !== false
      && !clip.muted
      && isLinked(clip)
      && (!volumeKnown || volume > 0);
    const audioGain = keepAudio ? Math.min(2, Math.max(0, volumeKnown ? volume : 1)) : 0;

    const requested = clip.transitionIn?.type && clip.transitionIn.type !== 'none' ? clip.transitionIn.type : null;
    const overlapMs = Math.round((overlap || 0) * 1000);
    const encode = overlapMs >= joinMs ? encodedType(requested) : null;
    if (requested && encode === 'dissolve' && !ENCODED.has(requested)) warnings.add(EXPORT_LIMITS.transition);

    const startMs = Math.round(start * 1000);
    const endMs = Math.round(end * 1000);
    const common = {
      source,
      name: mediaName(media),
      startMs,
      endMs,
      durationMs: shownMs,
      overlapMs: encode ? overlapMs : 0,
      transition: encode,
      sequence: index % 2,
      fadeInMs: 0,
      fadeOutMs: 0,
      visualEffects,
      zoomPreset: clip.zoom?.preset || 'none',
      zoomFrom: Math.max(1, Number(clip.zoom?.from) || 1),
      zoomTo: Math.max(1, Number(clip.zoom?.to) || Number(clip.zoom?.from) || 1),
      zoomDurationMs: Math.max(50, Math.round((Number(clip.zoom?.duration) || 1) * 1000)),
    };

    if (media.type === 'image') {
      return {
        ...common,
        type: 'image',
        inMs: 0,
        outMs: shownMs,
        speed: 1,
        keepAudio: false,
      };
    }
    return {
      ...common,
      type: 'video',
      inMs: Math.round(inSec * 1000),
      outMs: Math.round(outSec * 1000),
      speed,
      keepAudio,
      audioGain,
    };
  });

  items.forEach((item, index) => {
    const next = index + 1 < items.length ? items[index + 1] : null;
    item.fadeInType = item.transition;
    item.fadeOutType = next && next.transition ? next.transition : null;
    item.fadeInMs = item.overlapMs || 0;
    item.fadeOutMs = next ? (next.overlapMs || 0) : 0;
  });

  const transitions = items
    .map((item, index) => {
      if (!item.transition || index === 0) return null;
      return {
        startMs: item.startMs,
        endMs: item.startMs + item.overlapMs,
        durationMs: item.overlapMs,
        type: item.transition,
        incomingIndex: index,
        outgoingIndex: index - 1,
        overlayIncoming: index % 2 === 1,
      };
    })
    .filter(Boolean);

  const audioItems = (project.audioClips || []).map((clip) => {
    const media = mediaById.get(clip.mediaId);
    if (!media) throw new Error('Um clipe de áudio perdeu a mídia.');
    const source = mediaOwnedPath(media) || media.source || '';
    if (!source) throw new Error(`“${mediaName(media)}” não está salvo no aparelho. Importe o arquivo de novo.`);
    const inSec = Number(clip.in) || 0;
    const outSec = Number(clip.out);
    if (!(outSec > inSec)) throw new Error(`“${mediaName(media)}” tem um corte de áudio inválido.`);
    const speed = clipSpeed(clip);
    const durationMs = Math.max(1, Math.round(clipLength(clip) * 1000));
    const volume = Number(clip.volume);
    const audioGain = Math.min(2, Math.max(0, Number.isFinite(volume) ? volume : 1));
    const fadeInMs = Math.min(durationMs, Math.max(0, Math.round((Number(clip.fadeIn) || 0) * 1000)));
    const fadeOutMs = Math.min(durationMs, Math.max(0, Math.round((Number(clip.fadeOut) || 0) * 1000)));
    if (clip.effects?.length) warnings.add(EXPORT_LIMITS.voice);
    return {
      source,
      name: mediaName(media),
      type: 'audio',
      startMs: Math.max(0, Math.round((Number(clip.start) || 0) * 1000)),
      durationMs,
      inMs: Math.round(inSec * 1000),
      outMs: Math.round(outSec * 1000),
      speed,
      audioGain,
      fadeInMs,
      fadeOutMs,
    };
  });

  const overlayItems = (project.overlayClips || []).flatMap((clip) => {
    const media = mediaById.get(clip.mediaId);
    if (!media) throw new Error('Uma sobreposição perdeu a mídia.');
    if (media.type !== 'image') {
      warnings.add(EXPORT_LIMITS.overlay);
      return [];
    }
    const source = mediaOwnedPath(media) || media.source || '';
    if (!source) throw new Error(`“${mediaName(media)}” não está salvo no aparelho. Importe o arquivo de novo.`);
    if (clip.chroma?.enabled) warnings.add(EXPORT_LIMITS.chroma);
    if (clip.effects?.length) warnings.add(EXPORT_LIMITS.effect);
    const durationMs = Math.max(50, Math.round(clipLength(clip) * 1000));
    const enter = clip.enter || {};
    const zoom = clip.zoom || {};
    return [{
      source,
      name: mediaName(media),
      startMs: Math.max(0, Math.round((Number(clip.start) || 0) * 1000)),
      durationMs,
      x: Math.min(1, Math.max(0, Number.isFinite(Number(clip.x)) ? Number(clip.x) : 0.5)),
      y: Math.min(1, Math.max(0, Number.isFinite(Number(clip.y)) ? Number(clip.y) : 0.5)),
      scale: Math.min(4, Math.max(0.05, Number(clip.scale) || 1)),
      opacity: Math.min(1, Math.max(0, Number.isFinite(Number(clip.opacity)) ? Number(clip.opacity) : 1)),
      enterType: enter.type || 'none',
      enterDurationMs: Math.max(50, Math.round((Number(enter.duration) || 0.6) * 1000)),
      enterScale: Math.min(1, Math.max(0.05, Number(enter.scale) || 0.85)),
      zoomPreset: zoom.preset || 'none',
      zoomFrom: Math.max(0.01, Number(zoom.from) || 1),
      zoomTo: Math.max(0.01, Number(zoom.to) || Number(zoom.from) || 1),
      zoomDurationMs: Math.max(50, Math.round((Number(zoom.duration) || 1) * 1000)),
      layer: clip.layer || 'front',
      lane: Number(clip.lane) || 0,
    }];
  });

  const textItems = (project.textClips || []).map((clip) => {
    const animation = clip.animation || 'none';
    return {
      text: String(clip.text || ''),
      startMs: Math.max(0, Math.round((Number(clip.start) || 0) * 1000)),
      durationMs: Math.max(50, Math.round((Number(clip.duration) || 0.05) * 1000)),
      x: Math.min(1, Math.max(0, Number.isFinite(Number(clip.x)) ? Number(clip.x) : 0.5)),
      y: Math.min(1, Math.max(0, Number.isFinite(Number(clip.y)) ? Number(clip.y) : 0.85)),
      size: Math.min(512, Math.max(8, Number(clip.size) || 48)),
      color: clip.color || '#ffffff',
      font: clip.font || 'montserrat',
      bold: clip.bold !== false,
      italic: Boolean(clip.italic),
      animation,
      animationDurationMs: Math.max(50, Math.round((Number(clip.animationDuration) || 0.45) * 1000)),
      letterEffect: clip.letterEffect || 'outline',
      strokeColor: clip.strokeColor || '#000000',
      strokeWidth: Math.min(24, Math.max(1, Number(clip.strokeWidth) || 2)),
      shadowColor: clip.shadowColor || '#000000',
      backgroundColor: clip.backgroundColor || 'rgba(0,0,0,0.72)',
      layer: clip.layer || 'front',
      lane: Number(clip.lane) || 0,
    };
  });

  const mainEnd = layout.length ? layout[layout.length - 1].end : 0;
  const audioEnd = (project.audioClips || []).reduce(
    (end, clip) => Math.max(end, (Number(clip.start) || 0) + clipLength(clip)),
    0,
  );
  const textEnd = (project.textClips || []).reduce(
    (end, clip) => Math.max(end, (Number(clip.start) || 0) + Math.max(0.05, Number(clip.duration) || 0.05)),
    0,
  );
  const overlayEndMs = overlayItems.reduce((end, clip) => Math.max(end, clip.startMs + clip.durationMs), 0);
  const timelineMs = Math.max(Math.round(Math.max(mainEnd, audioEnd, textEnd) * 1000), overlayEndMs);
  return {
    width: evenDimension(project.width || 1280),
    height: evenDimension(project.height || 720),
    fps: Math.min(60, Math.max(1, Math.round(Number(project.fps) || 30))),
    items,
    audioItems,
    overlayItems,
    textItems,
    transitions,
    composeOverlaps: transitions.length > 0,
    durationMs: timelineMs,
    timelineMs,
    warnings: [...warnings],
  };
}

/** Limitations that must be shown before Android export starts — not only after the MP4 exists. */
export function androidVisualTransitionWarnings(warnings = []) {
  return warnings.filter((note) => note === EXPORT_LIMITS.wipe || note === EXPORT_LIMITS.fadeThrough);
}

// Translates the real project into the main-track composition Android can encode.
// The magnetic timeline lives in store.js. Packed transition overlap is encoded
// with Media3 (two sequences + compositor). Hard cuts stay concatenations.
// Effects the encoder still skips are listed as warnings, never as exported fields.

import { clipLength, clipSpeed, exportDuration, isLinked, TRANSITION_JOIN, videoLayout } from '../store.js';
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

export const EXPORT_LIMITS = {
  transition: 'Esta transição sai como dissolver no arquivo Android. A prévia no editor continua com o efeito original.',
  wipe: 'Wipe ←/→/↑/↓ sai como corte seco no arquivo Android. A prévia no editor continua com o efeito original.',
  fadeThrough: 'Fade preto e Flash alteram o clipe de saída, mas o clipe de entrada ainda aparece de uma vez. A prévia no editor continua com o efeito original.',
  effect: 'Os efeitos visuais da faixa principal não entram no arquivo.',
  zoom: 'O zoom não entra no arquivo.',
  chroma: 'O chroma key não entra no arquivo.',
  overlay: 'As faixas de sobreposição não entram no arquivo.',
  text: 'Os textos não entram no arquivo.',
  audioTrack: 'A faixa de áudio separada não entra no arquivo. Só o áudio ligado ao vídeo da faixa principal é mantido.',
  volume: 'O volume diferente de 100% não é aplicado. O áudio sai no nível original, ou é removido se estiver mudo.',
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

export function planMainExport(project) {
  const clips = project?.videoClips || [];
  if (!clips.length) {
    throw new Error('Adicione um vídeo à faixa principal antes de exportar.');
  }
  const mediaById = new Map((project.media || []).map((item) => [item.id, item]));
  const warnings = new Set();
  if ((project.overlayClips || []).length) warnings.add(EXPORT_LIMITS.overlay);
  if ((project.textClips || []).length) warnings.add(EXPORT_LIMITS.text);
  if ((project.audioClips || []).length) warnings.add(EXPORT_LIMITS.audioTrack);

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
    if (clip.effects?.length) warnings.add(EXPORT_LIMITS.effect);
    if (clip.zoom) warnings.add(EXPORT_LIMITS.zoom);
    if (clip.chroma?.enabled) warnings.add(EXPORT_LIMITS.chroma);
    if (clip.audioEffects?.length) warnings.add(EXPORT_LIMITS.voice);
    if (media.type === 'video' && !isLinked(clip)) warnings.add(EXPORT_LIMITS.audioTrack);

    const volume = Number(clip.volume);
    const volumeKnown = Number.isFinite(volume);
    const keepAudio = media.type === 'video'
      && media.hasAudio !== false
      && !clip.muted
      && isLinked(clip)
      && (!volumeKnown || volume > 0);
    if (keepAudio && volumeKnown && Math.abs(volume - 1) > 0.001) warnings.add(EXPORT_LIMITS.volume);

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

  const timelineMs = Math.round(exportDuration(project) * 1000);
  return {
    width: evenDimension(project.width || 1280),
    height: evenDimension(project.height || 720),
    fps: Math.min(60, Math.max(1, Math.round(Number(project.fps) || 30))),
    items,
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

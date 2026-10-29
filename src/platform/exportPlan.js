// Translates the real project into the main-track composition Android can encode.
// The magnetic timeline lives in store.js. This module does not invent tracks,
// does not shorten clips to imitate a transition, and does not claim an effect
// was exported when the native encoder leaves it out.

import { clipLength, clipSpeed, exportDuration, isLinked, videoLayout } from '../store.js';
import { mediaOwnedPath } from './mediaPath.js';

export const EXPORT_LIMITS = {
  transition: 'As transições não entram no arquivo. Os clipes da faixa principal são unidos em corte seco, cada um com a duração integral.',
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

  const items = videoLayout(clips).map(({ clip }) => {
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
    if (clip.transitionIn?.type && clip.transitionIn.type !== 'none') warnings.add(EXPORT_LIMITS.transition);
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

    if (media.type === 'image') {
      return {
        source,
        name: mediaName(media),
        type: 'image',
        inMs: 0,
        outMs: shownMs,
        durationMs: shownMs,
        speed: 1,
        keepAudio: false,
      };
    }
    return {
      source,
      name: mediaName(media),
      type: 'video',
      inMs: Math.round(inSec * 1000),
      outMs: Math.round(outSec * 1000),
      durationMs: shownMs,
      speed,
      keepAudio,
    };
  });

  const durationMs = items.reduce((sum, item) => sum + item.durationMs, 0);
  return {
    width: evenDimension(project.width || 1280),
    height: evenDimension(project.height || 720),
    fps: Math.min(60, Math.max(1, Math.round(Number(project.fps) || 30))),
    items,
    durationMs,
    timelineMs: Math.round(exportDuration(project) * 1000),
    warnings: [...warnings],
  };
}

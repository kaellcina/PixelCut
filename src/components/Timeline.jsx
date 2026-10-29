import React, { useEffect, useRef, useState } from 'react';
import { MIN_CLIP, clipLength, formatTime, isLinked, toFileUrl, uid, videoInsertIndex, videoLayout } from '../store.js';
import { TimeField } from './Preview.jsx';
import { captureMediaFrames, frameAt, prefetchFilmstrips } from '../filmstrip.js';
import { transitionById } from '../catalog.js';
import { drawWaveform, loadWaveform } from '../waveform.js';

const HEADER = 48;
const PPS_MIN = 8;
const PPS_MAX = 420;

export default function Timeline({ project, time, duration, playing, selection, onSelect, onSeek, onSeekLive, onPause, dispatch, onSplit, onDelete, onAddText, onDropMedia, onDropEffect, onDropTransition, onUnlink, onDropAudioEffect, onImport, touch = false, onAdjust = null, onBrowse = null }) {
  const [pps, setPps] = useState(56);
  const [dragOverTrack, setDragOverTrack] = useState(null);
  const [emptyHint, setEmptyHint] = useState('');
  const [scrubbing, setScrubbing] = useState(false);
  const [movingId, setMovingId] = useState(null);
  const [dragDx, setDragDx] = useState(0);
  const scrollRef = useRef(null);
  const gestureRef = useRef(null);
  const followPlayhead = useRef(false);
  const followLock = useRef(false);
  const pendingScroll = useRef(null);
  const autoScrollTimer = useRef(0);
  const projectRef = useRef(project);
  const ppsRef = useRef(pps);
  projectRef.current = project;
  ppsRef.current = pps;
  const mediaById = Object.fromEntries(project.media.map((item) => [item.id, item]));
  const layout = videoLayout(project.videoClips);
  const overlays = project.overlayClips || [];
  const isEmpty = !project.videoClips.length && !project.textClips.length && !project.audioClips.length && !overlays.length;
  const head = touch ? 64 : HEADER;
  const width = Math.max((duration + 8) * pps, 720);
  const selectedVideo = selection?.track === 'video' && project.videoClips.find((clip) => clip.id === selection.id);
  const canUnlink = selectedVideo && isLinked(selectedVideo);

  useEffect(() => {
    prefetchFilmstrips(project.media);
  }, [project.media]);

  useEffect(() => () => {
    gestureRef.current?.stop({ type: 'blur' });
  }, []);

  const timeFromClientX = (clientX) => {
    const rect = scrollRef.current.getBoundingClientRect();
    return Math.max(0, (clientX - rect.left - head + scrollRef.current.scrollLeft) / ppsRef.current);
  };
  const timeFromEvent = (event) => timeFromClientX(event.clientX);

  const trackFromY = (clientY) => {
    const rows = scrollRef.current?.querySelectorAll('[data-track]');
    if (!rows) return null;
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) return row.dataset.track;
    }
    return null;
  };

  const zoomTo = (next, anchorTime) => {
    const clamped = clamp(next, PPS_MIN, PPS_MAX);
    const scroller = scrollRef.current;
    const keep = Number.isFinite(anchorTime) ? anchorTime : time;
    setPps(clamped);
    requestAnimationFrame(() => {
      if (!scroller) return;
      scroller.dataset.autoscroll = '1';
      const local = keep * clamped - (scroller.clientWidth - head) * 0.42;
      scroller.scrollLeft = Math.max(0, local);
      requestAnimationFrame(() => { scroller.dataset.autoscroll = ''; });
    });
  };

  const fitZoom = () => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const span = Math.max(duration || 0, 4);
    const next = clamp((scroller.clientWidth - head - 24) / span, PPS_MIN, PPS_MAX);
    setPps(next);
    requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      scrollRef.current.dataset.autoscroll = '1';
      scrollRef.current.scrollLeft = 0;
      requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.dataset.autoscroll = ''; });
    });
  };

  useEffect(() => {
    followPlayhead.current = !!playing;
    if (!playing) followLock.current = false;
  }, [playing]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !playing || !followPlayhead.current) return;
    const playX = head + time * pps;
    const viewLeft = node.scrollLeft;
    const viewRight = viewLeft + node.clientWidth;
    const edge = Math.max(48, node.clientWidth * 0.18);
    const inside = playX > viewLeft + 24 && playX < viewRight - edge;
    if (followLock.current) {
      if (inside) followLock.current = false;
      return;
    }
    if (playX <= viewRight - edge) return;
    const target = Math.max(0, playX - node.clientWidth * 0.35);
    if (Math.abs(target - viewLeft) < 8) return;
    followLock.current = true;
    pendingScroll.current = target;
    node.dataset.autoscroll = '1';
    node.scrollTo({ left: target, behavior: 'smooth' });
    window.clearTimeout(autoScrollTimer.current);
    autoScrollTimer.current = window.setTimeout(() => { node.dataset.autoscroll = ''; }, 900);
  }, [time, playing, pps]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return undefined;
    const onScroll = () => {
      if (node.dataset.autoscroll === '1') return;
      if (pendingScroll.current != null && Math.abs(node.scrollLeft - pendingScroll.current) < 16) return;
      pendingScroll.current = null;
      followPlayhead.current = false;
    };
    node.addEventListener('scroll', onScroll, { passive: true });
    return () => node.removeEventListener('scroll', onScroll);
  }, [isEmpty]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return undefined;
    const onWheel = (event) => {
      if (!event.ctrlKey && !event.altKey) return;
      event.preventDefault();
      const at = timeFromClientX(event.clientX);
      zoomTo(pps * (event.deltaY < 0 ? 1.14 : 0.88), at);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [pps, isEmpty]);

  useEffect(() => {
    if (!isEmpty) setEmptyHint('');
  }, [isEmpty]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && gestureRef.current) {
        event.preventDefault();
        event.stopPropagation();
        gestureRef.current.stop({ type: 'cancel' });
        return;
      }
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
      if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomTo(pps * 1.18, time); }
      if (event.key === '-' || event.key === '_') { event.preventDefault(); zoomTo(pps / 1.18, time); }
      if (event.key === '\\') { event.preventDefault(); fitZoom(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pps, time, duration]);

  const snap = (value) => {
    const threshold = 10 / pps;
    const targets = [0, time];
    layout.forEach((item) => { targets.push(item.start, item.end); });
    project.audioClips.forEach((clip) => { targets.push(clip.start, clip.start + clipLength(clip)); });
    (project.overlayClips || []).forEach((clip) => { targets.push(clip.start, clip.start + clipLength(clip)); });
    let best = value;
    let dist = threshold;
    targets.forEach((target) => {
      const delta = Math.abs(target - value);
      if (delta < dist) { dist = delta; best = target; }
    });
    return Math.max(0, best);
  };

  const projectTime = (clientX) => clamp(timeFromClientX(clientX), 0, Math.max(0, duration));

  const arm = (event, finish, { capture = true } = {}) => {
    if (gestureRef.current) return null;
    const pointerId = event.pointerId;
    let settled = false;
    const session = {
      move: null,
      stop: (stopEvent) => {
        if (settled) return;
        if (stopEvent?.type !== 'blur' && stopEvent?.type !== 'cancel' && stopEvent?.pointerId != null && stopEvent.pointerId !== pointerId) return;
        settled = true;
        window.removeEventListener('pointermove', session.move);
        window.removeEventListener('pointerup', session.stop);
        window.removeEventListener('pointercancel', session.stop);
        window.removeEventListener('blur', session.stop);
        if (gestureRef.current === session) gestureRef.current = null;
        try { event.currentTarget?.releasePointerCapture?.(pointerId); } catch { /* The pointer may already have been released. */ }
        const cancelled = stopEvent?.type === 'pointercancel' || stopEvent?.type === 'blur' || stopEvent?.type === 'cancel';
        finish(cancelled);
      },
    };
    gestureRef.current = session;
    if (capture) {
      queueMicrotask(() => {
        if (gestureRef.current !== session) return;
        try { event.currentTarget?.setPointerCapture?.(pointerId); } catch { /* The pointer may already have been released. */ }
      });
    }
    return session;
  };

  const scrub = (event) => {
    if (event.button !== 0 || gestureRef.current) return;
    if (event.target.closest('.tl-head, .clip, .handle, .transition-mark')) return;
    event.preventDefault();
    event.stopPropagation();
    const origin = time;
    let latest = projectTime(event.clientX);
    let raf = 0;
    if (playing) onPause?.();
    onSeek(latest);
    setScrubbing(true);
    const session = arm(event, (cancelled) => {
      if (raf) cancelAnimationFrame(raf);
      setScrubbing(false);
      onSeek(cancelled ? origin : latest);
    });
    if (!session) return;
    session.move = (moveEvent) => {
      latest = projectTime(moveEvent.clientX);
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        (onSeekLive || onSeek)(latest);
      });
    };
    window.addEventListener('pointermove', session.move);
    window.addEventListener('pointerup', session.stop);
    window.addEventListener('pointercancel', session.stop);
    window.addEventListener('blur', session.stop);
  };

  const panTimeline = (event) => {
    if (event.button !== 0 || event.pointerType === 'touch' || gestureRef.current) return;
    if (event.target.closest('.clip, .handle, .transition-mark, .playhead-handle, .tl-head')) return;
    const scroller = scrollRef.current;
    if (!scroller) return;
    const x0 = event.clientX;
    const y0 = event.clientY;
    const left0 = scroller.scrollLeft;
    const top0 = scroller.scrollTop;
    const session = arm(event, () => {});
    if (!session) return;
    session.move = (moveEvent) => {
      scroller.scrollLeft = left0 - (moveEvent.clientX - x0);
      scroller.scrollTop = top0 - (moveEvent.clientY - y0);
    };
    window.addEventListener('pointermove', session.move);
    window.addEventListener('pointerup', session.stop);
    window.addEventListener('pointercancel', session.stop);
    window.addEventListener('blur', session.stop);
  };

  const interactClip = (event, track, clip, mode) => {
    if (event.button !== 0 || gestureRef.current) return;
    event.stopPropagation();
    const finger = event.pointerType === 'touch';
    onSelect({ track, id: clip.id });

    if (mode === 'left' || mode === 'right') {
      event.preventDefault();
      const media = mediaById[clip.mediaId];
      const original = { ...clip };
      const x0 = event.clientX;
      dispatch({ type: 'beginGesture' });
      const applyTrim = (delta) => {
        if (track === 'video') {
          if (mode === 'left') dispatch({ type: 'update', track, id: clip.id, patch: { in: clamp(original.in + delta, 0, original.out - MIN_CLIP) }, transient: true });
          else dispatch({ type: 'update', track, id: clip.id, patch: { out: clamp(original.out + delta, original.in + MIN_CLIP, media?.duration ?? original.out + delta) }, transient: true });
          return;
        }
        if (track === 'text') {
          if (mode === 'left') {
            const start = clamp(original.start + delta, 0, original.start + original.duration - MIN_CLIP);
            dispatch({ type: 'update', track, id: clip.id, patch: { start, duration: original.start + original.duration - start }, transient: true });
          } else dispatch({ type: 'update', track, id: clip.id, patch: { duration: Math.max(MIN_CLIP, original.duration + delta) }, transient: true });
          return;
        }
        const len = mediaById[original.mediaId]?.duration ?? original.out;
        if (mode === 'left') {
          const d = clamp(delta, -Math.min(original.in, original.start), original.out - original.in - MIN_CLIP);
          dispatch({ type: 'update', track, id: clip.id, patch: { in: original.in + d, start: original.start + d }, transient: true });
        } else dispatch({ type: 'update', track, id: clip.id, patch: { out: clamp(original.out + delta, original.in + MIN_CLIP, len) }, transient: true });
      };
      const session = arm(event, (cancelled) => dispatch({ type: cancelled ? 'cancelGesture' : 'endGesture' }));
      if (!session) return;
      session.move = (moveEvent) => applyTrim((moveEvent.clientX - x0) / pps);
      window.addEventListener('pointermove', session.move);
      window.addEventListener('pointerup', session.stop);
      window.addEventListener('pointercancel', session.stop);
      window.addEventListener('blur', session.stop);
      return;
    }

    const x0 = event.clientX;
    const y0 = event.clientY;
    let originX = event.clientX;
    let originStart = clip.start ?? 0;
    let dragging = false;
    let currentTrack = track;
    const threshold = finger ? 12 : 6;
    const session = arm(event, (cancelled) => {
      setMovingId(null);
      setDragDx(0);
      setDragOverTrack(null);
      if (dragging) dispatch({ type: cancelled ? 'cancelGesture' : 'endGesture' });
    }, { capture: false });
    if (!session) return;
    session.move = (moveEvent) => {
      const dx = moveEvent.clientX - x0;
      const dy = moveEvent.clientY - y0;
      if (!dragging) {
        if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
        if (finger && Math.abs(dy) > Math.abs(dx)) {
          session.stop({ type: 'pointercancel', pointerId: event.pointerId });
          return;
        }
        dragging = true;
        setMovingId(clip.id);
        dispatch({ type: 'beginGesture' });
        try { event.currentTarget?.setPointerCapture?.(event.pointerId); } catch { /* Capture is optional after the gesture has started. */ }
      }
      const dest = trackFromY(moveEvent.clientY);
      const pos = snap(timeFromEvent(moveEvent));
      if (dest && dest !== currentTrack && dest !== 'linked') {
        const audioBlocked = currentTrack === 'audio' && (dest === 'video' || dest === 'overlay' || dest === 'overlay2' || dest === 'text');
        const videoToAudio = (currentTrack === 'video' || currentTrack === 'overlay') && dest === 'audio';
        if (audioBlocked || videoToAudio) {
          setDragOverTrack(null);
          return;
        }
        setDragOverTrack(dest);
        if (currentTrack === 'video' && (dest === 'overlay' || dest === 'overlay2')) {
          dispatch({ type: 'moveToTrack', from: 'video', to: dest, id: clip.id, at: pos, audioId: uid() });
          currentTrack = 'overlay';
          originStart = pos;
          originX = moveEvent.clientX;
          onSelect({ track: 'overlay', id: clip.id });
          return;
        }
        if (currentTrack === 'overlay' && dest === 'video') {
          const others = videoLayout(project.videoClips);
          const toIndex = others.filter((item) => (item.start + item.end) / 2 < pos).length;
          dispatch({ type: 'moveToTrack', from: 'overlay', to: 'video', id: clip.id, toIndex });
          currentTrack = 'video';
          onSelect({ track: 'video', id: clip.id });
          return;
        }
        if (currentTrack === 'overlay' && (dest === 'overlay' || dest === 'overlay2')) {
          dispatch({ type: 'moveToTrack', from: 'overlay', to: dest, id: clip.id, at: pos });
          originStart = pos;
          originX = moveEvent.clientX;
          return;
        }
      }
      setDragOverTrack(currentTrack);
      const delta = (moveEvent.clientX - originX) / ppsRef.current;
      if (currentTrack === 'video') {
        const clips = projectRef.current.videoClips;
        const toIndex = videoInsertIndex(clips, clip.id, pos);
        const from = clips.findIndex((item) => item.id === clip.id);
        const nextClips = clips.slice();
        if (from >= 0 && from !== toIndex) {
          const [moved] = nextClips.splice(from, 1);
          nextClips.splice(toIndex, 0, moved);
          dispatch({ type: 'moveVideo', id: clip.id, toIndex, transient: true });
        }
        const laid = videoLayout(nextClips).find((item) => item.clip.id === clip.id);
        const raw = timeFromClientX(moveEvent.clientX);
        setDragDx(laid ? (raw - laid.start) * ppsRef.current : 0);
      } else if (currentTrack === 'text' || currentTrack === 'overlay' || currentTrack === 'audio') {
        const destTrack = currentTrack === 'overlay' ? 'overlay' : currentTrack;
        dispatch({ type: 'update', track: destTrack, id: clip.id, patch: { start: Math.max(0, snap(originStart + delta)) }, transient: true });
      }
    };
    window.addEventListener('pointermove', session.move);
    window.addEventListener('pointerup', session.stop);
    window.addEventListener('pointercancel', session.stop);
    window.addEventListener('blur', session.stop);
  };

  const handleDrop = (event, track) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverTrack(null);
    try {
      const payload = JSON.parse(event.dataTransfer.getData('application/x-pixelcut-media'));
      if (!payload) return;
      const at = timeFromEvent(event);
      if (payload.kind === 'effect') return onDropEffect?.(payload.type, at, track);
      if (payload.kind === 'audio-effect') return onDropAudioEffect?.(payload.type, at, track);
      if (payload.kind === 'transition') return onDropTransition?.(payload.type, at);
      if (!payload.mediaId) return;
      const media = mediaById[payload.mediaId];
      if (!media) return;
      if (media.type === 'audio' && (track === 'video' || track === 'overlay' || track === 'overlay2' || track === 'text')) return;
      if (track === 'overlay' || track === 'overlay2') {
        if (media.type !== 'video' && media.type !== 'image') return;
        onDropMedia(payload.mediaId, { track: 'overlay', lane: track === 'overlay2' ? 1 : 0, at });
        return;
      }
      if (track === 'linked' && media.type === 'audio') {
        onDropMedia(payload.mediaId, { track: 'audio', at });
        return;
      }
      const compatible = (track === 'video' && media.type === 'video') || (track === 'audio' && media.type === 'audio');
      if (!compatible) return;
      onDropMedia(payload.mediaId, { track, at });
    } catch {
      // Ignore drops that did not originate from the PixelCut media library.
    }
  };

  const dropProps = (track) => ({
    onDragEnter: (event) => { event.preventDefault(); setDragOverTrack(track); },
    onDragOver: (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDragOverTrack(track); },
    onDragLeave: (event) => { if (event.currentTarget === event.target) setDragOverTrack(null); },
    onDrop: (event) => handleDrop(event, track),
  });

  const step = [0.2, 0.5, 1, 2, 5, 10, 15, 30, 60].find((value) => value * pps >= 70) || 120;
  const ticks = [];
  for (let t = 0; t * pps < width; t += step) ticks.push(t);
  const overlay0 = overlays.filter((clip) => (clip.lane || 0) === 0);
  const overlay1 = overlays.filter((clip) => clip.lane === 1);

  if (isEmpty && !touch) {
    const dropFirst = (event) => {
      event.preventDefault();
      setDragOverTrack(null);
      try {
        const payload = JSON.parse(event.dataTransfer.getData('application/x-pixelcut-media'));
        const media = payload?.mediaId && mediaById[payload.mediaId];
        if (!media) {
          setEmptyHint('Primeiro arraste um vídeo da aba Mídia para cá.');
          return;
        }
        if (media.type === 'video') onDropMedia(media.id, { track: 'video', at: 0 });
        else if (media.type === 'audio') onDropMedia(media.id, { track: 'audio', at: 0 });
        else onDropMedia(media.id, { track: 'overlay', lane: 0, at: 0 });
      } catch {
        // Ignore drops that did not originate from the PixelCut media library.
      }
    };
    return (
      <section className="timeline timeline-empty">
        <div
          className={`timeline-dropzone ${dragOverTrack === 'empty' ? 'drag-over' : ''}`}
          onDragEnter={(event) => { event.preventDefault(); setDragOverTrack('empty'); }}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDragOverTrack('empty'); }}
          onDragLeave={(event) => { if (event.currentTarget === event.target) setDragOverTrack(null); }}
          onDrop={dropFirst}
        >
          <div className="dropzone-icon" aria-hidden="true">⇩</div>
          <strong>{project.media.length ? (touch ? 'Coloque o clipe na timeline' : 'Arraste seu vídeo para cá') : 'Importe um vídeo para começar'}</strong>
          <span>{emptyHint || (project.media.length
            ? (touch
              ? 'Abra Mídia e toque em ＋ no arquivo. Ele entra na faixa principal.'
              : 'Solte aqui o vídeo da biblioteca: a timeline aparece com as faixas de vídeo e áudio.')
            : (touch
              ? 'O arquivo fica salvo no PixelCut. Depois, toque em ＋ para colocá-lo na timeline.'
              : 'Use “Importar” na biblioteca à esquerda e depois arraste o arquivo para esta área.'))}</span>
          {!project.media.length && onImport && <button className="primary" onClick={onImport}>Importar mídia</button>}
          {project.media.length > 0 && touch && onBrowse && <button className="primary" onClick={onBrowse}>Escolher na biblioteca</button>}
        </div>
      </section>
    );
  }

  return (
    <section className="timeline">
      {touch && isEmpty && (
        <div className="empty-banner">
          <span>{project.media.length
            ? 'Toque em ＋ para colocar o clipe na faixa.'
            : 'Importe um vídeo para a biblioteca.'}</span>
          {!project.media.length && onImport && <button className="primary" onClick={onImport}>Importar</button>}
          {project.media.length > 0 && onBrowse && <button className="primary" onClick={onBrowse}>Biblioteca</button>}
        </div>
      )}
      <div className="timeline-heading">
        <div className="tl-toolbar">
          <div className="tl-tools-pin">
            <button onClick={onSplit} title="Dividir no ponto da agulha (S)" className="tool-button">Dividir</button>
            <button onClick={onDelete} disabled={!selection} title={selection ? 'Excluir o clipe selecionado' : 'Selecione um clipe para excluir'} className="tool-button">Excluir</button>
          </div>
          <div className="tl-tools">
            {selection?.track === 'video' && <button onClick={onUnlink} disabled={!canUnlink} title={canUnlink ? 'Separar o áudio deste vídeo' : 'Este vídeo já está sem áudio ligado'} className="tool-button">{touch ? 'Soltar' : 'Unlink'}</button>}
            {touch && selection && <button onClick={onAdjust} disabled={!onAdjust} title="Abrir as propriedades deste clipe" className="tool-button">Ajustar</button>}
            <button onClick={onAddText} title="Adicionar texto" className="tool-button">Texto</button>
          </div>
          <span className="timeline-time">
            <TimeField time={time} duration={duration} onCommit={onSeek} />
            <span className="tc dim">/ {formatTime(duration)}</span>
          </span>
          <div className="zoom-controls">
            <button className="icon-button" title="Afastar a partir da agulha (-)" onClick={() => zoomTo(pps / 1.2, time)}>−</button>
            <input aria-label="Zoom da timeline" title="Zoom temporal. A agulha permanece no mesmo instante." type="range" min={PPS_MIN} max={PPS_MAX} value={pps} onChange={(event) => zoomTo(Number(event.target.value), time)} />
            <span className="zoom-readout" title="Intervalo entre as marcas da régua">{step >= 1 ? `${step}s` : `${Math.round(step * 1000)}ms`}</span>
            <button className="icon-button" title="Aproximar a partir da agulha (+)" onClick={() => zoomTo(pps * 1.2, time)}>+</button>
            <button className="tool-button" title="Mostrar a duração inteira (\)" onClick={fitZoom}>Ajustar</button>
          </div>
        </div>
      </div>

      {touch && !isEmpty && <p className="touch-hint">Arraste o marcador azul para percorrer. Horizontal move o clipe. Bordas cortam. Vertical rola.</p>}
      <div className="tl-scroll" ref={scrollRef}>
        <div className="tl-content" style={{ width: width + head }}>
          <div className="tl-row ruler" onPointerDown={scrub}>
            <div className="tl-head ruler-head">{formatTime(time).slice(0, 5)}</div>
            <div className="tl-lane ruler-lane" style={{ backgroundSize: `${step * pps}px 100%` }}>
              {ticks.map((tick) => <div key={tick} className="tick" style={{ left: tick * pps }}>{formatTime(tick).slice(0, 5)}</div>)}
            </div>
          </div>

          <TrackRow label="2" name="Sobrepor" type="overlay" hint="Sobreposição" dragOverTrack={dragOverTrack} dropProps={dropProps} trackKey="overlay2" onPointerDown={panTimeline} enabled empty={!overlay1.length}>
            {overlay1.map((clip) => (
              <Clip key={clip.id} pps={pps} selection={selection} track="overlay" clip={clip} start={clip.start} length={clipLength(clip)} media={mediaById[clip.mediaId]} label={mediaById[clip.mediaId]?.name ?? 'Overlay'} moving={movingId === clip.id} onDown={(event, mode) => interactClip(event, 'overlay', clip, mode)} />
            ))}
          </TrackRow>

          <TrackRow label="1" name="Camada" type="overlay" hint="Vídeo ou imagem" dragOverTrack={dragOverTrack} dropProps={dropProps} trackKey="overlay" onPointerDown={panTimeline} enabled empty={!overlay0.length}>
            {overlay0.map((clip) => (
              <Clip key={clip.id} pps={pps} selection={selection} track="overlay" clip={clip} start={clip.start} length={clipLength(clip)} media={mediaById[clip.mediaId]} label={mediaById[clip.mediaId]?.name ?? 'Overlay'} moving={movingId === clip.id} onDown={(event, mode) => interactClip(event, 'overlay', clip, mode)} />
            ))}
          </TrackRow>

          <TrackRow label="T" name="Texto" type="text" hint="Texto" dragOverTrack={dragOverTrack} dropProps={dropProps} trackKey="text" onPointerDown={panTimeline} empty={!project.textClips.length}>
            {project.textClips.map((clip) => (
              <Clip key={clip.id} pps={pps} selection={selection} track="text" clip={clip} start={clip.start} length={clip.duration} label={clip.text || 'Texto'} moving={movingId === clip.id} onDown={(event, mode) => interactClip(event, 'text', clip, mode)} />
            ))}
          </TrackRow>

          <TrackRow label="V" name="Vídeo" type="video" hint="Vídeo principal" dragOverTrack={dragOverTrack} dropProps={dropProps} trackKey="video" onPointerDown={panTimeline} enabled empty={!layout.length}>
            {layout.map((item) => (
              <Clip
                key={item.clip.id}
                pps={pps}
                selection={selection}
                track="video"
                clip={item.clip}
                start={item.start}
                length={item.end - item.start}
                media={mediaById[item.clip.mediaId]}
                label={mediaById[item.clip.mediaId]?.name ?? 'Vídeo'}
                moving={movingId === item.clip.id}
                dragDx={movingId === item.clip.id ? dragDx : 0}
                onDown={(event, mode) => interactClip(event, 'video', item.clip, mode)}
              />
            ))}
            {layout.map((item, index) => index > 0 ? (
              <button
                key={`tr-${item.clip.id}`}
                className={`transition-mark ${item.clip.transitionIn?.type && item.clip.transitionIn.type !== 'none' ? 'on' : 'off'} ${selection?.track === 'transition' && selection.id === item.clip.id ? 'selected' : ''}`}
                style={{ left: (item.start + Math.max(item.overlap, 0) / 2) * pps - 9 }}
                title={item.clip.transitionIn?.type ? transitionById(item.clip.transitionIn.type).name : 'Adicionar transição'}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onSelect({ track: 'transition', id: item.clip.id });
                  onSeek(item.start + item.overlap / 2);
                }}
              >
                {item.clip.transitionIn?.type && item.clip.transitionIn.type !== 'none' ? null : <span>+</span>}
              </button>
            ) : null)}
          </TrackRow>

          <TrackRow label="A" name="Ligado" type="audio" hint="Áudio ligado" dragOverTrack={dragOverTrack} dropProps={dropProps} trackKey="linked" onPointerDown={panTimeline} empty={!layout.some((item) => isLinked(item.clip))}>
            {layout.filter((item) => isLinked(item.clip)).map((item) => (
              <div
                key={`a-${item.clip.id}`}
                className={`clip audio linked ${selection?.track === 'video' && selection.id === item.clip.id ? 'selected' : ''} ${movingId === item.clip.id ? 'moving' : ''}`}
                style={{ left: item.start * pps, width: Math.max(14, (item.end - item.start) * pps), transform: movingId === item.clip.id && dragDx ? `translateX(${dragDx}px)` : undefined }}
                onPointerDown={(event) => interactClip(event, 'video', item.clip, 'move')}
                title="Áudio ligado ao vídeo"
              >
                <Waveform media={mediaById[item.clip.mediaId]} clipIn={item.clip.in} clipOut={item.clip.out} width={Math.max(14, (item.end - item.start) * pps)} />
                <span className="clip-label">Áudio ligado</span>
              </div>
            ))}
          </TrackRow>

          <TrackRow label="♪" name="Áudio" type="audio" hint="Áudio" dragOverTrack={dragOverTrack} dropProps={dropProps} trackKey="audio" onPointerDown={panTimeline} enabled empty={!project.audioClips.length}>
            {project.audioClips.map((clip) => (
              <Clip key={clip.id} pps={pps} selection={selection} track="audio" clip={clip} start={clip.start} length={clipLength(clip)} media={mediaById[clip.mediaId]} label={mediaById[clip.mediaId]?.name ?? 'Áudio'} moving={movingId === clip.id} onDown={(event, mode) => interactClip(event, 'audio', clip, mode)} />
            ))}
          </TrackRow>

          <div className={`playhead ${scrubbing ? 'hot' : ''}`} style={{ left: head + time * pps }}>
            <div role="slider" tabIndex={-1} className="playhead-handle" aria-label="Arrastar a agulha do tempo" aria-valuemin={0} aria-valuemax={Math.max(0, Math.round((duration || 0) * 100))} aria-valuenow={Math.max(0, Math.round(time * 100))} title="Arraste para percorrer o vídeo" onPointerDown={scrub} />
          </div>
        </div>
      </div>
    </section>
  );
}

function TrackRow({ label, name, type, hint, children, dragOverTrack, dropProps, onPointerDown, enabled = false, empty = false, trackKey }) {
  return (
    <div className={`tl-row track-row ${type}-row ${type === 'video' ? 'main' : ''} ${type === 'audio' && trackKey === 'linked' ? 'linked-audio' : ''}`}>
      <div className={`tl-head track-head ${enabled ? 'drop-enabled' : ''}`} title={hint}><span>{label}</span>{name && <small className="tl-name">{name}</small>}</div>
      <div data-track={trackKey} className={`tl-lane track-lane ${enabled ? 'drop-enabled' : ''} ${dragOverTrack === trackKey ? 'drag-over' : ''}`} onPointerDown={onPointerDown} {...dropProps(trackKey)}>
        {children}
        {empty && <div className="lane-hint">{hint}</div>}
      </div>
    </div>
  );
}

function Clip({ pps, selection, track, clip, start, length, label, media, onDown, moving = false, dragDx = 0 }) {
  const selected = selection && selection.track === track && selection.id === clip.id;
  const hasFx = clip.effects?.length || clip.audioEffects?.length || clip.chroma?.enabled;
  const width = Math.max(14, length * pps);
  return (
    <div className={`clip ${track} ${selected ? 'selected' : ''} ${moving ? 'moving' : ''}`} style={{ left: start * pps, width, transform: moving && dragDx ? `translateX(${dragDx}px)` : undefined }} onPointerDown={(event) => onDown(event, 'move')} title={`${label} · ${formatTime(length)}`}>
      {media?.type === 'video' && track !== 'audio' ? <Filmstrip media={media} clipIn={clip.in} clipOut={clip.out} width={width} /> : null}
      {media?.type === 'image' ? <img className="clip-image" src={toFileUrl(media.path)} alt="" draggable={false} /> : null}
      {track === 'audio' ? <Waveform media={media} clipIn={clip.in} clipOut={clip.out} width={width} /> : null}
      <div className="handle left" title="Cortar o início" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); onDown(event, 'left'); }} />
      <span className="clip-label">{label}</span>
      {hasFx ? <span className="clip-fx">FX</span> : null}
      <div className="handle right" title="Cortar o fim" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); onDown(event, 'right'); }} />
    </div>
  );
}

function Waveform({ media, clipIn, clipOut, width }) {
  const canvasRef = useRef(null);
  const [bundle, setBundle] = useState(null);
  useEffect(() => {
    let live = true;
    if (!media) return undefined;
    loadWaveform(media).then((next) => { if (live) setBundle(next); });
    return () => { live = false; };
  }, [media?.id]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = Math.max(8, Math.round(width));
    canvas.height = 36;
    drawWaveform(canvas, bundle, clipIn, clipOut);
  }, [bundle, clipIn, clipOut, width]);
  return <canvas className="clip-wave" ref={canvasRef} aria-hidden="true" />;
}

function Filmstrip({ media, clipIn, clipOut, width }) {
  const [bundle, setBundle] = useState(null);
  useEffect(() => {
    let live = true;
    captureMediaFrames(media).then((next) => { if (live) setBundle(next); });
    return () => { live = false; };
  }, [media?.id]);

  const thumbW = 56;
  const count = Math.max(1, Math.ceil(width / thumbW));
  const images = [];
  for (let i = 0; i < count; i += 1) {
    const t = clipIn + ((i + 0.4) / count) * Math.max(0.01, clipOut - clipIn);
    images.push(bundle ? frameAt(bundle, t) : null);
  }

  return (
    <div className="filmstrip" aria-hidden="true">
      {images.map((src, index) => (src ? <img key={index} src={src} alt="" draggable={false} /> : <div key={index} className="filmstrip-ph" />))}
    </div>
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

import React, { useEffect, useRef, useState } from 'react';
import { MIN_CLIP, clipLength, formatTime, isLinked, nearestVideoCut, toFileUrl, uid, videoInsertIndex, videoLayout } from '../store.js';
import { TimeField } from './Preview.jsx';
import { captureMediaFrames, filmstripTileCount, frameAt, prefetchFilmstrips } from '../filmstrip.js';
import { transitionById } from '../catalog.js';
import { drawWaveform, loadWaveform } from '../waveform.js';
import { overlayLanes, visibleTimelineTracks } from '../timelineTracks.js';
import { isPlayheadHit, playheadNeedsFollow, playheadScrollLeft, playheadX, scrubAutoScroll } from '../playheadView.js';

const HEADER = 48;
const PPS_MIN = 8;
const PPS_MAX = 420;

export default function Timeline({ project, time, duration, playing, selection, onSelect, onSeek, onSeekLive, onPause, dispatch, onSplit, onDelete, onAddText, onDropMedia, onDropEffect, onDropTransition, onUnlink, onDropAudioEffect, onImport, touch = false, onAdjust = null, onBrowse = null, onOpenTransitions = null, cutToken = 0, onScrubbing = null, focusToken = 0 }) {
  const [pps, setPps] = useState(56);
  const [dragOverTrack, setDragOverTrack] = useState(null);
  const [emptyHint, setEmptyHint] = useState('');
  const [scrubbing, setScrubbing] = useState(false);
  const [cutFlash, setCutFlash] = useState(false);
  const [movingId, setMovingId] = useState(null);
  const [dragDx, setDragDx] = useState(0);
  const scrollRef = useRef(null);
  const gestureRef = useRef(null);
  const followPlayhead = useRef(false);
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
  const ppsMax = touch ? 180 : PPS_MAX;

  useEffect(() => {
    prefetchFilmstrips(project.media, { compact: touch });
  }, [project.media, touch]);

  useEffect(() => {
    if (!cutToken) return undefined;
    setCutFlash(true);
    const timer = window.setTimeout(() => setCutFlash(false), 320);
    return () => window.clearTimeout(timer);
  }, [cutToken]);

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
    const clamped = clamp(next, PPS_MIN, ppsMax);
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
    const next = clamp((scroller.clientWidth - head - 24) / span, PPS_MIN, ppsMax);
    setPps(next);
    requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      scrollRef.current.dataset.autoscroll = '1';
      scrollRef.current.scrollLeft = 0;
      requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.dataset.autoscroll = ''; });
    });
  };

  const scrollPlayheadIntoView = (align) => {
    const node = scrollRef.current;
    if (!node) return;
    node.dataset.autoscroll = '1';
    node.scrollLeft = playheadScrollLeft(time, ppsRef.current, head, node.clientWidth, align);
    requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.dataset.autoscroll = ''; });
  };

  useEffect(() => {
    followPlayhead.current = !!playing;
  }, [playing]);

  useEffect(() => {
    if (playing || scrubbing) return undefined;
    scrollPlayheadIntoView(0.42);
    return undefined;
  }, [focusToken, isEmpty]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !playing || !followPlayhead.current) return;
    const playX = playheadX(time, pps, head);
    if (!playheadNeedsFollow(playX, node.scrollLeft, node.clientWidth)) return;
    node.dataset.autoscroll = '1';
    node.scrollLeft = playheadScrollLeft(time, pps, head, node.clientWidth, 0.35);
    requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.dataset.autoscroll = ''; });
  }, [time, playing, pps, head]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return undefined;
    const onWheel = (event) => {
      if (!event.ctrlKey && !event.altKey) return;
      event.preventDefault();
      const at = timeFromClientX(event.clientX);
      zoomTo(pps * (event.deltaY < 0 ? 1.14 : 0.88), at);
    };
    const onScroll = () => {
      if (node.dataset.autoscroll) return;
      followPlayhead.current = false;
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('scroll', onScroll);
    };
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

  const applyScrubPoint = (clientX) => {
    const scroller = scrollRef.current;
    if (!scroller) return projectTime(clientX);
    const rect = scroller.getBoundingClientRect();
    const stepped = scrubAutoScroll({
      viewportX: clientX - rect.left,
      viewWidth: scroller.clientWidth,
      scrollLeft: scroller.scrollLeft,
      maxScroll: Math.max(0, scroller.scrollWidth - scroller.clientWidth),
      time: projectTime(clientX),
      duration,
      pps: ppsRef.current,
      headWidth: head,
      touch,
    });
    if (stepped.scrollLeft !== scroller.scrollLeft) {
      scroller.dataset.autoscroll = '1';
      scroller.scrollLeft = stepped.scrollLeft;
      requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.dataset.autoscroll = ''; });
    }
    return stepped.time;
  };

  const scrub = (event) => {
    if (event.button !== 0 || gestureRef.current) return;
    if (event.target.closest('.tl-head, .handle, .transition-mark')) return;
    if (event.target.closest('.clip') && !isPlayheadHit(
      event.clientX - (scrollRef.current?.getBoundingClientRect().left || 0) + (scrollRef.current?.scrollLeft || 0),
      time,
      ppsRef.current,
      head,
      touch,
    )) return;
    event.preventDefault();
    event.stopPropagation();
    const origin = time;
    let pointerX = event.clientX;
    let latest = applyScrubPoint(pointerX);
    let raf = 0;
    let edgeRaf = 0;
    if (playing) onPause?.();
    followPlayhead.current = true;
    setScrubbing(true);
    onScrubbing?.(true);
    onSeek(latest);
    const session = arm(event, (cancelled) => {
      if (raf) cancelAnimationFrame(raf);
      if (edgeRaf) cancelAnimationFrame(edgeRaf);
      setScrubbing(false);
      onScrubbing?.(false);
      onSeek(cancelled ? origin : latest);
    });
    if (!session) return;
    const pulse = (live) => {
      latest = applyScrubPoint(pointerX);
      (live ? (onSeekLive || onSeek) : onSeek)(latest);
    };
    const edgeLoop = () => {
      if (gestureRef.current !== session) return;
      const scroller = scrollRef.current;
      if (!scroller) {
        edgeRaf = 0;
        return;
      }
      const rect = scroller.getBoundingClientRect();
      const stepped = scrubAutoScroll({
        viewportX: pointerX - rect.left,
        viewWidth: scroller.clientWidth,
        scrollLeft: scroller.scrollLeft,
        maxScroll: Math.max(0, scroller.scrollWidth - scroller.clientWidth),
        time: latest,
        duration,
        pps: ppsRef.current,
        headWidth: head,
        touch,
      });
      if (!stepped.delta) {
        edgeRaf = 0;
        return;
      }
      pulse(true);
      edgeRaf = requestAnimationFrame(edgeLoop);
    };
    session.move = (moveEvent) => {
      pointerX = moveEvent.clientX;
      if (!edgeRaf) edgeRaf = requestAnimationFrame(edgeLoop);
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        pulse(true);
      });
    };
    window.addEventListener('pointermove', session.move);
    window.addEventListener('pointerup', session.stop);
    window.addEventListener('pointercancel', session.stop);
    window.addEventListener('blur', session.stop);
    edgeRaf = requestAnimationFrame(edgeLoop);
  };

  const scrubFromLine = (event) => {
    if (event.button !== 0 || gestureRef.current) return;
    const hit = event.currentTarget;
    const previous = hit.style.pointerEvents;
    hit.style.pointerEvents = 'none';
    const below = document.elementFromPoint(event.clientX, event.clientY);
    hit.style.pointerEvents = previous;
    if (below?.closest('.transition-mark, .handle')) return;
    scrub(event);
  };

  const grabPlayhead = (event) => {
    if (event.button !== 0 || gestureRef.current) return;
    if (event.target.closest('.transition-mark, .handle, .tl-head, .playhead-handle, .playhead-hit')) return;
    const scroller = scrollRef.current;
    if (!scroller) return;
    const rect = scroller.getBoundingClientRect();
    const contentX = event.clientX - rect.left + scroller.scrollLeft;
    if (!isPlayheadHit(contentX, time, ppsRef.current, head, touch)) return;
    scrub(event);
  };

  const panTimeline = (event) => {
    if (event.button !== 0 || gestureRef.current) return;
    if (event.target.closest('.clip, .handle, .transition-mark, .playhead-handle')) return;
    const scroller = scrollRef.current;
    if (!scroller) return;
    const x0 = event.clientX;
    const y0 = event.clientY;
    const left0 = scroller.scrollLeft;
    const top0 = scroller.scrollTop;
    followPlayhead.current = false;
    const session = arm(event, () => {});
    if (!session) return;
    event.preventDefault();
    event.stopPropagation();
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
  const { overlay0, overlay1 } = overlayLanes(project);
  const shown = visibleTimelineTracks(project, { dragging: !!dragOverTrack });

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
            <button type="button" onClick={onSplit} title="Dividir no ponto da agulha (S)" className="tool-icon-button split-button" aria-label="Dividir">
              <ScissorsIcon />
            </button>
            <button type="button" onClick={onDelete} disabled={!selection} title={selection ? 'Excluir o clipe selecionado' : 'Selecione um clipe para excluir'} className="tool-icon-button" aria-label="Excluir">×</button>
          </div>
          <div className="tl-tools">
            {layout.length > 1 && onOpenTransitions && (
              <button
                type="button"
                onClick={() => {
                  const cut = nearestVideoCut(project, time);
                  if (cut) {
                    onSelect({ track: 'transition', id: cut.clip.id });
                    onSeek(cut.cut);
                  }
                  onOpenTransitions();
                }}
                title="Abrir transições entre clipes"
                className="tool-button"
              >
                Transição
              </button>
            )}
            {selection?.track === 'video' && (
              <button type="button" onClick={onUnlink} disabled={!canUnlink} title={canUnlink ? 'Separar o áudio deste vídeo' : 'Este vídeo já está sem áudio ligado'} className="tool-button">
                {touch ? 'Soltar' : 'Separar áudio'}
              </button>
            )}
            {touch && selection && <button type="button" onClick={onAdjust} disabled={!onAdjust} title="Propriedades do clipe" className="tool-button">Ajustar</button>}
            {!touch && <button type="button" onClick={onAddText} title="Adicionar texto" className="tool-button">Texto</button>}
          </div>
          {!touch && (
            <span className="timeline-time">
              <TimeField time={time} duration={duration} onCommit={onSeek} />
              <span className="tc dim">/ {formatTime(duration)}</span>
            </span>
          )}
          <div className="zoom-controls">
            <button type="button" className="icon-button" title="Afastar a partir da agulha (-)" onClick={() => zoomTo(pps / 1.2, time)}>−</button>
            <input aria-label="Zoom da timeline" title="Zoom temporal. A agulha permanece no mesmo instante." type="range" min={PPS_MIN} max={ppsMax} value={Math.min(pps, ppsMax)} onChange={(event) => zoomTo(Number(event.target.value), time)} />
            <span className="zoom-readout" title="Intervalo entre as marcas da régua">{step >= 1 ? `${step}s` : `${Math.round(step * 1000)}ms`}</span>
            <button type="button" className="icon-button" title="Aproximar a partir da agulha (+)" onClick={() => zoomTo(pps * 1.2, time)}>+</button>
            <button type="button" className="tool-button zoom-fit" title="Mostrar a duração inteira (\)" onClick={fitZoom}>Tudo</button>
          </div>
        </div>
      </div>
      <div className="tl-scroll" ref={scrollRef} onPointerDownCapture={grabPlayhead}>
        <div className={`tl-content ${cutFlash ? 'cut-flash' : ''}`} style={{ width: width + head }}>
          <div className="tl-pin">
            <div className="tl-row ruler" onPointerDown={scrub}>
              <div className="tl-head ruler-head">{formatTime(time).slice(0, 5)}</div>
              <div className="tl-lane ruler-lane" style={{ backgroundSize: `${step * pps}px 100%` }}>
                {ticks.map((tick) => <div key={tick} className="tick" style={{ left: tick * pps }}>{formatTime(tick).slice(0, 5)}</div>)}
              </div>
            </div>

            <TrackRow label="V" name="Vídeo" type="video" hint="Vídeo principal" dragOverTrack={dragOverTrack} dropProps={dropProps} trackKey="video" onPointerDown={touch ? scrub : panTimeline} onPan={panTimeline} enabled empty={!layout.length}>
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
                  compact={touch}
                  onDown={(event, mode) => interactClip(event, 'video', item.clip, mode)}
                />
              ))}
              {layout.map((item, index) => index > 0 ? (
                <button
                  key={`tr-${item.clip.id}`}
                  type="button"
                  className={`transition-mark ${item.clip.transitionIn?.type && item.clip.transitionIn.type !== 'none' ? 'on' : 'off'} ${selection?.track === 'transition' && selection.id === item.clip.id ? 'selected' : ''}`}
                  style={{ left: (item.start + Math.max(item.overlap, 0) / 2) * pps - (touch ? 22 : 11) }}
                  title={item.clip.transitionIn?.type ? transitionById(item.clip.transitionIn.type).name : 'Adicionar transição'}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelect({ track: 'transition', id: item.clip.id });
                    onSeek(item.start + item.overlap / 2);
                    onOpenTransitions?.();
                  }}
                >
                  <span className="transition-mark-face">
                    <span>{item.clip.transitionIn?.type && item.clip.transitionIn.type !== 'none' ? '◆' : '+'}</span>
                  </span>
                </button>
              ) : null)}
            </TrackRow>

            {shown.linked && (
              <TrackRow label="A" name="Áudio" type="audio" hint="Áudio ligado" dragOverTrack={dragOverTrack} dropProps={dropProps} trackKey="linked" onPointerDown={touch ? scrub : panTimeline} onPan={panTimeline} empty={!layout.some((item) => isLinked(item.clip))}>
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
            )}
          </div>

          {shown.audio && (
            <TrackRow label="♪" name="Música" type="audio" hint="Áudio" dragOverTrack={dragOverTrack} dropProps={dropProps} trackKey="audio" onPointerDown={panTimeline} onPan={panTimeline} enabled empty={!project.audioClips.length}>
              {project.audioClips.map((clip) => (
                <Clip key={clip.id} pps={pps} selection={selection} track="audio" clip={clip} start={clip.start} length={clipLength(clip)} media={mediaById[clip.mediaId]} label={mediaById[clip.mediaId]?.name ?? 'Áudio'} moving={movingId === clip.id} onDown={(event, mode) => interactClip(event, 'audio', clip, mode)} />
              ))}
            </TrackRow>
          )}

          {shown.overlay && (
            <TrackRow label="1" name="Camada" type="overlay" hint="Vídeo ou imagem" dragOverTrack={dragOverTrack} dropProps={dropProps} trackKey="overlay" onPointerDown={panTimeline} onPan={panTimeline} enabled empty={!overlay0.length}>
              {overlay0.map((clip) => (
                <Clip key={clip.id} pps={pps} selection={selection} track="overlay" clip={clip} start={clip.start} length={clipLength(clip)} media={mediaById[clip.mediaId]} label={mediaById[clip.mediaId]?.name ?? 'Overlay'} moving={movingId === clip.id} onDown={(event, mode) => interactClip(event, 'overlay', clip, mode)} />
              ))}
            </TrackRow>
          )}

          {shown.overlay2 && (
            <TrackRow label="2" name="Sobrepor" type="overlay" hint="Sobreposição" dragOverTrack={dragOverTrack} dropProps={dropProps} trackKey="overlay2" onPointerDown={panTimeline} onPan={panTimeline} enabled empty={!overlay1.length}>
              {overlay1.map((clip) => (
                <Clip key={clip.id} pps={pps} selection={selection} track="overlay" clip={clip} start={clip.start} length={clipLength(clip)} media={mediaById[clip.mediaId]} label={mediaById[clip.mediaId]?.name ?? 'Overlay'} moving={movingId === clip.id} onDown={(event, mode) => interactClip(event, 'overlay', clip, mode)} />
              ))}
            </TrackRow>
          )}

          {shown.text && (shown.textRows || [{ lane: 0, clips: project.textClips }]).map((row, index) => (
            <TrackRow
              key={`text-${row.lane}`}
              label={index === 0 ? 'T' : `T${index + 1}`}
              name="Texto"
              type="text"
              hint="Texto"
              dragOverTrack={dragOverTrack}
              dropProps={dropProps}
              trackKey={index === 0 ? 'text' : `text-${row.lane}`}
              onPointerDown={panTimeline}
              onPan={panTimeline}
              empty={!row.clips.length}
            >
              {row.clips.map((clip) => (
                <Clip key={clip.id} pps={pps} selection={selection} track="text" clip={clip} start={clip.start} length={clip.duration} label={clip.text || 'Texto'} moving={movingId === clip.id} onDown={(event, mode) => interactClip(event, 'text', clip, mode)} />
              ))}
            </TrackRow>
          ))}

          <div className={`playhead ${scrubbing ? 'hot' : ''}`} style={{ left: head + time * pps }}>
            <div className="playhead-hit" aria-hidden="true" onPointerDown={scrubFromLine} />
            <div role="slider" tabIndex={-1} className="playhead-handle" aria-label="Arrastar a agulha do tempo" aria-valuemin={0} aria-valuemax={Math.max(0, Math.round((duration || 0) * 100))} aria-valuenow={Math.max(0, Math.round(time * 100))} title="Arraste para percorrer o vídeo" onPointerDown={scrub} />
          </div>
        </div>
      </div>
    </section>
  );
}

function TrackRow({ label, name, type, hint, children, dragOverTrack, dropProps, onPointerDown, onPan = null, enabled = false, empty = false, trackKey }) {
  return (
    <div className={`tl-row track-row ${type}-row ${type === 'video' ? 'main' : ''} ${type === 'audio' && trackKey === 'linked' ? 'linked-audio' : ''}`}>
      <div className={`tl-head track-head ${enabled ? 'drop-enabled' : ''}`} title={hint} onPointerDown={onPan}><span>{label}</span>{name && <small className="tl-name">{name}</small>}</div>
      <div data-track={trackKey} className={`tl-lane track-lane ${enabled ? 'drop-enabled' : ''} ${dragOverTrack === trackKey ? 'drag-over' : ''}`} onPointerDown={onPointerDown} {...dropProps(trackKey)}>
        {children}
        {empty && <div className="lane-hint">{hint}</div>}
      </div>
    </div>
  );
}

function Clip({ pps, selection, track, clip, start, length, label, media, onDown, moving = false, dragDx = 0, compact = false }) {
  const selected = selection && selection.track === track && selection.id === clip.id;
  const hasFx = clip.effects?.length || clip.audioEffects?.length || clip.chroma?.enabled;
  const width = Math.max(14, length * pps);
  return (
    <div className={`clip ${track} ${selected ? 'selected' : ''} ${moving ? 'moving' : ''}`} style={{ left: start * pps, width, transform: moving && dragDx ? `translateX(${dragDx}px)` : undefined }} onPointerDown={(event) => onDown(event, 'move')} title={`${label} · ${formatTime(length)}`}>
      {media?.type === 'video' && track !== 'audio' ? <Filmstrip media={media} clipIn={clip.in} clipOut={clip.out} width={width} compact={compact} /> : null}
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

function Filmstrip({ media, clipIn, clipOut, width, compact = false }) {
  const [bundle, setBundle] = useState(null);
  useEffect(() => {
    let live = true;
    captureMediaFrames(media, { compact }).then((next) => { if (live) setBundle(next); });
    return () => { live = false; };
  }, [media?.id, compact]);

  const thumbW = compact ? 72 : 56;
  const count = filmstripTileCount(width, thumbW, { compact });
  const images = [];
  for (let i = 0; i < count; i += 1) {
    const t = clipIn + ((i + 0.4) / count) * Math.max(0.01, clipOut - clipIn);
    images.push(bundle ? frameAt(bundle, t) : null);
  }

  return (
    <div className="filmstrip" aria-hidden="true">
      {images.map((src, index) => (src
        ? <img key={index} src={src} alt="" draggable={false} />
        : <div key={index} className="filmstrip-ph" />))}
    </div>
  );
}

function ScissorsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="6" cy="7" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="6" cy="17" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.4 8.4 20 20M8.4 15.6 20 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

import React, { useEffect, useRef, useState } from 'react';
import { createPlaybackSession } from '../playback.js';
import { clipLength, clipSpeed, formatTime, parseTime, toFileUrl, videoClipsAt } from '../store.js';
import { ASPECTS, aspectOf, chromaMatte, composeVideoStyle, fontById, hexToRgb } from '../catalog.js';
import { clipZoom, layerStyle, letterStyle, overlayMotion, textMotion, transitionMix } from '../motion.js';
import { applyAudioEffects, envelopeVolume, unlockAudio } from '../audioFx.js';
import { mainTrackAudio } from '../previewAudio.js';
import { snapPosition } from '../snap.js';

const DRIFT = 0.25;

export function TimeField({ time, duration, onCommit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const skip = useRef(false);
  const commit = () => {
    setEditing(false);
    if (skip.current) {
      skip.current = false;
      return;
    }
    const parsed = parseTime(draft);
    if (parsed == null) return;
    onCommit(Math.max(0, Math.min(duration || 0, parsed)));
  };
  if (!editing) {
    return (
      <button type="button" className="tc current-time time-edit" onClick={() => { setDraft(formatTime(time)); setEditing(true); }} title="Clique para ir a um tempo (mm:ss.cc)">
        {formatTime(time)}
      </button>
    );
  }
  return (
    <input
      className="tc time-input"
      autoFocus
      value={draft}
      aria-label="Tempo atual"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          skip.current = true;
          setEditing(false);
        }
      }}
    />
  );
}

function syncMedia(element, url, localTime, playing, volume, rate = 1) {
  if (!element) return;
  if (element.dataset.src !== url) {
    element.dataset.src = url;
    element.src = url;
    element.load();
    element.addEventListener('loadedmetadata', () => {
      try { element.currentTime = Math.max(0, localTime); } catch { /* Media metadata may not be seekable yet. */ }
    }, { once: true });
  }
  element.volume = Math.max(0, Math.min(1, volume));
  try {
    element.preservesPitch = true;
    element.playbackRate = Math.max(0.1, Math.min(4, rate));
  } catch { /* Some media elements ignore playbackRate until ready. */ }
  if (element.readyState >= 1 && Math.abs(element.currentTime - localTime) > (playing ? DRIFT : 0.015)) {
    try { element.currentTime = localTime; } catch { /* Wait for metadata. */ }
  }
  if (playing && element.paused) element.play().catch(() => {});
  if (!playing && !element.paused) element.pause();
}

function drawChroma(canvas, source, color, similarity) {
  if (!canvas || !source) return;
  const isVideo = source.tagName === 'VIDEO';
  if (isVideo && source.readyState < 2) return;
  if (!isVideo && !source.naturalWidth && !source.complete) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;
  ctx.drawImage(source, 0, 0, w, h);
  const frame = ctx.getImageData(0, 0, w, h);
  const data = frame.data;
  const key = hexToRgb(color);
  const sim = similarity ?? 0.32;
  for (let i = 0; i < data.length; i += 4) {
    const matte = chromaMatte(data[i], data[i + 1], data[i + 2], key, sim);
    data[i + 1] = matte.g;
    data[i + 3] = Math.round(data[i + 3] * matte.alpha);
  }
  ctx.putImageData(frame, 0, 0);
}

const NO_GUIDES = { v: null, h: null };

function TextLayer({ item, time, stageSize, project, selected, onPointerDown }) {
  const motion = textMotion(item, time);
  const font = fontById(item.font);
  return (
    <div
      className={`overlay-text ${item.layer === 'behind' ? 'layer-behind' : 'layer-front'}${selected ? ' is-selected' : ''}`}
      onPointerDown={onPointerDown}
      title="Arraste para posicionar"
      style={{
        left: `${item.x * 100}%`,
        top: `${item.y * 100}%`,
        color: item.letterEffect === 'hollow' ? 'transparent' : item.color,
        fontSize: `${item.size * (stageSize.width / project.width)}px`,
        fontFamily: font.family,
        fontWeight: item.bold === false ? 500 : 800,
        fontStyle: item.italic ? 'italic' : 'normal',
        opacity: motion.opacity,
        filter: motion.blur ? `blur(${motion.blur}px)` : undefined,
        transform: `translate(-50%, -50%) translate(${motion.x}px, ${motion.y}px) scale(${motion.scale}) rotate(${motion.rotate}deg)`,
        ...letterStyle(item),
      }}
    >
      {motion.text}
    </div>
  );
}

export default function Preview({ project, time, seekVer, playing, duration, onTime, onEnd, onTogglePlay, onSeek, dispatch, selection, onSelect, emptyDetail = 'Depois arraste-o para a área da timeline, abaixo.' }) {
  const stageRef = useRef(null);
  const [guides, setGuides] = useState(NO_GUIDES);
  const videoARef = useRef(null);
  const videoBRef = useRef(null);
  const chromaRef = useRef(null);
  const overlayEls = useRef({});
  const overlayChroma = useRef({});
  const audioEls = useRef({});
  const stageWrapRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 640, height: 360 });
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const mediaById = Object.fromEntries(project.media.map((item) => [item.id, item]));
  const playback = useRef(createPlaybackSession());
  const playbackRaf = useRef(0);
  const timeRef = useRef(time);
  const playingRef = useRef(playing);
  const durationRef = useRef(duration);
  timeRef.current = time;
  playingRef.current = playing;
  durationRef.current = duration;

  const apply = (targetTime, isPlaying) => {
    const layers = videoClipsAt(project, targetTime);
    const mediaA = layers[0] && mediaById[layers[0].clip.mediaId];
    const mediaB = layers[1] && mediaById[layers[1].clip.mediaId];
    const videoA = videoARef.current;
    const videoB = videoBRef.current;
    const audio = mainTrackAudio(project, targetTime);
    applyAudioEffects(videoA, audio.a.effects, audio.a.key);
    applyAudioEffects(videoB, audio.b.effects, audio.b.key);

    if (mediaA) {
      const clip = layers[0].clip;
      const url = toFileUrl(mediaA.path);
      if (videoA.dataset.src !== url) { setVideoReady(false); setVideoError(false); }
      syncMedia(videoA, url, audio.a.localTime, isPlaying, audio.a.volume, clipSpeed(clip));
      if (clip.chroma?.enabled) drawChroma(chromaRef.current, videoA, clip.chroma.color, clip.chroma.similarity);
    } else if (videoA && !videoA.paused) videoA.pause();

    if (mediaB) {
      const clip = layers[1].clip;
      syncMedia(videoB, toFileUrl(mediaB.path), audio.b.localTime, isPlaying, audio.b.volume, clipSpeed(clip));
    } else if (videoB?.dataset.src) {
      if (!videoB.paused) videoB.pause();
      videoB.removeAttribute('src');
      videoB.dataset.src = '';
    }

    (project.overlayClips || []).forEach((clip) => {
      const element = overlayEls.current[clip.id];
      const media = mediaById[clip.mediaId];
      if (!element || !media) return;
      const length = clipLength(clip);
      const active = targetTime >= clip.start && targetTime < clip.start + length;
      if (media.type !== 'image') {
        if (active) syncMedia(element, toFileUrl(media.path), clip.in + (targetTime - clip.start) * clipSpeed(clip), isPlaying, clip.muted ? 0 : clip.volume ?? 0, clipSpeed(clip));
        else if (!element.paused) element.pause();
      }
      const canvas = overlayChroma.current[clip.id];
      if (canvas && clip.chroma?.enabled && active) drawChroma(canvas, element, clip.chroma.color, clip.chroma.similarity);
    });

    project.audioClips.forEach((clip) => {
      const element = audioEls.current[clip.id];
      const media = mediaById[clip.mediaId];
      if (!element || !media) return;
      const length = clipLength(clip);
      if (targetTime >= clip.start && targetTime < clip.start + length) {
        const speed = clipSpeed(clip);
        syncMedia(element, toFileUrl(media.path), clip.in + (targetTime - clip.start) * speed, isPlaying, envelopeVolume(clip, targetTime - clip.start, clipLength(clip)), speed);
      }
      else if (!element.paused) element.pause();
    });
  };

  const applyRef = useRef(apply);
  const onTimeRef = useRef(onTime);
  const onEndRef = useRef(onEnd);
  applyRef.current = apply;
  onTimeRef.current = onTime;
  onEndRef.current = onEnd;

  useEffect(() => {
    if (!playing) applyRef.current(timeRef.current, false);
  });

  useEffect(() => {
    if (!playing) {
      playback.current.close();
      cancelAnimationFrame(playbackRaf.current);
      return undefined;
    }
    const run = playback.current.open();
    const startTime = timeRef.current;
    const wallStart = performance.now();
    const tick = () => {
      if (!playingRef.current) return;
      const result = run.step(startTime, (performance.now() - wallStart) / 1000, durationRef.current);
      if (!result || !playingRef.current) return;
      if (result.ended) {
        onTimeRef.current(result.time);
        onEndRef.current();
        applyRef.current(result.time, false);
        return;
      }
      applyRef.current(result.time, true);
      if (!playingRef.current) return;
      onTimeRef.current(result.time);
      if (!playingRef.current) return;
      playbackRaf.current = requestAnimationFrame(tick);
    };
    playbackRaf.current = requestAnimationFrame(tick);
    return () => {
      playback.current.close();
      cancelAnimationFrame(playbackRaf.current);
      if (!playingRef.current) applyRef.current(timeRef.current, false);
    };
  }, [playing, seekVer]);

  useEffect(() => {
    const container = stageWrapRef.current;
    if (!container) return undefined;
    const updateSize = () => {
      const maxWidth = Math.max(1, container.clientWidth - 16);
      const maxHeight = Math.max(1, container.clientHeight - 16);
      const aspect = project.width / Math.max(1, project.height);
      let width = Math.min(maxWidth, maxHeight * aspect);
      let height = width / aspect;
      if (height > maxHeight) { height = maxHeight; width = height * aspect; }
      setStageSize({ width: Math.round(width), height: Math.round(height) });
    };
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    updateSize();
    return () => observer.disconnect();
  }, [project.width, project.height]);

  const layers = videoClipsAt(project, time);
  const mainClip = layers[0]?.clip;
  const texts = project.textClips.filter((item) => time >= item.start && time < item.start + item.duration);
  const overlaysNow = (project.overlayClips || []).filter((clip) => time >= clip.start && time < clip.start + clipLength(clip));
  const transType = layers[1]?.clip.transitionIn?.type;
  const transProgress = layers.length > 1 && layers[1].overlap
    ? (time - layers[1].start) / Math.max(0.04, layers[1].overlap)
    : 0;
  const mix = layers.length > 1 ? transitionMix(transType || 'dissolve', transProgress) : { a: { opacity: 1 }, b: { opacity: 0 } };
  const zoomed = (part, layer) => {
    if (!layer) return part;
    const factor = clipZoom(layer.clip, Math.max(0, time - layer.start), layer.end - layer.start);
    return factor === 1 ? part : { ...part, scale: (part.scale ?? 1) * factor };
  };
  const mixA = zoomed(mix.a, layers[0]);
  const mixB = zoomed(mix.b, layers[1]);
  const styleA = composeVideoStyle(mainClip || {});
  const styleB = composeVideoStyle(layers[1]?.clip || {});
  const chromaOn = !!mainClip?.chroma?.enabled;
  // The keyed canvas replaces the hidden video, so it wears this style once. Premiere applies Motion after the key.
  const mainStyle = {
    ...layerStyle(mixA),
    filter: [styleA.filter, mixA?.blur ? `blur(${mixA.blur}px)` : ''].filter(Boolean).join(' '),
    transform: `${layerStyle(mixA).transform}${styleA.transform ? ` ${styleA.transform}` : ''}`,
  };
  const currentAspect = aspectOf(project).id;

  useEffect(() => {
    if (playing) unlockAudio();
    project.audioClips.forEach((clip) => applyAudioEffects(audioEls.current[clip.id], clip.effects || [], clip.id));
  }, [project.audioClips, playing]);

  const isSelected = (track, id) => selection?.track === track && selection?.id === id;

  // Free positioning in the preview; the item's center snaps to the stage center lines.
  const startDrag = (event, track, item) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect?.({ track, id: item.id });
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const box = event.currentTarget.getBoundingClientRect();
    const halfW = box.width / 2 / rect.width;
    const halfH = box.height / 2 / rect.height;
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = item.x ?? 0.5;
    const originY = item.y ?? (track === 'text' ? 0.85 : 0.5);
    let moved = false;
    const move = (e) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved) {
        if (Math.abs(dx) + Math.abs(dy) < 3) return;
        moved = true;
        dispatch({ type: 'beginGesture' });
      }
      const { x, y, guides: next } = snapPosition({
        x: originX + dx / rect.width,
        y: originY + dy / rect.height,
        halfW,
        halfH,
        stageW: rect.width,
        stageH: rect.height,
        disabled: e.altKey,
      });
      setGuides((g) => (g.v === next.v && g.h === next.h ? g : next));
      dispatch({ type: 'update', track, id: item.id, patch: { x, y }, transient: true });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setGuides(NO_GUIDES);
      if (moved) dispatch({ type: 'endGesture' });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const overlayNode = (clip) => {
    const media = mediaById[clip.mediaId];
    if (!media) return null;
    const motion = overlayMotion(clip, Math.max(0, time - clip.start), clipLength(clip));
    const style = {
      left: `${(clip.x ?? 0.5) * 100}%`,
      top: `${(clip.y ?? 0.5) * 100}%`,
      width: `${motion.scale * 56}%`,
      opacity: motion.opacity,
      transform: `translate(-50%, -50%) ${composeVideoStyle(clip).transform || ''}`.trim(),
      filter: composeVideoStyle(clip).filter,
    };
    const layerClass = `stage-overlay ${clip.layer === 'behind' ? 'layer-behind' : 'layer-front'}${isSelected('overlay', clip.id) ? ' is-selected' : ''}`;
    const drag = { onPointerDown: (event) => startDrag(event, 'overlay', clip) };
    const chroma = clip.chroma?.enabled;
    const bindMedia = (element) => {
      if (element) overlayEls.current[clip.id] = element;
      else delete overlayEls.current[clip.id];
    };
    const bindCanvas = (element) => {
      if (element) overlayChroma.current[clip.id] = element;
      else delete overlayChroma.current[clip.id];
    };
    if (chroma) {
      return (
        <div key={clip.id} className={layerClass} style={style} {...drag}>
          {media.type === 'image'
            ? <img ref={bindMedia} src={toFileUrl(media.path)} alt="" draggable={false} className="chroma-source" />
            : <video ref={bindMedia} preload="auto" playsInline muted className="chroma-source" />}
          <canvas ref={bindCanvas} className="overlay-chroma" width={320} height={180} />
        </div>
      );
    }
    if (media.type === 'image') {
      return <img key={clip.id} className={layerClass} src={toFileUrl(media.path)} alt="" draggable={false} style={style} {...drag} />;
    }
    return (
      <video
        key={clip.id}
        {...drag}
        className={layerClass}
        ref={bindMedia}
        preload="auto"
        playsInline
        muted
        style={style}
      />
    );
  };

  return (
    <section className="panel preview">
      <div className="preview-heading">
        <strong>Preview</strong>
        <label className="aspect-select-wrap">
          <span>Formato</span>
          <select
            className="aspect-select"
            value={currentAspect}
            onChange={(event) => {
              const item = ASPECTS.find((aspect) => aspect.id === event.target.value);
              if (item) dispatch?.({ type: 'setCanvas', width: item.width, height: item.height });
            }}
          >
            {ASPECTS.map((item) => (
              <option key={item.id} value={item.id}>{item.name} · {item.label}</option>
            ))}
            {!ASPECTS.some((item) => item.id === currentAspect) && (
              <option value={currentAspect}>{currentAspect}</option>
            )}
          </select>
        </label>
      </div>
      <div className="stage-wrap" ref={stageWrapRef}>
        <div
          ref={stageRef}
          className="stage"
          style={{ width: stageSize.width, height: stageSize.height, aspectRatio: `${project.width} / ${project.height}` }}
          onPointerDown={(event) => {
            if (event.button === 0 && mainClip) onSelect?.({ track: 'video', id: mainClip.id });
          }}
        >
          <video
            ref={videoARef}
            className="stage-video"
            preload="auto"
            playsInline
            onLoadedData={() => setVideoReady(true)}
            onError={() => setVideoError(true)}
            style={{
              ...mainStyle,
              visibility: layers[0] && !chromaOn ? 'visible' : 'hidden',
            }}
          />
          <video
            ref={videoBRef}
            className="stage-video"
            preload="auto"
            playsInline
            style={{
              ...layerStyle(mixB),
              filter: [styleB.filter, mixB?.blur ? `blur(${mixB.blur}px)` : ''].filter(Boolean).join(' '),
              visibility: layers[1] ? 'visible' : 'hidden',
            }}
          />
          {overlaysNow.filter((clip) => clip.layer === 'behind').map(overlayNode)}
          {texts.filter((item) => item.layer === 'behind').map((item) => (
            <TextLayer key={item.id} item={item} time={time} stageSize={stageSize} project={project}
              selected={isSelected('text', item.id)} onPointerDown={(event) => startDrag(event, 'text', item)} />
          ))}
          {chromaOn && (
            <canvas
              ref={chromaRef}
              className="stage-video"
              width={Math.max(160, stageSize.width)}
              height={Math.max(90, stageSize.height)}
              style={{ opacity: mainStyle.opacity, transform: mainStyle.transform }}
            />
          )}
          {styleA.overlays?.includes('vignette') ? <div className="fx-vignette" /> : null}
          {styleA.overlays?.includes('grain') ? <div className="fx-grain" /> : null}
          {overlaysNow.filter((clip) => clip.layer !== 'behind').map(overlayNode)}
          {project.audioClips.map((clip) => <audio key={clip.id} ref={(element) => { if (element) audioEls.current[clip.id] = element; else delete audioEls.current[clip.id]; }} preload="auto" />)}
          {texts.filter((item) => item.layer !== 'behind').map((item) => (
            <TextLayer key={item.id} item={item} time={time} stageSize={stageSize} project={project}
              selected={isSelected('text', item.id)} onPointerDown={(event) => startDrag(event, 'text', item)} />
          ))}
          {guides.v && <div className={`snap-guide snap-guide-v at-${guides.v}`} />}
          {guides.h && <div className={`snap-guide snap-guide-h at-${guides.h}`} />}
          {!project.videoClips.length && <div className="stage-empty"><strong>Importe um vídeo</strong><span>{emptyDetail}</span></div>}
          {!!project.videoClips.length && layers[0] && !videoReady && !videoError && <div className="preview-loading">Carregando…</div>}
          {videoError && <div className="preview-loading preview-error">Não foi possível decodificar este vídeo. Tente um MP4 H.264.</div>}
        </div>
      </div>
      <div className="transport">
        <button className="transport-icon" onClick={() => onSeek(0)} title="Início">⏮</button>
        <button
          type="button"
          className="play"
          title="Reproduzir / pausar (Space)"
          onPointerDown={(event) => event.preventDefault()}
          onPointerUp={(event) => { if (event.button === 0) onTogglePlay(); }}
        >{playing ? '❚❚' : '▶'}</button>
        <button className="transport-icon" onClick={() => onSeek(duration)} title="Fim">⏭</button>
        <TimeField time={time} duration={duration} onCommit={onSeek} />
        <span className="tc dim">/ {formatTime(duration)}</span>
      </div>
    </section>
  );
}

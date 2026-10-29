import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatTime, toFileUrl } from '../store.js';
import { AUDIO_EFFECTS, AUDIO_GROUPS, CLIP_MOTIONS, TEXT_PRESETS, TRANSITIONS, VIDEO_EFFECTS } from '../catalog.js';
import { auditionEffect, stopAudition } from '../audioFx.js';
import { auditionPlan, auditionTarget } from '../previewAudio.js';
import { AudioThumb, EffectThumb, TransitionThumb, ZoomThumb } from './FxThumbs.jsx';

const PEEK_W = 288;
const PEEK_DELAY = 280;

const TABS = [
  { id: 'media', label: 'Mídia' },
  { id: 'text', label: 'Texto' },
  { id: 'effects', label: 'Efeitos' },
  { id: 'audiofx', label: 'Áudio' },
  { id: 'transitions', label: 'Trans' },
];

export default function MediaLibrary({ media, project, selection, time, playing, onPausePlayback, onImport, onAdd, onAddText, onRemove, onApplyEffect, onApplyTransition, onApplyAudioEffect, open, tab: controlledTab, onTabChange, hideTabs = false }) {
  const [ownTab, setOwnTab] = useState('media');
  const tab = controlledTab || ownTab;
  const setTab = (id) => {
    setOwnTab(id);
    onTabChange?.(id);
  };
  const [query, setQuery] = useState('');
  const [fxGroup, setFxGroup] = useState('all');
  const items = useMemo(() => media.filter((item) => {
    if (tab === 'audiofx') return item.type === 'audio' && item.name.toLowerCase().includes(query.toLowerCase());
    if (tab !== 'media') return false;
    return item.name.toLowerCase().includes(query.toLowerCase());
  }), [media, tab, query]);
  const effects = fxGroup === 'Animação' ? [] : (fxGroup === 'all' ? VIDEO_EFFECTS : VIDEO_EFFECTS.filter((item) => item.group === fxGroup));
  const motions = fxGroup === 'all' || fxGroup === 'Animação' ? CLIP_MOTIONS : [];
  const target = project ? auditionTarget(project, selection) : null;
  const [auditioning, setAuditioning] = useState(null);
  const endAudition = () => { stopAudition(); setAuditioning(null); };
  useEffect(() => () => stopAudition(), []);
  useEffect(() => { if (tab !== 'audiofx') endAudition(); }, [tab]);
  // A new selection or timeline playback ends the audition, so two sources never play together.
  useEffect(() => { endAudition(); }, [selection?.track, selection?.id]);
  useEffect(() => { if (playing) endAudition(); }, [playing]);

  const listen = (event, effectId) => {
    event.stopPropagation();
    if (auditioning === effectId) return endAudition();
    const plan = auditionPlan(project, selection, time, effectId);
    if (!plan) return undefined;
    if (playing) onPausePlayback?.();
    setAuditioning(effectId);
    auditionEffect(plan, toFileUrl(plan.mediaPath), () => setAuditioning((current) => (current === effectId ? null : current)));
    return undefined;
  };

  // Enlarged preview next to the panel while the mouse rests on a tile; the grid stays compact.
  const [peek, setPeek] = useState(null);
  const peekTimer = useRef(0);
  const hidePeek = () => {
    window.clearTimeout(peekTimer.current);
    setPeek(null);
  };
  useEffect(() => hidePeek, []);
  useEffect(() => { hidePeek(); }, [tab, fxGroup]);
  const peekProps = (kind, item) => ({
    onPointerEnter: (event) => {
      if (event.pointerType !== 'mouse') return;
      const tile = event.currentTarget.getBoundingClientRect();
      const panel = event.currentTarget.closest('.library')?.getBoundingClientRect();
      if (!panel) return;
      const left = panel.right + 10;
      if (left + PEEK_W + 8 > window.innerWidth) return;
      const height = (PEEK_W * 9) / 16 + 52;
      const top = Math.max(52, Math.min(window.innerHeight - height - 8, tile.top + tile.height / 2 - height / 2));
      window.clearTimeout(peekTimer.current);
      peekTimer.current = window.setTimeout(() => setPeek({ kind, id: item.id, name: item.name, top, left }), PEEK_DELAY);
    },
    onPointerLeave: hidePeek,
  });

  const startDrag = (event, payload) => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/x-pixelcut-media', JSON.stringify(payload));
    event.dataTransfer.setData('text/plain', payload.name || payload.type || 'item');
  };

  return (
    <aside className={`panel library ${open ? 'open' : ''}`}>
      <div className="library-heading">
        <h2>{TABS.find((item) => item.id === tab)?.label}</h2>
        {(tab === 'media' || tab === 'audiofx') && <button className="primary import-button" onClick={onImport}>Importar</button>}
      </div>

      {!hideTabs && (
        <nav className="asset-tabs" aria-label="Biblioteca">
          {TABS.map((item) => (
            <button key={item.id} className={`asset-tab ${tab === item.id ? 'active' : ''}`} onClick={() => { setTab(item.id); setQuery(''); }}>{item.label}</button>
          ))}
        </nav>
      )}

      {(tab === 'media' || tab === 'audiofx') && (
        <>
          <label className="asset-search">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar..." aria-label="Buscar arquivos" />
          </label>
          {tab === 'audiofx' && (
            <div className="asset-catalog" style={{ paddingBottom: 8 }}>
              <p className={`catalog-intro audition-hint${target ? ' ready' : ''}`}>
                {target
                  ? `▶ ouve o efeito no clipe selecionado (“${target.media.name}”), a partir da agulha. Clique ou arraste para aplicar.`
                  : 'Selecione um clipe de áudio (ou um vídeo com áudio ligado) na timeline para ouvir os efeitos.'}
              </p>
              {AUDIO_GROUPS.map((group) => (
                <React.Fragment key={group}>
                  <div className="picker-label">{group}</div>
                  <div className="feature-grid">
                    {AUDIO_EFFECTS.filter((item) => item.group === group).map((item) => (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        className={`feature-tile audio-tile${auditioning === item.id ? ' playing' : ''}`}
                        draggable
                        onDragStart={(event) => startDrag(event, { kind: 'audio-effect', type: item.id, name: item.name })}
                        onClick={() => onApplyAudioEffect(item.id)}
                        onKeyDown={(event) => { if (event.key === 'Enter') onApplyAudioEffect(item.id); }}
                      >
                        <AudioThumb id={item.id} group={group} playing={auditioning === item.id} />
                        <strong>{item.name}</strong>
                        <button className="listen-button" disabled={!target} onClick={(event) => listen(event, item.id)} title={target ? 'Ouvir no clipe selecionado' : 'Selecione um clipe de áudio na timeline'}>
                          {auditioning === item.id ? '■' : '▶'}
                        </button>
                      </div>
                    ))}
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
          {items.length === 0 && tab === 'media' ? (
            <div className="asset-empty">
              <strong>{media.length ? 'Nada encontrado' : 'Biblioteca vazia'}</strong>
              <span>{media.length ? 'Tente outra busca.' : 'Importe vídeos, imagens ou áudios.'}</span>
              <button onClick={onImport} className="secondary-button">Importar</button>
            </div>
          ) : (
            <div className="media-grid">
              {items.map((item) => (
                <div key={item.id} className="media-item" draggable onDragStart={(event) => startDrag(event, { mediaId: item.id, type: item.type, name: item.name })} onDoubleClick={() => onAdd(item.id)} title={`${item.name}\nArraste para V1, sobreposição ou áudio`}>
                  <div className={`thumb ${item.type !== 'video' ? 'audio-file-thumb' : ''}`}>
                    {item.type === 'video' && <video src={`${toFileUrl(item.path)}#t=0.5`} preload="metadata" muted />}
                    {item.type === 'image' && <img src={toFileUrl(item.path)} alt="" />}
                    {item.type === 'audio' && <div className="audio-thumb">♪</div>}
                    <span className="dur">{item.type === 'image' ? 'IMG' : formatTime(item.duration).slice(0, 5)}</span>
                    <button className="add" onClick={(event) => { event.stopPropagation(); onAdd(item.id); }} title={item.type === 'audio' ? 'Adicionar na faixa de áudio' : 'Adicionar na faixa V1'}>＋</button>
                    {(item.type === 'video' || item.type === 'image') && (
                      <button className="add overlay-add" onClick={(event) => { event.stopPropagation(); onAdd(item.id, { track: 'overlay' }); }} title="Adicionar como sobreposição">▣</button>
                    )}
                    <button className="remove" onClick={(event) => { event.stopPropagation(); onRemove(item.id); }} title="Remover">×</button>
                  </div>
                  <div className="media-name">{item.name}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'text' && (
        <div className="asset-catalog">
          <div className="preset-list">
            {TEXT_PRESETS.map((preset) => (
              <button key={preset.id} className="text-preset" onClick={() => onAddText(preset)}>
                <span className="text-preset-glyph">{preset.text.slice(0, 2)}</span>
                <span><strong>{preset.name}</strong><small>{preset.animation} · {preset.letterEffect}</small></span>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'effects' && (
        <div className="asset-catalog" onScroll={hidePeek}>
          <div className="chip-row" style={{ marginBottom: 8 }}>
            {['all', 'Lente', 'Cor', 'Animação'].map((group) => (
              <button key={group} className={`mini-chip ${fxGroup === group ? 'active' : ''}`} onClick={() => setFxGroup(group)}>{group === 'all' ? 'Todos' : group}</button>
            ))}
          </div>
          <div className="feature-grid">
            {effects.map((item) => (
              <button
                key={item.id}
                className="feature-tile"
                draggable
                onDragStart={(event) => { hidePeek(); startDrag(event, { kind: 'effect', type: item.id, name: item.name }); }}
                onClick={() => onApplyEffect(item.id)}
                {...peekProps('effect', item)}
              >
                <EffectThumb id={item.id} />
                <strong>{item.name}</strong>
              </button>
            ))}
            {motions.map((item) => (
              <button
                key={item.id}
                className="feature-tile"
                draggable
                onDragStart={(event) => { hidePeek(); startDrag(event, { kind: 'effect', type: item.id, name: item.name }); }}
                onClick={() => onApplyEffect(item.id)}
                {...peekProps('motion', item)}
              >
                <ZoomThumb preset={item.id} />
                <strong>{item.name}</strong>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'transitions' && (
        <div className="asset-catalog" onScroll={hidePeek}>
          <div className="feature-grid">
            {TRANSITIONS.map((item) => (
              <button
                key={item.id}
                className="feature-tile trans-tile"
                draggable
                onDragStart={(event) => { hidePeek(); startDrag(event, { kind: 'transition', type: item.id, name: item.name }); }}
                onClick={() => onApplyTransition(item.id)}
                {...peekProps('transition', item)}
              >
                <TransitionThumb id={item.id} />
                <strong>{item.name}</strong>
              </button>
            ))}
          </div>
        </div>
      )}

      {peek && (tab === 'effects' || tab === 'transitions') && (
        <div className="fx-peek" style={{ top: peek.top, left: peek.left, width: PEEK_W }} aria-hidden="true">
          {peek.kind === 'motion'
            ? <ZoomThumb preset={peek.id} compare />
            : peek.kind === 'effect'
              ? <EffectThumb id={peek.id} compare />
              : <TransitionThumb id={peek.id} />}
          <strong>{peek.name}</strong>
          <small>{peek.kind === 'effect' ? 'Clique ou arraste até o clipe' : 'Clique ou arraste até um corte'}</small>
        </div>
      )}
    </aside>
  );
}

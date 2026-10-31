import React, { useEffect, useState } from 'react';
import { MIN_TRANSITION, clipLength, formatTime, projectDuration, transitionOverlap, transitionRoom } from '../store.js';
import { TextAnimThumb, TransitionThumb, ZoomThumb } from './FxThumbs.jsx';
import { letterStyle } from '../motion.js';
import { ASPECTS, AUDIO_EFFECTS, AUDIO_GROUPS, CLIP_MOTIONS, ENTER_ANIMS, LETTER_FX, TEXT_ANIMS, TEXT_FONTS, VIDEO_EFFECTS, aspectOf, fontById, transitionById } from '../catalog.js';

function NumberField({ label, value, onChange, step = 0.1, min, max, suffix }) {
  return <label className="field"><span>{label}</span><div className="number-input-wrap"><input type="number" value={Number(value.toFixed(2))} step={step} min={min} max={max} onChange={(event) => event.target.value !== '' && onChange(Number(event.target.value))} />{suffix && <small>{suffix}</small>}</div></label>;
}

function SliderField({ label, value, onChange, min = 0, max = 1, step = 0.01, format = (number) => number }) {
  return <label className="field slider-field"><span>{label}<b>{format(value)}</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function VoiceChips({ active, onToggle }) {
  return AUDIO_GROUPS.map((group) => (
    <React.Fragment key={group}>
      <div className="picker-label subtle">{group}</div>
      <div className="choice-grid">
        {AUDIO_EFFECTS.filter((effect) => effect.group === group).map((effect) => (
          <button key={effect.id} className={`choice-chip ${active.includes(effect.id) ? 'active' : ''}`} onClick={() => onToggle(effect.id)}>{effect.name}</button>
        ))}
      </div>
    </React.Fragment>
  ));
}

export default function Inspector({ project, selection, dispatch, open }) {
  const [tab, setTab] = useState('ajuste');
  const track = selection?.track;
  const list = track === 'video' ? project.videoClips : track === 'text' ? project.textClips : track === 'audio' ? project.audioClips : track === 'overlay' ? (project.overlayClips || []) : [];
  const clip = track === 'transition'
    ? project.videoClips.find((item) => item.id === selection?.id)
    : list.find((item) => item.id === selection?.id);
  const set = (patch) => clip && track !== 'transition' && dispatch({ type: 'update', track, id: clip.id, patch });
  const media = clip?.mediaId && project.media.find((item) => item.id === clip.mediaId);
  const params = clip?.effectParams || {};
  const chroma = clip?.chroma || { enabled: false, color: '#00ff00', similarity: 0.32 };
  const tabs = track === 'text' ? ['ajuste', 'fonte', 'motion'] : track === 'audio' ? ['ajuste', 'efeitos'] : ['ajuste', 'efeitos', 'camada'];
  useEffect(() => { setTab('ajuste'); }, [track, clip?.id]);

  return (
    <aside className={`panel inspector ${open ? 'open' : ''}`}>
      <div className="inspector-heading"><h2>Propriedades</h2></div>
      {!clip && (
        <div className="fields">
          <div className="picker-label">Formato</div>
          <div className="choice-grid">
            {ASPECTS.map((item) => (
              <button key={item.id} className={`choice-chip ${aspectOf(project).id === item.id ? 'active' : ''}`} onClick={() => dispatch({ type: 'setCanvas', width: item.width, height: item.height })}>
                {item.name}<small style={{ display: 'block', color: '#7f93a8' }}>{item.label}</small>
              </button>
            ))}
          </div>
          <p className="catalog-intro">Selecione um clipe, um efeito ou uma transição.</p>
        </div>
      )}

      {clip && track !== 'transition' && (
        <nav className="insp-tabs">
          {tabs.map((id) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{id[0].toUpperCase() + id.slice(1)}</button>
          ))}
        </nav>
      )}

      {clip && track === 'text' && tab === 'ajuste' && (
        <div className="fields">
          <label className="field"><span>Texto</span><textarea rows={3} value={clip.text} onChange={(event) => set({ text: event.target.value })} /></label>
          <SliderField label="Tamanho" value={clip.size} min={12} max={220} step={1} onChange={(size) => set({ size })} format={(value) => `${value} px`} />
          <label className="field color-field"><span>Cor</span><input type="color" value={clip.color} onChange={(event) => set({ color: event.target.value })} /></label>
          <div className="chip-row">
            <button className={`mini-chip ${clip.layer !== 'behind' ? 'active' : ''}`} onClick={() => set({ layer: 'front' })}>Frente</button>
            <button className={`mini-chip ${clip.layer === 'behind' ? 'active' : ''}`} onClick={() => set({ layer: 'behind' })}>Atrás</button>
          </div>
          <div className="field-pair">
            <NumberField label="X" value={clip.x * 100} min={0} max={100} step={1} suffix="%" onChange={(value) => set({ x: Math.max(0, Math.min(1, value / 100)) })} />
            <NumberField label="Y" value={clip.y * 100} min={0} max={100} step={1} suffix="%" onChange={(value) => set({ y: Math.max(0, Math.min(1, value / 100)) })} />
          </div>
        </div>
      )}

      {clip && track === 'text' && tab === 'fonte' && (
        <div className="fields">
          <div className="font-grid">
            {TEXT_FONTS.map((font) => (
              <button key={font.id} className={`font-chip ${(clip.font || 'montserrat') === font.id ? 'active' : ''}`} style={{ fontFamily: font.family }} onClick={() => set({ font: font.id })}>{font.name}</button>
            ))}
          </div>
          <div className="chip-row">
            <button className={`mini-chip ${clip.bold !== false ? 'active' : ''}`} onClick={() => set({ bold: clip.bold === false })}>Negrito</button>
            <button className={`mini-chip ${clip.italic ? 'active' : ''}`} onClick={() => set({ italic: !clip.italic })}>Itálico</button>
          </div>
          <div className="picker-label">Efeito da fonte</div>
          <div className="choice-grid">
            {LETTER_FX.map((fx) => (
              <button
                key={fx.id}
                className={`choice-chip letter-preview ${(clip.letterEffect || 'outline') === fx.id ? 'active' : ''}`}
                onClick={() => set({ letterEffect: fx.id })}
                style={{
                  fontFamily: fontById(clip.font).family,
                  color: fx.id === 'hollow' ? 'transparent' : clip.color,
                  ...letterStyle({ ...clip, letterEffect: fx.id }),
                }}
              >
                {fx.name}
              </button>
            ))}
          </div>
          {(clip.letterEffect === 'outline' || clip.letterEffect === 'thick' || clip.letterEffect === 'double' || clip.letterEffect === 'sticker' || clip.letterEffect === 'hollow') && (
            <>
              <label className="field color-field"><span>Cor da borda</span><input type="color" value={clip.strokeColor || '#000000'} onChange={(event) => set({ strokeColor: event.target.value })} /></label>
              <SliderField label="Espessura" value={clip.strokeWidth || 2} min={1} max={10} step={1} onChange={(strokeWidth) => set({ strokeWidth })} format={(value) => `${value}px`} />
            </>
          )}
        </div>
      )}

      {clip && track === 'text' && tab === 'motion' && (
        <div className="fields">
          <div className="choice-grid">
            {TEXT_ANIMS.map((anim) => (
              <button key={anim.id} className={`choice-chip anim-choice ${(clip.animation || 'fade') === anim.id ? 'active' : ''}`} onClick={() => set({ animation: anim.id })}>
                <TextAnimThumb id={anim.id} />
                <span>{anim.name}</span>
              </button>
            ))}
          </div>
          {clip.animation && clip.animation !== 'none' && (
            <SliderField label="Duração" value={clip.animationDuration ?? 0.45} min={0.1} max={Math.min(5, Math.max(0.1, (clip.duration || 0.5) / 2))} step={0.05} onChange={(animationDuration) => set({ animationDuration })} format={(value) => `${value.toFixed(2)}s`} />
          )}
        </div>
      )}

      {clip && (track === 'video' || track === 'overlay') && tab === 'ajuste' && (
        <div className="fields">
          <div className="media-info-card"><strong>{media?.name}</strong><small>{media?.type === 'image' ? 'Imagem' : `${media?.width || '—'} × ${media?.height || '—'}`} · {formatTime(media?.duration ?? 0)}</small></div>
          {track === 'overlay' && (
            <>
              <div className="field-pair">
                <NumberField label="X" value={(clip.x ?? 0.5) * 100} min={0} max={100} step={1} suffix="%" onChange={(value) => set({ x: value / 100 })} />
                <NumberField label="Y" value={(clip.y ?? 0.5) * 100} min={0} max={100} step={1} suffix="%" onChange={(value) => set({ y: value / 100 })} />
              </div>
              <SliderField label="Escala" value={clip.scale ?? 1} min={0.1} max={2} onChange={(scale) => set({ scale })} format={(value) => `${Math.round(value * 100)}%`} />
              <SliderField label="Opacidade" value={clip.opacity ?? 1} onChange={(opacity) => set({ opacity })} format={(value) => `${Math.round(value * 100)}%`} />
              <div className="picker-label">Entrada</div>
              <div className="choice-grid">
                {ENTER_ANIMS.map((item) => (
                  <button key={item.id} className={`choice-chip ${(clip.enter?.type || 'none') === item.id ? 'active' : ''}`} onClick={() => set({ enter: item.id === 'none' ? null : { type: item.id, duration: clip.enter?.duration ?? 0.6, scale: clip.enter?.scale ?? 0.85 } })}>{item.name}</button>
                ))}
              </div>
              {clip.enter?.type && clip.enter.type !== 'none' && (
                <>
                  <SliderField label="Duração da entrada" value={clip.enter.duration ?? 0.6} min={0.1} max={Math.min(5, Math.max(0.1, clipLength(clip)))} step={0.05} onChange={(duration) => set({ enter: { ...clip.enter, duration } })} format={(value) => `${value.toFixed(2)}s`} />
                  {(clip.enter.type === 'scale' || clip.enter.type === 'both') && (
                    <SliderField label="Escala inicial" value={clip.enter.scale ?? 0.85} min={0.5} max={1} step={0.01} onChange={(scale) => set({ enter: { ...clip.enter, scale } })} format={(value) => `${Math.round(value * 100)}%`} />
                  )}
                </>
              )}
            </>
          )}
          <NumberField label="Entrada" value={clip.in} min={0} max={clip.out - 0.1} onChange={(value) => set({ in: Math.max(0, Math.min(value, clip.out - 0.1)) })} suffix="s" />
          <NumberField label="Saída" value={clip.out} min={clip.in + 0.1} max={media?.duration || clip.out} onChange={(value) => set({ out: Math.max(clip.in + 0.1, value) })} suffix="s" />
          <SliderField label="Velocidade" value={clip.speed || 1} min={0.25} max={2} step={0.05} onChange={(speed) => set({ speed })} format={(value) => `${value.toFixed(2)}x`} />
          {track === 'video' && (
            <>
              <SliderField label="Volume" value={clip.volume ?? 1} max={2} format={(value) => `${Math.round(value * 100)}%`} onChange={(volume) => set({ volume })} />
              <label className="field checkbox-field"><span>Silenciar</span><input type="checkbox" checked={!!clip.muted} onChange={(event) => set({ muted: event.target.checked })} /></label>
            </>
          )}
        </div>
      )}

      {clip && (track === 'video' || track === 'overlay') && tab === 'efeitos' && (
        <div className="fields">
          <SliderField label="Brilho" value={params.brightness || 0} min={-0.5} max={0.5} onChange={(brightness) => set({ effectParams: { ...params, brightness } })} format={(value) => `${Math.round(value * 100)}`} />
          <SliderField label="Contraste" value={params.contrast || 0} min={-0.5} max={0.8} onChange={(contrast) => set({ effectParams: { ...params, contrast } })} format={(value) => `${Math.round(value * 100)}`} />
          <SliderField label="Saturação" value={params.saturation || 0} min={-1} max={1.5} onChange={(saturation) => set({ effectParams: { ...params, saturation } })} format={(value) => `${Math.round(value * 100)}`} />
          <div className="picker-label">Efeitos neste clipe</div>
          <div className="choice-grid">
            {VIDEO_EFFECTS.map((effect) => (
              <button key={effect.id} className={`choice-chip ${(clip.effects || []).includes(effect.id) ? 'active' : ''}`} onClick={() => dispatch({ type: 'toggleEffect', track, id: clip.id, effect: effect.id })}>{effect.name}</button>
            ))}
          </div>
          <div className="picker-label">Zoom</div>
          <div className="choice-grid">
            <button className={`choice-chip ${!clip.zoom?.preset ? 'active' : ''}`} onClick={() => set({ zoom: null })}>Nenhum</button>
            {CLIP_MOTIONS.map((item) => (
              <button key={item.id} className={`choice-chip anim-choice ${clip.zoom?.preset === item.id ? 'active' : ''}`} onClick={() => set({ zoom: { preset: item.id, from: clip.zoom?.preset === item.id ? clip.zoom.from : item.from, to: clip.zoom?.preset === item.id ? clip.zoom.to : item.to, duration: clip.zoom?.duration || 1 } })}>
                <ZoomThumb preset={item.id} />
                <span>{item.name}</span>
              </button>
            ))}
          </div>
          {clip.zoom?.preset && (
            <>
              <SliderField label="Escala inicial" value={clip.zoom.from ?? 1} min={1} max={1.6} step={0.01} onChange={(from) => set({ zoom: { ...clip.zoom, from } })} format={(value) => `${Math.round(value * 100)}%`} />
              <SliderField label="Escala final" value={clip.zoom.to ?? 1.2} min={1} max={1.6} step={0.01} onChange={(to) => set({ zoom: { ...clip.zoom, to } })} format={(value) => `${Math.round(value * 100)}%`} />
              <SliderField label="Duração do zoom" value={clip.zoom.duration ?? 1} min={0.1} max={Math.min(5, Math.max(0.1, clipLength(clip)))} step={0.05} onChange={(duration) => set({ zoom: { ...clip.zoom, duration } })} format={(value) => `${value.toFixed(2)}s`} />
            </>
          )}
          {track === 'video' && (
            <>
              <div className="picker-label">Voz / áudio do clipe</div>
              <VoiceChips active={clip.audioEffects || []} onToggle={(effect) => dispatch({ type: 'toggleAudioEffect', track: 'video', id: clip.id, effect })} />
            </>
          )}
        </div>
      )}

      {clip && (track === 'video' || track === 'overlay') && tab === 'camada' && (
        <div className="fields">
          <div className="chip-row">
            <button className={`mini-chip ${clip.layer !== 'behind' ? 'active' : ''}`} onClick={() => set({ layer: 'front' })}>Frente</button>
            <button className={`mini-chip ${clip.layer === 'behind' ? 'active' : ''}`} onClick={() => set({ layer: 'behind' })}>Atrás</button>
          </div>
          <label className="field checkbox-field"><span>Chroma key</span><input type="checkbox" checked={!!chroma.enabled} onChange={(event) => set({ chroma: { ...chroma, enabled: event.target.checked } })} /></label>
          {chroma.enabled && (
            <>
              <label className="field color-field"><span>Cor chave</span><input type="color" value={chroma.color || '#00ff00'} onChange={(event) => set({ chroma: { ...chroma, color: event.target.value } })} /></label>
              <SliderField label="Sensibilidade" value={chroma.similarity ?? 0.32} min={0.08} max={0.8} onChange={(similarity) => set({ chroma: { ...chroma, similarity } })} format={(value) => `${Math.round(value * 100)}%`} />
            </>
          )}
        </div>
      )}

      {clip && track === 'audio' && tab === 'ajuste' && (
        <div className="fields">
          <div className="media-info-card"><strong>{media?.name}</strong><small>{formatTime(media?.duration ?? 0)}</small></div>
          <NumberField label="Início" value={clip.start} min={0} onChange={(start) => set({ start: Math.max(0, start) })} suffix="s" />
          <SliderField label="Volume" value={clip.volume ?? 1} max={2} format={(value) => `${Math.round(value * 100)}%`} onChange={(volume) => set({ volume })} />
          <SliderField label="Fade in" value={clip.fadeIn || 0} max={3} step={0.05} onChange={(fadeIn) => set({ fadeIn })} format={(value) => `${value.toFixed(2)}s`} />
          <SliderField label="Fade out" value={clip.fadeOut || 0} max={3} step={0.05} onChange={(fadeOut) => set({ fadeOut })} format={(value) => `${value.toFixed(2)}s`} />
          <SliderField label="Velocidade" value={clip.speed || 1} min={0.25} max={2} step={0.05} onChange={(speed) => set({ speed })} format={(value) => `${value.toFixed(2)}x`} />
        </div>
      )}

      {clip && track === 'audio' && tab === 'efeitos' && (
        <div className="fields">
          <VoiceChips active={clip.effects || []} onToggle={(effect) => dispatch({ type: 'toggleAudioEffect', track: 'audio', id: clip.id, effect })} />
        </div>
      )}

      {clip && track === 'transition' && (() => {
        const index = project.videoClips.findIndex((item) => item.id === clip.id);
        const prev = project.videoClips[index - 1];
        const room = transitionRoom(prev, clip);
        const active = clip.transitionIn?.type && clip.transitionIn.type !== 'none';
        const overlap = active ? transitionOverlap(prev, clip) : 0;
        const shown = overlap || Math.min(clip.transitionIn?.duration || 0.5, room);
        const minDur = Math.min(0.15, Math.max(MIN_TRANSITION, room));
        const packed = projectDuration(project);
        return (
          <div className="fields">
            <div className="media-info-card">
              <strong>{active ? transitionById(clip.transitionIn.type).name : 'Sem transição'}</strong>
              <small>
                {active
                  ? `Sobreposição real de ${shown.toFixed(2)} s neste corte. A edição fica ${shown.toFixed(2)} s mais curta aqui (não corta o arquivo). Duração da timeline: ${formatTime(packed)}.`
                  : 'A transição mistura os dois clipes no corte. Os pontos in/out não mudam.'}
              </small>
            </div>
            {active && <TransitionThumb id={clip.transitionIn.type} />}
            <button className="mini-chip" onClick={() => dispatch({ type: 'setTransition', id: clip.id, transition: null })}>Nenhuma</button>
            {active && room >= MIN_TRANSITION && (
              <SliderField label="Sobreposição" value={shown} min={minDur} max={room} step={0.05} onChange={(duration) => dispatch({ type: 'setTransition', id: clip.id, transition: { type: clip.transitionIn.type, duration } })} format={(value) => `${value.toFixed(2)}s`} />
            )}
            {active && room < MIN_TRANSITION && (
              <small className="field-hint">Clipes curtos demais para alargar esta transição.</small>
            )}
          </div>
        );
      })()}
    </aside>
  );
}

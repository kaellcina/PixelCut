import React, { useEffect, useRef, useState } from 'react';
import { effectById } from '../catalog.js';
import { audioMark, demoAmount, demoKind, demoReveal, effectTreatment, transitionDemo } from '../effectDemos.js';
import { clipZoom } from '../motion.js';
import { layerStyle, textMotion, transitionMix } from '../motion.js';

// Thumbnails render on a virtual 320x180 stage scaled to the tile, so effect pixel sizes
// (blur, vignette) look like they do on the preview stage.
const STAGE_W = 320;
const TICK_MS = 80;

const listeners = new Set();
let timer = null;
let tickCount = 0;

function subscribe(fn) {
  listeners.add(fn);
  if (!timer) {
    timer = window.setInterval(() => {
      tickCount += 1;
      listeners.forEach((listener) => listener(tickCount));
    }, TICK_MS);
  }
  return () => {
    listeners.delete(fn);
    if (!listeners.size) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

function useTick(active = true) {
  const [tick, setTick] = useState(tickCount);
  useEffect(() => (active ? subscribe(setTick) : undefined), [active]);
  return tick;
}

// Scale to the tile width, and only animate while the tile is on screen.
function useMiniStage() {
  const ref = useRef(null);
  const [scale, setScale] = useState(0.3);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const update = () => setScale(element.clientWidth / STAGE_W || 0.3);
    const resize = new ResizeObserver(update);
    resize.observe(element);
    update();
    const seen = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '60px' });
    seen.observe(element);
    return () => {
      resize.disconnect();
      seen.disconnect();
    };
  }, []);
  return { ref, scale, visible };
}

function MiniStage({ stage, children, mark, overlay }) {
  return (
    <div className={`mini-video${stage.visible ? ' is-live' : ''}`} ref={stage.ref} data-mark={mark || undefined} aria-hidden="true">
      <div className="mini-stage" style={{ transform: `scale(${stage.scale})` }}>{children}</div>
      {overlay}
    </div>
  );
}

// Two shots, drawn in the same flat style. A is blue with a circle (and a house, so a mirror
// and a blur have something to act on). B is orange with a square. They stay put: only the
// effect or the transition moves, so a split compare is the same picture at the same instant.
function DemoScene({ variant, filter, transform }) {
  const style = (filter || transform) ? { filter: filter || undefined, transform: transform || undefined } : undefined;
  if (variant === 'b') {
    return (
      <div className="demo-scene demo-b" style={style}>
        <span className="tree" />
        <span className="sq" />
        <span className="sq-in" />
      </div>
    );
  }
  return (
    <div className="demo-scene demo-a" style={style}>
      <span className="sun" />
      <span className="hill" />
      <span className="house" />
      <span className="roof" />
      <span className="door" />
      <span className="win" />
      <span className="fence" />
      <span className="head" />
      <span className="body" />
      <span className="nose" />
    </div>
  );
}

function EffectLayer({ id, amount, reveal, clip }) {
  const kind = demoKind(id);
  const shown = kind === 'reveal' ? (reveal > 0 ? 1 : 0) : (kind === 'tint' ? (amount > 0 ? 1 : 0) : amount);
  const treatment = effectTreatment(effectById(id), shown);
  const fade = kind === 'amount' ? amount : 1;
  if (!treatment.filter && !treatment.transform && !treatment.overlays.includes('vignette')) return null;
  return (
    <div className="mini-layer" style={{ clipPath: clip, opacity: kind === 'tint' && amount < 1 ? amount : undefined }}>
      <DemoScene variant="a" filter={treatment.filter} transform={treatment.transform} />
      {treatment.overlays.includes('vignette') && <div className="fx-vignette" style={fade < 1 ? { opacity: fade } : undefined} />}
    </div>
  );
}

// Grain uses the preview's own .fx-grain, once, in screen pixels. Inside the scaled stage
// the 0.6 px speck shrinks away, which is why it used to be redrawn larger.
function GrainOverlay({ id, amount, compare }) {
  if (effectById(id)?.overlay !== 'grain' || (!compare && amount <= 0)) return null;
  return (
    <div className="mini-grain" style={compare ? { clipPath: 'inset(0 0 0 50%)' } : undefined}>
      <div className="fx-grain" style={!compare && amount < 1 ? { opacity: 0.14 * amount } : undefined} />
    </div>
  );
}

function CompareTags() {
  return (
    <>
      <div className="mini-divider" />
      <span className="mini-tag left">Antes</span>
      <span className="mini-tag right">Depois</span>
    </>
  );
}

// `compare` is the enlarged peek. Color and lens effects share one frame, split in half.
// Mirror flips the whole frame, so each half shows the complete shot, one of them flipped:
// clipping a flipped frame in half would show different objects, not the mirror itself.
export function EffectThumb({ id, compare = false }) {
  const stage = useMiniStage();
  const tick = useTick(stage.visible && !compare);
  const kind = demoKind(id);
  const amount = compare ? 1 : demoAmount(tick);
  const reveal = compare ? 1 : demoReveal(tick);
  if (compare && id === 'mirror') {
    return (
      <MiniStage stage={stage} mark={id}>
        <div className="compare-fit"><div className="compare-scale"><DemoScene variant="a" /></div></div>
        <div className="compare-fit right"><div className="compare-scale"><DemoScene variant="a" transform="scaleX(-1)" /></div></div>
        <CompareTags />
      </MiniStage>
    );
  }
  const clip = compare
    ? 'inset(0 0 0 50%)'
    : (kind === 'reveal' && reveal < 1 ? `inset(0 ${(1 - reveal) * 100}% 0 0)` : undefined);
  return (
    <MiniStage stage={stage} mark={id} overlay={<GrainOverlay id={id} amount={compare ? 1 : amount} compare={compare} />}>
      <DemoScene variant="a" />
      <EffectLayer id={id} amount={compare ? 1 : amount} reveal={reveal} clip={clip} />
      {compare && <CompareTags />}
    </MiniStage>
  );
}

// Always the two synthetic shots, mixed by the same transitionMix the preview uses.
export function TransitionThumb({ id }) {
  const stage = useMiniStage();
  const tick = useTick(stage.visible);
  const demo = transitionDemo(tick);
  let content = null;
  if (demo.phase === 'a') content = <DemoScene variant="a" />;
  else if (demo.phase === 'b') content = <DemoScene variant="b" />;
  else if (demo.phase === 'mix') {
    const mix = transitionMix(id, demo.progress);
    content = (
      <>
        <div className="mini-layer" style={layerStyle(mix.a)}><DemoScene variant="a" /></div>
        <div className="mini-layer" style={layerStyle(mix.b)}><DemoScene variant="b" /></div>
      </>
    );
  }
  return <MiniStage stage={stage} mark={id}>{content}</MiniStage>;
}

const AUDIO_COLORS = { Personagem: '#7cffb2', Ambiente: '#6ec4ff', Aparelho: '#ffcf6e', Estilo: '#ff8fd0' };

export function AudioThumb({ id, group, playing }) {
  const mark = audioMark(id);
  return (
    <div className={`mini-scene audio-demo${playing ? ' playing' : ''}`} data-mark={id} aria-hidden="true" style={{ '--bar': AUDIO_COLORS[group] || '#6ec4ff' }}>
      {mark?.pitch && <i className={`pitch-mark ${mark.pitch}`} />}
      <svg viewBox="0 0 120 36" preserveAspectRatio="xMidYMid meet">
        {mark?.paths.map((d) => <path key={d} d={d} />)}
      </svg>
    </div>
  );
}

// Zoom uses the same clipZoom the preview applies. The frame stays covered because the scale never drops below 1.
export function ZoomThumb({ preset = 'zoomIn', compare = false }) {
  const stage = useMiniStage();
  const tick = useTick(stage.visible && !compare);
  const spec = preset === 'zoomOut' ? { from: 1.2, to: 1 } : { from: 1, to: 1.2 };
  const clip = { zoom: { preset, from: spec.from, to: spec.to, duration: 1.1 } };
  const scale = compare ? spec.to : clipZoom(clip, ((tick % 40) / 40) * 1.6, 1.6);
  const frame = (value) => <div className="demo-zoom" style={{ transform: `scale(${value})` }}><DemoScene variant="a" /></div>;
  return (
    <MiniStage stage={stage} mark={preset}>
      {compare ? frame(spec.from) : null}
      <div className="mini-layer" style={compare ? { clipPath: 'inset(0 0 0 50%)' } : undefined}>{frame(compare ? spec.to : scale)}</div>
      {compare && <CompareTags />}
    </MiniStage>
  );
}

// Text motion, using the same textMotion the preview applies. The sample word types out for Digitação.
export function TextAnimThumb({ id }) {
  const stage = useMiniStage();
  const tick = useTick(stage.visible);
  const time = ((tick % 32) / 32) * 1.4;
  const motion = textMotion({
    text: id === 'typewriter' ? 'Olá' : 'Aa',
    animation: id,
    duration: 3,
    animationDuration: 0.55,
    start: 0,
  }, time);
  return (
    <MiniStage stage={stage} mark={id}>
      <div className="demo-scene anim-stage">
        <span style={{
          opacity: motion.opacity,
          filter: motion.blur ? `blur(${motion.blur}px)` : undefined,
          transform: `translate(calc(-50% + ${motion.x}px), calc(-50% + ${motion.y}px)) scale(${motion.scale}) rotate(${motion.rotate}deg)`,
        }}
        >{motion.text || '\u00a0'}</span>
      </div>
    </MiniStage>
  );
}

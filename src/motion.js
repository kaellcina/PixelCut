import TEXT_GLOW from '../shared/text-glow.json' with { type: 'json' };

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

export const MAX_ANIM_SECONDS = 5;

export function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function animSeconds(requested, length, fallback) {
  const span = Math.max(0.05, Number(length) || 0.05);
  const value = Number(requested);
  return Math.min(MAX_ANIM_SECONDS, span, Math.max(0.05, Number.isFinite(value) ? value : fallback));
}

// Scale factor over the clip. 1 means the clip's own scale. Missing zoom leaves the clip alone.
export function clipZoom(clip, local, length) {
  const zoom = clip && clip.zoom;
  if (!zoom || !zoom.preset || zoom.preset === 'none') return 1;
  const from = Math.max(1, Number(zoom.from) || 1);
  const to = Math.max(1, Number(zoom.to) || from);
  const dur = animSeconds(zoom.duration, length, 1);
  return from + (to - from) * smoothstep(local / dur);
}

// Overlay entrance, multiplied by the clip's own opacity and scale. No field means no entrance.
export function overlayMotion(clip, local, length) {
  const baseScale = clip?.scale ?? 1;
  const baseOpacity = clip?.opacity ?? 1;
  const enter = clip?.enter;
  const type = enter?.type || 'none';
  let enterScale = 1;
  let enterOpacity = 1;
  if (type === 'fade' || type === 'scale' || type === 'both') {
    const dur = animSeconds(enter.duration, length, 0.6);
    const p = smoothstep(local / dur);
    if (type === 'fade' || type === 'both') enterOpacity = p;
    if (type === 'scale' || type === 'both') {
      const start = Math.min(1, Math.max(0.05, Number(enter.scale) || 0.85));
      enterScale = start + (1 - start) * p;
    }
  }
  return { scale: baseScale * enterScale * clipZoom(clip, local, length), opacity: baseOpacity * enterOpacity };
}

function rgbOf(hex) {
  const value = String(hex || '#ffffff').replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value.padEnd(6, '0');
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0);
}

// Export draws the same halo as a Gaussian-blurred copy (sigma in em); CSS blur radius = 2 * sigma.
function glowStyle(effect, color) {
  const spec = TEXT_GLOW[effect];
  const [r, g, b] = rgbOf(color);
  const core = rgbOf(color).map((c) => Math.round(c + (255 - c) * spec.core));
  return {
    color: `rgb(${core.join(',')})`,
    textShadow: `0 0 ${(spec.sigma * 2).toFixed(3)}em rgba(${r},${g},${b},${spec.alpha})`,
  };
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

export function textMotion(clip, time) {
  const local = time - clip.start;
  const duration = Math.max(0.05, clip.duration || 0.05);
  const anim = clip.animation || 'none';
  const animDur = Math.min(clip.animationDuration ?? 0.45, duration / 2);
  const tIn = anim === 'none' ? 1 : Math.min(1, Math.max(0, local / Math.max(0.05, animDur)));
  const tOut = Math.min(1, Math.max(0, (duration - local) / Math.max(0.05, animDur)));
  const enter = anim === 'pop' || anim === 'bounce' ? easeOutBack(tIn) : easeOutCubic(tIn);
  const leave = easeOutCubic(tOut);

  let opacity = 1;
  let x = 0;
  let y = 0;
  let scale = 1;
  let rotate = 0;
  let blur = 0;
  let text = clip.text || '';

  switch (anim) {
    case 'fade':
      opacity = Math.min(enter, leave);
      break;
    case 'slideUp':
      opacity = Math.min(enter, leave);
      y = (1 - enter) * 46;
      break;
    case 'slideDown':
      opacity = Math.min(enter, leave);
      y = (1 - enter) * -46;
      break;
    case 'slideLeft':
      opacity = Math.min(enter, leave);
      x = (1 - enter) * 70;
      break;
    case 'slideRight':
      opacity = Math.min(enter, leave);
      x = (1 - enter) * -70;
      break;
    case 'zoom':
      opacity = Math.min(enter, leave);
      scale = 0.55 + 0.45 * enter;
      break;
    case 'pop':
      opacity = Math.min(Math.min(1, tIn * 3), leave);
      scale = 0.2 + 0.8 * enter;
      break;
    case 'bounce':
      opacity = Math.min(enter, leave);
      y = Math.sin(enter * Math.PI) * (1 - enter) * 28;
      scale = 0.86 + 0.14 * enter;
      break;
    case 'rotate':
      opacity = Math.min(enter, leave);
      rotate = (1 - enter) * -18;
      scale = 0.85 + 0.15 * enter;
      break;
    case 'typewriter': {
      const count = Math.max(0, Math.round((clip.text || '').length * tIn));
      text = (clip.text || '').slice(0, count);
      opacity = leave;
      break;
    }
    case 'blurIn':
      opacity = Math.min(enter, leave);
      blur = (1 - enter) * 10;
      scale = 1.04 - 0.04 * enter;
      break;
    default:
      break;
  }

  return { opacity, x, y, scale, rotate, blur, text };
}

export function letterStyle(clip) {
  const color = clip.color || '#ffffff';
  const stroke = clip.strokeColor || '#000000';
  const width = clip.strokeWidth || 2;
  switch (clip.letterEffect || 'outline') {
    case 'outline':
      return { WebkitTextStroke: `${width}px ${stroke}`, paintOrder: 'stroke fill' };
    case 'thick':
      return { WebkitTextStroke: `${Math.max(4, width + 2)}px ${stroke}`, paintOrder: 'stroke fill' };
    case 'shadow':
      return { textShadow: `3px 3px 0 ${clip.shadowColor || '#000'}` };
    case 'glow':
    case 'neon':
      return glowStyle(clip.letterEffect, color);
    case 'hollow':
      return { WebkitTextStroke: `${Math.max(2, width)}px ${color}`, color: 'transparent', paintOrder: 'stroke' };
    case 'double':
      return { WebkitTextStroke: `${Math.max(3, width + 1)}px ${stroke}`, textShadow: `0 0 0 ${stroke}, 4px 4px 0 ${clip.shadowColor || '#111'}` };
    case 'sticker':
      return { WebkitTextStroke: `${Math.max(5, width + 3)}px #fff`, paintOrder: 'stroke fill', textShadow: '0 3px 0 #000' };
    case '3d':
      return { textShadow: '1px 1px 0 #171717, 2px 2px 0 #171717, 3px 3px 0 #171717, 4px 4px 8px #0008' };
    case 'background':
      return { background: clip.backgroundColor || 'rgba(0,0,0,.72)', padding: '0.12em 0.42em', borderRadius: 8 };
    case 'spacious':
      return { letterSpacing: '0.16em', textShadow: '0 1px 2px #000a' };
    default:
      return { textShadow: '0 1px 2px #0008' };
  }
}

export function transitionMix(type, progress) {
  const p = Math.max(0, Math.min(1, progress));
  switch (type) {
    case 'fadeblack':
      return p < 0.5
        ? { a: { opacity: 1 - p * 2 }, b: { opacity: 0 } }
        : { a: { opacity: 0 }, b: { opacity: (p - 0.5) * 2 } };
    case 'fadewhite':
      return p < 0.5
        ? { a: { opacity: 1, brightness: 1 + p * 3 }, b: { opacity: 0 } }
        : { a: { opacity: 0 }, b: { opacity: 1, brightness: 1 + (1 - p) * 3 } };
    case 'slideleft':
      return { a: { x: `${-p * 100}%` }, b: { x: `${(1 - p) * 100}%`, opacity: 1 } };
    case 'slideright':
      return { a: { x: `${p * 100}%` }, b: { x: `${(p - 1) * 100}%`, opacity: 1 } };
    case 'slideup':
      return { a: { y: `${-p * 100}%` }, b: { y: `${(1 - p) * 100}%`, opacity: 1 } };
    case 'slidedown':
      return { a: { y: `${p * 100}%` }, b: { y: `${(p - 1) * 100}%`, opacity: 1 } };
    case 'wipeleft':
      return { a: { opacity: 1 }, b: { clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`, opacity: 1 } };
    case 'wiperight':
      return { a: { opacity: 1 }, b: { clipPath: `inset(0 0 0 ${(1 - p) * 100}%)`, opacity: 1 } };
    case 'wipeup':
      return { a: { opacity: 1 }, b: { clipPath: `inset(${(1 - p) * 100}% 0 0 0)`, opacity: 1 } };
    case 'wipedown':
      return { a: { opacity: 1 }, b: { clipPath: `inset(0 0 ${(1 - p) * 100}% 0)`, opacity: 1 } };
    case 'circleclose':
      return { a: { clipPath: `circle(${(1 - p) * 80}% at 50% 50%)`, opacity: 1 }, b: { opacity: p } };
    case 'diagtl':
      return { a: { x: `${-p * 40}%`, y: `${-p * 40}%`, opacity: 1 - p }, b: { x: `${(1 - p) * 40}%`, y: `${(1 - p) * 40}%`, opacity: p } };
    case 'squeezeh':
      return { a: { scale: 1 - p * 0.5, opacity: 1 - p }, b: { clipPath: `inset(0 ${(1 - p) * 50}% 0 ${(1 - p) * 50}%)`, opacity: 1 } };
    case 'fadegrays':
      return { a: { opacity: 1 - p, brightness: 1 - p * 0.5 }, b: { opacity: p } };
    case 'circle':
      return { a: { opacity: 1 }, b: { clipPath: `circle(${p * 80}% at 50% 50%)`, opacity: 1 } };
    case 'zoom':
      return { a: { scale: 1 + p * 0.18, opacity: 1 - p * 0.35 }, b: { scale: 1.22 - p * 0.22, opacity: p } };
    case 'radial':
      return { a: { opacity: 1 - p }, b: { opacity: p, scale: 1.08 - p * 0.08 } };
    case 'pixelize':
      return { a: { opacity: 1 - p, blur: p * 8 }, b: { opacity: p, blur: (1 - p) * 8 } };
    case 'hblur':
      return { a: { opacity: 1 - p, blur: p * 14 }, b: { opacity: p, blur: (1 - p) * 14 } };
    case 'distance':
      return { a: { scale: 1 - p * 0.12, opacity: 1 - p }, b: { scale: 1.12 - p * 0.12, opacity: p } };
    case 'smoothleft':
      return { a: { x: `${-p * 28}%`, opacity: 1 - p }, b: { x: `${(1 - p) * 28}%`, opacity: p } };
    case 'vertopen':
      return { a: { opacity: 1 }, b: { clipPath: `inset(${(1 - p) * 50}% 0 ${(1 - p) * 50}% 0)`, opacity: 1 } };
    case 'horzopen':
      return { a: { opacity: 1 }, b: { clipPath: `inset(0 ${(1 - p) * 50}% 0 ${(1 - p) * 50}%)`, opacity: 1 } };
    default:
      return { a: { opacity: 1 - p }, b: { opacity: p } };
  }
}

export function layerStyle(mix = {}) {
  const x = mix.x || '0px';
  const y = mix.y || '0px';
  const scale = mix.scale ?? 1;
  const filter = [
    mix.blur ? `blur(${mix.blur}px)` : '',
    mix.brightness ? `brightness(${mix.brightness})` : '',
  ].filter(Boolean).join(' ');
  return {
    opacity: mix.opacity ?? 1,
    transform: `translate(${x}, ${y}) scale(${scale})`,
    clipPath: mix.clipPath,
    filter: filter || undefined,
  };
}

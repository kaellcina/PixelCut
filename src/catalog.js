import AUDIO_FX from '../shared/audio-effects.json' with { type: 'json' };

export const TEXT_FONTS = [
  { id: 'montserrat', name: 'Montserrat', family: '"Montserrat", "Segoe UI", sans-serif', file: 'arialbd.ttf' },
  { id: 'poppins', name: 'Poppins', family: '"Poppins", "Segoe UI", sans-serif', file: 'arialbd.ttf' },
  { id: 'oswald', name: 'Oswald', family: '"Oswald", Impact, sans-serif', file: 'arialbd.ttf' },
  { id: 'anton', name: 'Anton', family: '"Anton", Impact, sans-serif', file: 'impact.ttf' },
  { id: 'bebas', name: 'Bebas Neue', family: '"Bebas Neue", Impact, sans-serif', file: 'impact.ttf' },
  { id: 'roboto', name: 'Roboto', family: '"Roboto", "Segoe UI", sans-serif', file: 'arial.ttf' },
  { id: 'playfair', name: 'Playfair', family: '"Playfair Display", Georgia, serif', file: 'georgia.ttf' },
  { id: 'pacifico', name: 'Pacifico', family: '"Pacifico", "Segoe Script", cursive', file: 'segoesc.ttf' },
  { id: 'dancing', name: 'Dancing', family: '"Dancing Script", "Segoe Script", cursive', file: 'segoesc.ttf' },
  { id: 'comfortaa', name: 'Comfortaa', family: '"Comfortaa", Candara, sans-serif', file: 'calibri.ttf' },
  { id: 'arial', name: 'Arial', family: 'Arial, sans-serif', file: 'arial.ttf' },
  { id: 'impact', name: 'Impact', family: 'Impact, sans-serif', file: 'impact.ttf' },
  { id: 'georgia', name: 'Georgia', family: 'Georgia, serif', file: 'georgia.ttf' },
  { id: 'times', name: 'Times', family: '"Times New Roman", Times, serif', file: 'times.ttf' },
  { id: 'comic', name: 'Comic', family: '"Comic Sans MS", "Comic Sans", sans-serif', file: 'comic.ttf' },
  { id: 'courier', name: 'Courier', family: '"Courier New", Courier, monospace', file: 'cour.ttf' },
  { id: 'verdana', name: 'Verdana', family: 'Verdana, sans-serif', file: 'verdana.ttf' },
  { id: 'trebuchet', name: 'Trebuchet', family: '"Trebuchet MS", sans-serif', file: 'trebuc.ttf' },
  { id: 'segoe', name: 'Segoe UI', family: '"Segoe UI", sans-serif', file: 'segoeui.ttf' },
  { id: 'script', name: 'Script', family: '"Segoe Script", cursive', file: 'segoesc.ttf' },
  { id: 'ink', name: 'Ink Free', family: '"Ink Free", "Segoe Script", cursive', file: 'Inkfree.ttf' },
  { id: 'consolas', name: 'Consolas', family: 'Consolas, monospace', file: 'consola.ttf' },
  { id: 'calibri', name: 'Calibri', family: 'Calibri, sans-serif', file: 'calibri.ttf' },
  { id: 'gabriola', name: 'Gabriola', family: 'Gabriola, serif', file: 'Gabriola.ttf' },
];

export const CLIP_MOTIONS = [
  { id: 'zoomIn', name: 'Zoom In', from: 1, to: 1.2 },
  { id: 'zoomOut', name: 'Zoom Out', from: 1.2, to: 1 },
];

export const ENTER_ANIMS = [
  { id: 'none', name: 'Nenhuma' },
  { id: 'fade', name: 'Fade In' },
  { id: 'scale', name: 'Scale In' },
  { id: 'both', name: 'Fade + Scale' },
];

export const TEXT_ANIMS = [
  { id: 'none', name: 'Nenhuma' },
  { id: 'fade', name: 'Fade' },
  { id: 'slideUp', name: 'Subir' },
  { id: 'slideDown', name: 'Descer' },
  { id: 'slideLeft', name: 'Esquerda' },
  { id: 'slideRight', name: 'Direita' },
  { id: 'zoom', name: 'Zoom' },
  { id: 'pop', name: 'Pop' },
  { id: 'bounce', name: 'Bounce' },
  { id: 'rotate', name: 'Giro' },
  { id: 'typewriter', name: 'Digitação' },
  { id: 'blurIn', name: 'Foco' },
];

export const LETTER_FX = [
  { id: 'none', name: 'Limpo' },
  { id: 'outline', name: 'Borda' },
  { id: 'thick', name: 'Contorno' },
  { id: 'shadow', name: 'Sombra' },
  { id: 'glow', name: 'Glow' },
  { id: 'neon', name: 'Neon' },
  { id: 'hollow', name: 'Vazado' },
  { id: 'double', name: 'Duplo' },
  { id: 'sticker', name: 'Sticker' },
  { id: 'background', name: 'Caixa' },
  { id: '3d', name: '3D' },
  { id: 'spacious', name: 'Espaçado' },
];

export const TEXT_PRESETS = [
  { id: 'title', name: 'Título', text: 'TÍTULO', size: 72, y: 0.5, font: 'bebas', animation: 'pop', letterEffect: 'outline', bold: true },
  { id: 'subtitle', name: 'Subtítulo', text: 'Subtítulo', size: 42, y: 0.62, font: 'montserrat', animation: 'fade', letterEffect: 'shadow', bold: false },
  { id: 'caption', name: 'Legenda', text: 'Sua legenda', size: 36, y: 0.86, font: 'roboto', animation: 'slideUp', letterEffect: 'background', bold: true },
  { id: 'lower', name: 'Lower third', text: 'Nome · Função', size: 34, x: 0.22, y: 0.82, font: 'oswald', animation: 'slideLeft', letterEffect: 'outline', bold: true },
  { id: 'impact', name: 'Impacto', text: 'UAU', size: 96, y: 0.5, font: 'anton', animation: 'zoom', letterEffect: 'neon', bold: true },
];

export const VIDEO_EFFECTS = [
  { id: 'blur', name: 'Desfoque', group: 'Lente', filter: 'blur(4px)' },
  { id: 'vignette', name: 'Vinheta', group: 'Lente', overlay: 'vignette' },
  { id: 'grain', name: 'Granulado', group: 'Lente', overlay: 'grain' },
  { id: 'glow', name: 'Glow', group: 'Lente', filter: 'brightness(1.12) contrast(1.06)' },
  { id: 'dream', name: 'Sonho', group: 'Lente', filter: 'blur(1.1px) brightness(1.08) contrast(0.96)' },
  { id: 'mirror', name: 'Espelho', group: 'Lente', transform: 'scaleX(-1)' },
  { id: 'pixel', name: 'Pixel', group: 'Lente', filter: 'contrast(1.2)' },
  { id: 'glitch', name: 'Glitch', group: 'Lente', filter: 'hue-rotate(20deg) saturate(1.4)' },
  { id: 'bw', name: 'P&B', group: 'Cor', filter: 'grayscale(1)' },
  { id: 'sepia', name: 'Sépia', group: 'Cor', filter: 'sepia(0.85)' },
  { id: 'vintage', name: 'Vintage', group: 'Cor', filter: 'sepia(0.42) contrast(1.12) saturate(0.82)', overlay: 'vignette' },
  { id: 'cinematic', name: 'Cinema', group: 'Cor', filter: 'contrast(1.18) saturate(0.78) brightness(0.96)', overlay: 'vignette' },
  { id: 'warm', name: 'Quente', group: 'Cor', filter: 'sepia(0.22) saturate(1.18) brightness(1.04)' },
  { id: 'cold', name: 'Frio', group: 'Cor', filter: 'hue-rotate(-14deg) saturate(0.92) brightness(1.04)' },
  { id: 'vivid', name: 'Vivo', group: 'Cor', filter: 'saturate(1.55) contrast(1.12)' },
  { id: 'noir', name: 'Noir', group: 'Cor', filter: 'grayscale(1) contrast(1.32) brightness(0.9)', overlay: 'vignette' },
  { id: 'invert', name: 'Negativo', group: 'Cor', filter: 'invert(1)' },
  { id: 'sunset', name: 'Pôr do sol', group: 'Cor', filter: 'sepia(0.35) hue-rotate(-15deg) saturate(1.4) contrast(1.1)' },
  { id: 'night', name: 'Noite', group: 'Cor', filter: 'brightness(0.7) saturate(0.65) hue-rotate(-20deg) contrast(1.08)' },
  { id: 'teal', name: 'Teal & Orange', group: 'Cor', filter: 'contrast(1.15) saturate(1.25) hue-rotate(-8deg)' },
  { id: 'polaroid', name: 'Polaroid', group: 'Cor', filter: 'contrast(0.92) saturate(1.2) sepia(0.18) brightness(1.06)' },
  { id: 'bleach', name: 'Bleach', group: 'Cor', filter: 'contrast(1.35) saturate(0.55) brightness(1.08)' },
  { id: 'cartoon', name: 'Cartoon', group: 'Cor', filter: 'contrast(1.4) saturate(1.45) brightness(1.05)' },
];

export const AUDIO_EFFECTS = AUDIO_FX.map(({ id, name, group }) => ({ id, name, group }));
export const AUDIO_GROUPS = [...new Set(AUDIO_EFFECTS.map((effect) => effect.group))];

export const TRANSITIONS = [
  { id: 'dissolve', name: 'Dissolver', ffmpeg: 'fade' },
  { id: 'fadeblack', name: 'Fade preto', ffmpeg: 'fadeblack' },
  { id: 'fadewhite', name: 'Flash', ffmpeg: 'fadewhite' },
  { id: 'slideleft', name: 'Deslizar ←', ffmpeg: 'slideleft' },
  { id: 'slideright', name: 'Deslizar →', ffmpeg: 'slideright' },
  { id: 'slideup', name: 'Deslizar ↑', ffmpeg: 'slideup' },
  { id: 'slidedown', name: 'Deslizar ↓', ffmpeg: 'slidedown' },
  { id: 'wipeleft', name: 'Wipe ←', ffmpeg: 'wipeleft' },
  { id: 'wiperight', name: 'Wipe →', ffmpeg: 'wiperight' },
  { id: 'wipeup', name: 'Wipe ↑', ffmpeg: 'wipeup' },
  { id: 'wipedown', name: 'Wipe ↓', ffmpeg: 'wipedown' },
  { id: 'circle', name: 'Círculo', ffmpeg: 'circleopen' },
  { id: 'circleclose', name: 'Fechar', ffmpeg: 'circleclose' },
  { id: 'zoom', name: 'Zoom', ffmpeg: 'zoomin' },
  { id: 'radial', name: 'Radial', ffmpeg: 'radial' },
  { id: 'pixelize', name: 'Pixelizar', ffmpeg: 'pixelize' },
  { id: 'hblur', name: 'Blur', ffmpeg: 'hblur' },
  { id: 'distance', name: 'Distância', ffmpeg: 'distance' },
  { id: 'smoothleft', name: 'Suave ←', ffmpeg: 'smoothleft' },
  { id: 'vertopen', name: 'Abrir', ffmpeg: 'vertopen' },
  { id: 'horzopen', name: 'Abrir H', ffmpeg: 'horzopen' },
  { id: 'diagtl', name: 'Diagonal', ffmpeg: 'diagtl' },
  { id: 'squeezeh', name: 'Squeeze', ffmpeg: 'squeezeh' },
  { id: 'fadegrays', name: 'Cinza', ffmpeg: 'fadegrays' },
];

export const ASPECTS = [
  { id: '16:9', name: '16:9', label: 'Horizontal', width: 1920, height: 1080 },
  { id: '9:16', name: '9:16', label: 'Stories', width: 1080, height: 1920 },
  { id: '1:1', name: '1:1', label: 'Quadrado', width: 1080, height: 1080 },
  { id: '4:5', name: '4:5', label: 'Feed', width: 1080, height: 1350 },
  { id: '4:3', name: '4:3', label: 'Clássico', width: 1440, height: 1080 },
  { id: '21:9', name: '21:9', label: 'Cinema', width: 2560, height: 1080 },
];

export function fontById(id) {
  return TEXT_FONTS.find((item) => item.id === id) || TEXT_FONTS[0];
}

export function effectById(id) {
  return VIDEO_EFFECTS.find((item) => item.id === id) || null;
}

export function transitionById(id) {
  return TRANSITIONS.find((item) => item.id === id) || TRANSITIONS[0];
}

export function aspectOf(project) {
  return ASPECTS.find((item) => item.width === project.width && item.height === project.height)
    || ASPECTS.find((item) => Math.abs(item.width / item.height - project.width / project.height) < 0.03)
    || { id: 'custom', name: `${project.width}×${project.height}` };
}

export function composeVideoStyle(clip) {
  const params = clip.effectParams || {};
  const effects = clip.effects || [];
  const filters = [];
  const overlays = new Set();
  let transform = '';

  const blur = (params.blur || 0) + (effects.includes('blur') ? 4 : 0);
  if (blur > 0) filters.push(`blur(${blur}px)`);
  filters.push(`brightness(${1 + (params.brightness || 0)})`);
  filters.push(`contrast(${1 + (params.contrast || 0)})`);
  filters.push(`saturate(${1 + (params.saturation || 0)})`);

  effects.forEach((id) => {
    const effect = effectById(id);
    if (!effect) return;
    if (effect.filter && id !== 'blur') filters.push(effect.filter);
    if (effect.overlay) overlays.add(effect.overlay);
    if (effect.transform) transform = effect.transform;
  });

  return { filter: filters.join(' '), transform, overlays: [...overlays] };
}

// Same blend the export chromakey uses (electron/ffmpeg.cjs). Not a stored project setting.
export const CHROMA_BLEND = 0.08;

// FFmpeg chromakey distance. The preview used to measure RGB Manhattan, so a pixel
// blended by the canvas scale stayed opaque and green. Similarity values already
// saved in projects are unchanged; they now use this same scale as the export.
export function chromaMatte(r, g, b, key, similarity = 0.32) {
  const kr = key[0];
  const kg = key[1];
  const kb = key[2];
  const du = (-0.168736 * (r - kr)) + (-0.331264 * (g - kg)) + (0.5 * (b - kb));
  const dv = (0.5 * (r - kr)) + (-0.418688 * (g - kg)) + (-0.081312 * (b - kb));
  const diff = Math.sqrt((du * du + dv * dv) / (2 * 255 * 255));
  const sim = Math.max(0.01, Math.min(1, Number(similarity) || 0.32));
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  let alpha = 1;
  // Near-gray and near-black pixels have unstable chroma. Keeping them preserves
  // hair and translucent detail that the screen color would otherwise swallow.
  if (sat >= 36) {
    if (diff <= sim) alpha = 0;
    else if (diff < sim + CHROMA_BLEND) alpha = (diff - sim) / CHROMA_BLEND;
  }
  let gg = g;
  if (alpha < 1 && gg > r && gg > b) gg = Math.round(gg - (gg - Math.max(r, b)) * (1 - alpha));
  return { r, g: gg, b, alpha };
}

export function hexToRgb(hex) {
  const value = String(hex || '#00ff00').replace('#', '');
  const full = value.length === 3 ? value.split('').map((channel) => channel + channel).join('') : value.padEnd(6, '0');
  return [0, 2, 4].map((index) => {
    const parsed = parseInt(full.slice(index, index + 2), 16);
    return Number.isFinite(parsed) ? parsed : 0;
  });
}

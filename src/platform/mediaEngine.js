// Desktop export stays in electron/ffmpeg.cjs and is not loaded here.
// Android can encode the main track, audio, text, image overlays and a native effect subset.
// Video overlays, chroma, remaining grades and voice effects stay listed below.

export const EXPORT_UNAVAILABLE = 'A exportação ainda não grava MP4 neste aparelho. A prévia usa o player do sistema, mas o FFmpeg do Windows não roda no Android.';

export function engineFor(kind) {
  if (kind === 'electron') {
    return {
      id: 'ffmpeg',
      ready: true,
      summary: 'FFmpeg do Windows, no aplicativo de mesa.',
    };
  }
  if (kind === 'android') {
    return {
      id: 'media3-transformer',
      ready: true,
      summary: 'MP4 com faixa principal, transições, velocidade, volume, músicas, textos, imagens sobrepostas e efeitos visuais compatíveis com Media3. Vídeos sobrepostos, chroma e efeitos avançados ainda não entram.',
    };
  }
  return {
    id: 'none',
    ready: false,
    summary: EXPORT_UNAVAILABLE,
  };
}

// Operations the desktop chain already performs, and what Android still leaves out.
// The main track is encoded. Nothing in this list is applied to the MP4.
export const ANDROID_NATIVE_GAPS = [
  {
    id: 'compose',
    desktop: 'Vários clipes e faixas entram num filtergraph do FFmpeg.',
    android: 'A faixa principal, textos, sobreposições de imagem e faixas de áudio entram na composição. Vídeos sobrepostos ainda ficam de fora.',
  },
  {
    id: 'transition',
    desktop: 'xfade com a duração e o overlap já calculados no projeto.',
    android: 'Dissolver, fade preto/branco e wipe usam duas sequências do Transformer. Os demais tipos saem como dissolver. FFmpeg xfade continua só no Windows.',
  },
  {
    id: 'zoom',
    desktop: 'zoompan a partir do centro, com a mesma curva da prévia.',
    android: 'O zoom da faixa principal usa uma matriz GL por clipe com a mesma curva smoothstep da prévia.',
  },
  {
    id: 'chroma',
    desktop: 'chromakey com similaridade e blend 0.08.',
    android: 'Não existe chroma key pronto no Transformer. A prévia em canvas continua; a exportação não.',
  },
  {
    id: 'overlay',
    desktop: 'Overlay com opacidade, escala e fade em curva smoothstep.',
    android: 'Imagens entram com posição, escala, opacidade, entrada e zoom. Vídeos sobrepostos ainda não entram.',
  },
  {
    id: 'grade',
    desktop: 'Filtros de cor, desfoque e os efeitos visuais do catálogo.',
    android: 'Brilho, contraste, saturação, blur, P&B/noir, espelho, vivo, frio, glow, sonho, noite, teal, bleach e cartoon usam efeitos Media3. Os demais continuam avisados.',
  },
  {
    id: 'text',
    desktop: 'drawtext com as fontes de C:/Windows/Fonts.',
    android: 'Texto, posição, estilos e animações entram como overlay bitmap, usando famílias equivalentes do Android. Digitação é progressiva.',
  },
  {
    id: 'voice',
    desktop: 'Cadeia de áudio do FFmpeg, inclusive rubberband.',
    android: 'A prévia pode usar o WebAudio do aparelho. A exportação dessa cadeia não existe.',
  },
  {
    id: 'audioMix',
    desktop: 'Volume do clipe e a faixa de música entram no mix.',
    android: 'Volume, trim, velocidade, fades e faixas de música entram no mixer. Efeitos de voz ainda não entram.',
  },
];

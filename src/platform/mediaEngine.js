// Desktop export stays in electron/ffmpeg.cjs and is not loaded here.
// Android can encode the main track. Transitions, overlays, text, chroma,
// grades and voice effects stay listed below and are not reported as done.

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
      summary: 'Faixa principal em MP4: corte, sequência, dissolver, fade, wipe, imagens, velocidade e áudio original. Sobreposições, texto, chroma, efeitos visuais e a faixa de música não entram no arquivo.',
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
    android: 'A faixa principal é concatenada em corte seco ou sobreposta no overlap das transições. Sobreposição, texto e a faixa de áudio separada ficam de fora.',
  },
  {
    id: 'transition',
    desktop: 'xfade com a duração e o overlap já calculados no projeto.',
    android: 'Dissolver, fade preto/branco e wipe usam duas sequências do Transformer. Os demais tipos saem como dissolver. FFmpeg xfade continua só no Windows.',
  },
  {
    id: 'zoom',
    desktop: 'zoompan a partir do centro, com a mesma curva da prévia.',
    android: 'A animação de escala precisa de um efeito GL por quadro. A prévia CSS continua.',
  },
  {
    id: 'chroma',
    desktop: 'chromakey com similaridade e blend 0.08.',
    android: 'Não existe chroma key pronto no Transformer. A prévia em canvas continua; a exportação não.',
  },
  {
    id: 'overlay',
    desktop: 'Overlay com opacidade, escala e fade em curva smoothstep.',
    android: 'Os clipes de sobreposição não entram no arquivo. A composição do Transformer não faz o fade em curva da prévia.',
  },
  {
    id: 'grade',
    desktop: 'Filtros de cor, desfoque e os efeitos visuais do catálogo.',
    android: 'Parte cabe em efeitos do Media3. A lista do catálogo ainda não foi mapeada.',
  },
  {
    id: 'text',
    desktop: 'drawtext com as fontes de C:/Windows/Fonts.',
    android: 'As fontes do Windows não existem no aparelho. O texto da prévia usa CSS.',
  },
  {
    id: 'voice',
    desktop: 'Cadeia de áudio do FFmpeg, inclusive rubberband.',
    android: 'A prévia pode usar o WebAudio do aparelho. A exportação dessa cadeia não existe.',
  },
  {
    id: 'audioMix',
    desktop: 'Volume do clipe e a faixa de música entram no mix.',
    android: 'O áudio original do vídeo sai inteiro ou é removido. Volume parcial e a faixa de música não entram.',
  },
];

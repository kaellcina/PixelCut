# PixelCut — atualização de interface e timeline

Esta atualização de desenvolvimento torna a área de edição mais próxima de um editor multipista moderno. Ainda não é um lançamento público.

## Interface
- Biblioteca com abas de Mídia, Áudio, Texto, Efeitos e Transições.
- Monitor de pré-visualização com dimensões calculadas para a área disponível e estado de carregamento/erro.
- Inspetor de propriedades em português e tema azul-marinho/ciano.
- Timeline multipista com faixa principal, sobreposição, texto, efeitos, transições e áudio.

## Fluxo de edição
- Arrastar vídeo da biblioteca para inserir na faixa de vídeo principal, usando a posição de soltura para escolher o ponto de inserção.
- Arrastar áudio da biblioteca para inserir na faixa de áudio na posição de soltura.
- Atalhos: Space reproduz/pausa; S, Ctrl+B ou Ctrl+K divide no cursor; Delete remove o clipe selecionado; Ctrl+Z desfaz; Ctrl+Y ou Ctrl+Shift+Z refaz; setas navegam por quadros; Shift+setas navegam por um segundo; Home/End vão ao início/fim.

## Limitações conhecidas
- A exportação Windows usa a duração total da timeline (`projectDuration` em `shared/timeline-duration.cjs`): o MP4 dura até o último fim entre vídeo principal, sobreposições, textos e áudio. Depois do fim de V1 o canvas é preto, igual ao preview; o último quadro não é congelado.
- A exportação Android permanece só na faixa principal e não entra em paridade com o Windows.
- Testes de exportação e compilação devem ser executados novamente na máquina de desenvolvimento após a atualização.
- Antes de distribuição pública, complete a corresponding source GPL do FFmpeg 6.1.1 e os avisos de terceiros. O `LICENSE` do PixelCut (se for publicado) é do titular deste projeto, não de um editor de terceiros. Consulte `DISTRIBUTION_STATUS.md`.

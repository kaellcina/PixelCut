# PixelCut 0.1.0 — primeira base de desenvolvimento

Esta é uma versão inicial para desenvolvimento e validação, não um lançamento final.

## Identidade visual

- Marca provisória PixelCut.
- Ícone em pixel art com paleta azul e ciano.
- Interface em azul-marinho e cinza-azulado.

## Recursos presentes no código desta versão

- Importação de mídia de vídeo e áudio pelos formatos aceitos no seletor.
- Pré-visualização de vídeo e áudio.
- Linha do tempo com vídeo magnético, texto e música.
- Divisão, exclusão, ajuste de limites e reorganização de clipes.
- Desfazer/refazer.
- Abrir e salvar projetos em JSON.
- Exportação MP4 por FFmpeg.
- No Windows, a duração exportada acompanha a timeline (incluindo sobreposição, texto e áudio que ultrapassam o vídeo principal). A exportação Android continua restrita à faixa principal.

## Antes de uma distribuição pública

O `package.json` declara MIT e não há arquivo `LICENSE` nesta árvore — isso é documentação do PixelCut, a cargo do titular. A distribuição pública continua bloqueada pela corresponding source GPL do FFmpeg/FFprobe 6.1.1 (incompleta) e pela ausência de Authenticode. Consulte `DISTRIBUTION_STATUS.md`.

# Avisos de direitos autorais — compilação PixelCut FFmpeg n6.1.1

Estes avisos cobrem o par `ffmpeg.exe` / `ffprobe.exe` gerado por `scripts/build-all.sh` e vendorizado em `PixelCut/third-party/ffmpeg/` (Fase 5). Uma cópia Gyan fica só em `gyan-6.1.1-rollback/` e **não** é distribuída.

Isto **não** é uma declaração de conformidade GPL do produto PixelCut nem autorização para publicar. O editor é MIT, Copyright (c) 2026 Kaell Soares Calacina; esse copyright **não** cobre estes executáveis (GPL-2.0-or-later).

## Binário gerado

A linha de `configure` inclui `--enable-gpl` e **não** inclui `--enable-version3` nem `--enable-nonfree`. O executável é, portanto, **GPL-2.0-or-later** na leitura do `configure` do FFmpeg 6.1.1, porque liga x264, Rubber Band, o filtro GPL `eq`, e o restante do grafo.

Combinação com o código MIT do editor: ver `docs/FFMPEG_LICENCIAMENTO.md` e `docs/X264_GPLV3.md`. Pendente.

## Componentes pinados (`archives/`)

| Componente | Origem | Licença lida no arquivo | Notas |
|---|---|---|---|
| FFmpeg 6.1.1 (`n6.1.1` / `e38092ef9395d7049f871ef4d5411eb410e283e0`) | https://ffmpeg.org/releases/ffmpeg-6.1.1.tar.xz | LGPL-2.1+ no fonte; o **exe** desta receita é GPL-2+ | `COPYING.GPLv2`, `COPYING.GPLv3`, `COPYING.LGPLv2.1` |
| x264 `c1c9931dc87289b8aeba78150467f17bdb97d019` | https://code.videolan.org/videolan/x264.git (archive git) | GPL-2.0-or-later nos cabeçalhos; x264.org «GPL 2.0 e não 3.0» | Consulta `docs/CONSULTA_JURIDICA_X264_GPLV3.md` |
| Rubber Band 1.8.1 | https://breakfastquay.com/files/releases/rubberband-1.8.1.tar.bz2 | GPL-2.0-or-later | COPYING no tarball |
| FFTW 3.3.10 | http://www.fftw.org/fftw-3.3.10.tar.gz (espelho Debian orig, mesmo SHA) | GPL-2.0-or-later | COPYING |
| libsamplerate 0.2.2 | https://github.com/libsndfile/libsamplerate/releases | BSD-2-Clause | COPYING |
| Freetype 2.13.2 | https://download.savannah.gnu.org/releases/freetype/freetype-2.13.2.tar.xz | FTL **ou** GPL-2 | `docs/FTL.TXT`, `docs/GPLv2.TXT` |
| HarfBuzz 8.3.0 | https://github.com/harfbuzz/harfbuzz/releases/download/8.3.0/harfbuzz-8.3.0.tar.xz | MIT (com UCDN ISC) | COPYING |
| zlib 1.3.1 | https://www.zlib.net/fossils/zlib-1.3.1.tar.gz | zlib | LICENSE |

Hashes: `archives/SHA256SUMS.txt`. **Zero patches.**

## Explicitamente excluídos desta compilação

`--enable-version3`, opencore-amr, vo-amrwbenc (Apache-2.0, incompatível com GPLv2), libx265, libmp3lame, libwebp, gnutls, libass, fontconfig, NVENC/AMF, e o restante do grafo Gyan essentials. Decode HEVC/MP3/WebP usa codecs **nativos** do n6.1.1.

## Como obter o código correspondente a *este* objeto

1. Esta pasta (`archives/` + `scripts/build-all.sh` + `patches/README.md` + `logs/binaries-version.txt` + `dist/SHA256SUMS.txt`).
2. `bash scripts/build-all.sh` em MSYS2 MINGW64.
3. Comparar SHA-256 de `dist/*.exe` com `dist/SHA256SUMS.txt` e a linha `configuration:` de `ffmpeg -version` com `logs/binaries-version.txt`.

Se os hashes não coincidirem, estes arquivos **não** são corresponding source desse binário.

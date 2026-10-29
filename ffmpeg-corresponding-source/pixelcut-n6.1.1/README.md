# Corresponding source — FFmpeg/FFprobe PixelCut n6.1.1 (Windows x64)

Compilação **própria** do PixelCut. **Não** é o essentials Gyan 6.1.1. Fase 5: os exe em `PixelCut/third-party/ffmpeg/` **são** este objeto (`dist/` copiado). Gyan só em `../gyan-6.1.1-rollback/`.

**Isto não declara conformidade GPL só por existirem ficheiros nesta pasta.** A oferta só cobre o par `dist/ffmpeg.exe` + `dist/ffprobe.exe` **deste** prefixo, gerado por `scripts/build-all.sh` com as fontes pinadas em `archives/`.

## Identificação

| Campo | Valor |
|---|---|
| FFmpeg | tag `n6.1.1`, commit `e38092ef9395d7049f871ef4d5411eb410e283e0` |
| Tarball | `archives/ffmpeg-6.1.1.tar.xz` SHA-256 `8684F4B00F94B85461884C3719382F1261F0D9EB3D59640A1F4AC0873616F968` |
| Licença do **exe** | GPL-2.0-or-later (`--enable-gpl`, **sem** `--enable-version3`, sem `--enable-nonfree`) |
| Arquitectura | Windows x64, estático, MinGW-w64 |
| Toolchain | MSYS2 `mingw-w64-x86_64-gcc` 16.2.0, NASM 3.02, meson 1.12.1 (HarfBuzz); ver `logs/toolchain.txt` |
| Patches | **zero** (`patches/README.md`) |
| `dist/ffmpeg.exe` (29/10/2026) | 31 118 336 B · SHA-256 `050577AFFE30A13282A5145E9FD8220D3A3940CAE4E81E61987B340CD3C2D291` |
| `dist/ffprobe.exe` (29/10/2026) | 30 990 336 B · SHA-256 `0BB9D300815A59AA26B7F8494D5A4BE84F6803FCBC069486FADF63A62AE8668E` |

## Dependências ligadas (só as do grafo PixelCut)

| Peça | Arquivo | Licença |
|---|---|---|
| x264 | `x264-c1c9931dc87289-git-archive.tar.gz` | GPL-2.0-or-later (cabeçalhos); ver `docs/X264_GPLV3.md` |
| Rubber Band 1.8.1 | `rubberband-1.8.1.tar.bz2` | GPL-2.0-or-later |
| FFTW 3.3.10 | `fftw-3.3.10.tar.gz` | GPL-2.0-or-later |
| libsamplerate 0.2.2 | `libsamplerate-0.2.2.tar.xz` | BSD-2-Clause |
| Freetype 2.13.2 | `freetype-2.13.2.tar.xz` | FTL ou GPL-2 |
| HarfBuzz 8.3.0 | `harfbuzz-8.3.0.tar.xz` | MIT (obrigatório para `drawtext` no n6.1.1) |
| zlib 1.3.1 | `zlib-1.3.1.tar.gz` | zlib |
| AAC nativo, filtros lavfi, decoders nativos | tarball FFmpeg | LGPL no fonte; o **exe** é GPL |

Hashes: `archives/SHA256SUMS.txt`. Matriz de filtros: `PixelCut-distribuicao/docs/FFMPEG_PIXELCUT_BUILD.md`.

## Reconstruir

1. Instalar [MSYS2](https://www.msys2.org/) e, no ambiente **MINGW64**:
   `pacman -S --needed mingw-w64-x86_64-gcc mingw-w64-x86_64-nasm mingw-w64-x86_64-pkgconf mingw-w64-x86_64-meson mingw-w64-x86_64-ninja make tar gzip bzip2 xz patch`
2. `bash scripts/build-all.sh`  
   A compilação corre em `C:\pixelcut-ffmpeg-n611` (sem espaços; override `PIXELCUT_FFMPEG_WORK`). No fim copia `dist/` e `logs/` para esta pasta.
3. Binários em `dist/ffmpeg.exe` e `dist/ffprobe.exe`. Hashes em `dist/SHA256SUMS.txt` (gerado no fim).
4. Comparar `ffmpeg -version` / `ffmpeg -buildconf` com `logs/binaries-version.txt`.

Teste isolado (não substitui Gyan):

```
set PIXELCUT_FFMPEG_DIR=<esta-pasta>\dist
set PIXELCUT_SKIP_FFPROBE_SHA=1
npm run test:export
```

## O que isto **não** é

- Não substitui o NSIS já validado (`PixelCut-Setup-0.1.0-electron44.exe`).
- Não altera a licença do editor (`package.json` continua MIT até decisão própria).
- Não publica nada no GitHub.
- Não completa a corresponding source do **objeto Gyan** (essa via continua bloqueada).

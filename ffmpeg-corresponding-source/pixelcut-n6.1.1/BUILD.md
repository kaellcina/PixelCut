# Reconstruir ffmpeg.exe / ffprobe.exe PixelCut n6.1.1 (Windows x64)

## Toolchain medido (29/10/2026)

| Peça | Valor |
|---|---|
| Ambiente | MSYS2 MINGW64 (`MSYS2.MSYS2` 20260927), `C:\msys64` |
| gcc/g++ | 16.2.0 (Rev6, Built by MSYS2 project) |
| NASM | 3.02 |
| pkgconf | 3.0.10 |
| make | GNU Make 4.4.1 |
| meson | 1.12.1 (só HarfBuzz) |
| ninja | 1.13.2 (só HarfBuzz) |
| Diretório de trabalho | `C:\pixelcut-ffmpeg-n611` (`PIXELCUT_FFMPEG_WORK`) — **sem espaços** |

O gcc 16.2.0 **não** é o gcc 12.2.0 do Gyan. Esta é uma compilação própria.

Pacotes MSYS2:

```
pacman -S --needed mingw-w64-x86_64-gcc mingw-w64-x86_64-nasm mingw-w64-x86_64-pkgconf \
  mingw-w64-x86_64-meson mingw-w64-x86_64-ninja make tar gzip bzip2 xz patch
```

## Comando

No *shell* MINGW64, a partir desta pasta `pixelcut-n6.1.1`:

```
bash ./scripts/build-all.sh
```

O script copia os tarballs pinados para `C:\pixelcut-ffmpeg-n611` (override `PIXELCUT_FFMPEG_WORK`), compila zlib → FFTW → libsamplerate → x264 → freetype → harfbuzz → rubberband → FFmpeg, e no fim copia `dist/` e `logs/` de volta a esta pasta.

## `configure` do FFmpeg (o que o binário declara)

`--enable-gpl` **sem** `--enable-version3` **sem** `--enable-nonfree`.

`--enable-static --disable-shared --disable-autodetect --disable-network --disable-indevs --enable-indev=lavfi --disable-outdevs --enable-libx264 --enable-librubberband --enable-libfreetype --enable-libharfbuzz --enable-zlib`

`--extra-libs='-lstdc++ -lsamplerate -lfftw3 -lz -lpthread'`

Ligação estática das bibliotecas do prefixo. Imports Win32 restantes: `KERNEL32.dll`, `msvcrt.dll`, `bcrypt.dll`, `SHELL32.dll`.

## Particularidades reproduzíveis (não são patches de fonte)

- zlib: `make -f win32/Makefile.gcc libz.a` (o `./configure` do zlib aborta neste MinGW; os testes `example.exe` também falham no ld — só se instala `libz.a`).
- Rubber Band 1.8.1: `SNDFILE_CFLAGS`/`Vamp_CFLAGS` dummy para o `configure` (CLI/plugins não entram); `mkdir -p lib && make static`.
- HarfBuzz: meson `-Dglib=disabled -Dcairo=disabled -Dicu=disabled -Dfreetype=enabled`.
- FFmpeg 6.1.1 exige **libfreetype + libharfbuzz** para o filtro `drawtext`.

## Verificar o objeto

```
ffmpeg.exe -version
ffmpeg.exe -buildconf
ffprobe.exe -version
ffmpeg.exe -hide_banner -filters | findstr drawtext
Get-FileHash -Algorithm SHA256 dist\ffmpeg.exe, dist\ffprobe.exe
```

Os SHA-256 têm de coincidir com `dist/SHA256SUMS.txt` **deste** build. Um rebuild noutra máquina/toolchain produz hashes diferentes — nesse caso atualizar o SUMS e o log, não reutilizar o SUMS antigo.

## Integração de teste (não substitui produção)

```
set PIXELCUT_FFMPEG_DIR=<esta-pasta>\dist
set PIXELCUT_SKIP_FFPROBE_SHA=1
npm run test:export
```

Produção (Fase 5): `PixelCut/third-party/ffmpeg/ffmpeg.exe` e `ffprobe.exe` (os mesmos hashes de `dist/`). `electron-builder.yml` empacota `PixelCut/third-party/ffmpeg/**/*` — **não** colocar `archives/` nem `src/` aí. `ffmpeg-static` foi removido.

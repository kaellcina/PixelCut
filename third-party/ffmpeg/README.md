# FFmpeg / FFprobe PixelCut n6.1.1 (Windows x64)

Este diretório contém **apenas** os executáveis empacotados no aplicativo. Compilação própria do PixelCut — **não** é o essentials Gyan.

| Ficheiro | SHA-256 | Bytes |
|---|---|---|
| `ffmpeg.exe` | `050577AFFE30A13282A5145E9FD8220D3A3940CAE4E81E61987B340CD3C2D291` | 31 118 336 |
| `ffprobe.exe` | `0BB9D300815A59AA26B7F8494D5A4BE84F6803FCBC069486FADF63A62AE8668E` | 30 990 336 |

`configuration:` `--enable-gpl` **sem** `--enable-version3` **sem** `--enable-nonfree`; `--enable-libx264 --enable-librubberband --enable-libfreetype --enable-libharfbuzz --enable-zlib`. Licença **destes** exe: GPL-2.0-or-later (leitura do `configure` n6.1.1).

`electron/ffmpeg.cjs` resolve estes ficheiros (com `app.asar` → `app.asar.unpacked`). Não usar `ffmpeg-static`.

Corresponding source (tarballs, `build-all.sh`, hashes): `ffmpeg-corresponding-source/pixelcut-n6.1.1/`. **Não** copiar arquivos/src para aqui — o electron-builder empacota este glob.

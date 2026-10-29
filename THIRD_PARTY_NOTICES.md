# Third-party notices — PixelCut

PixelCut ships or uses third-party software at runtime. This file is a summary.
Full license texts for some components live next to the binaries or in
`ffmpeg-corresponding-source/pixelcut-n6.1.1/`.

Original PixelCut editor code (not listed below) is MIT,
Copyright (c) 2026 Kaell Soares Calacina. That copyright does **not** cover
the third-party works in this file.

This is not a legal opinion and does not by itself authorize a GitHub upload.

## FFmpeg / FFprobe (Windows export)

The Windows app starts `ffmpeg.exe` and `ffprobe.exe` as **separate processes**
(`spawn`, argument arrays; it does not link `libav*`).

These executables are the **PixelCut n6.1.1** build (`--enable-gpl`, **without**
`--enable-version3`, **without** `--enable-nonfree`). On the FFmpeg 6.1.1
`configure` reading, the **executables** are **GPL-2.0-or-later**.

| File | SHA-256 |
|---|---|
| `ffmpeg.exe` | `050577AFFE30A13282A5145E9FD8220D3A3940CAE4E81E61987B340CD3C2D291` |
| `ffprobe.exe` | `0BB9D300815A59AA26B7F8494D5A4BE84F6803FCBC069486FADF63A62AE8668E` |

- Shipped in `third-party/ffmpeg/` (asar unpacked). The npm package `ffmpeg-static` is **not** used.
- GPL-2 text: `third-party/ffmpeg/COPYING.GPLv2`
- Notices: `third-party/ffmpeg/LICENSE-NOTICES.md`
- Corresponding source for **this** object: `ffmpeg-corresponding-source/pixelcut-n6.1.1/` (see `ffmpeg-corresponding-source/README.md`). Tarballs are **not** inside the NSIS installer; they must be in the public repository and attached to the same GitHub Release as the EXE.
- Linked **inside the FFmpeg executables** (not in the editor process): x264, Rubber Band 1.8.1, FFTW 3.3.10, libsamplerate, FreeType, HarfBuzz, zlib.

FFmpeg is a trademark of Fabrice Bellard. No warranty. Reverse engineering of the GPL executables must not be forbidden.

## Electron and Chromium (Windows app)

- Electron 44.10.0 — MIT.
- Chromium components — mixed licenses (BSD, MIT, LGPL, and others). The installer includes `LICENSES.chromium.html` beside `PixelCut.exe`. Keep that file.

## React

React and ReactDOM 18.3 — MIT. Copyright (c) Facebook, Inc. and its affiliates.

## Capacitor

`@capacitor/core`, `@capacitor/android`, `@capacitor/filesystem` — MIT. Copyright (c) 2017–present Drifty Co. / Ionic.

## AndroidX Media3 (Android only)

`androidx.media3:media3-transformer`, `media3-effect`, and `media3-common` **1.11.1** — Apache License 2.0.

https://github.com/androidx/media/blob/release/LICENSE  
https://www.apache.org/licenses/LICENSE-2.0

Android export does **not** bundle FFmpeg.

## Fonts used in the text preview (Google Fonts, SIL OFL 1.1)

Loaded at runtime; not shipped as `.ttf` inside the installer. Families include Anton, Bebas Neue, Comfortaa, Dancing Script, Montserrat, Oswald, Pacifico, Playfair Display, Poppins, and Roboto, under OFL 1.1 as published by Google Fonts. Windows **export** uses fonts already installed on the PC.

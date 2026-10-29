# Licensing architecture — MIT editor and GPL-2.0-or-later FFmpeg

**Date:** 29 October 2026 (Fase 6 analysis; paths updated 29 October 2026 for the public tree).  
**This is not legal advice.** It does not declare the distribution cleared. It does not reopen the x264/GPLv3 consult: that question is only needed if the rights holder wants GPLv3 on the editor or `--enable-version3` on FFmpeg.

- `ffmpeg-static` was **removed**. There is no GPL-3.0-or-later JS wrapper inside the Node process.
- Shipped Windows executables are PixelCut n6.1.1 with `--enable-gpl` **without** `--enable-version3` → GPL-2.0-or-later on that object, not GPL v3.
- AndroidX Media3 is Apache-2.0. That does **not** conflict with an MIT editor. It would conflict with a GPL-2-only editor.

## Facts of the implemented architecture

| Layer | What the code does |
|---|---|
| Editor | React + Vite + Electron 44.10.0 (`src/`, `electron/`, `android/`). `package.json` `"license": "MIT"`, `"author": "Kaell Soares Calacina"`. |
| FFmpeg / FFprobe | Separate executables in `third-party/ffmpeg/`. Packed unpacked (`asarUnpack`). |
| Start | `electron/ffmpeg.cjs` uses `child_process.spawn(ffmpegPath, args, { windowsHide: true })` (and the same for ffprobe). Arguments are an **array**, no `shell`. |
| Data exchanged | Media file paths, CLI arguments (including `filter_complex`), helper files (`textfile` with `expansion=none`), stdout/stderr/exit code. |
| Linking | **No** `dlopen`, `ffi`, or Node binding of `libav*` / `libx264` / `librubberband`. Those libraries live **inside** `ffmpeg.exe`. |
| Installer | NSIS ships `PixelCut.exe` **and** the two FFmpeg executables in one package. |
| Android | Media3 export (Apache-2.0). **Does not** ship FFmpeg. |

The filter graph (eq, xfade, drawtext, rubberband, chromakey, …) is built in JavaScript and passed as FFmpeg’s **public command-line interface**. It is not the libav C API.

GNU FAQ language on mere aggregation / communication between programs (not a court holding): modules in the **same executable** or the **same address space** are ordinarily one combined work; pipes, sockets, and **command-line arguments** are “normally used between two separate programs.” The same FAQ warns that communication can still be intimate enough to make one program. Putting two programs in the **same installer** does not, by itself, make a combined work.

`spawn` is **not** a legal guarantee. The communication observed here is FFmpeg’s stable CLI (files + argv + stdout), not in-memory libav structures. That weighs toward **separate programs**. It does not prove the outcome in a dispute.

## Recommendation (still the rights holder’s call)

Keep **separate licensing**:

1. Original PixelCut editor code — **MIT**, file `LICENSE`, Copyright (c) 2026 Kaell Soares Calacina. FFmpeg is not original PixelCut MIT code.
2. `ffmpeg.exe` / `ffprobe.exe` PixelCut n6.1.1 — **GPL-2.0-or-later**, corresponding source in [`ffmpeg-corresponding-source/pixelcut-n6.1.1/`](../ffmpeg-corresponding-source/pixelcut-n6.1.1/). A generic link to ffmpeg.org is not the source of this object.
3. Notices in `THIRD_PARTY_NOTICES.md`. Do not forbid reverse engineering of the GPL executables.
4. Do **not** put GPL-3.0-or-later on the editor under this GPLv2 strategy.

Caveats: this is not legal confirmation and not permission to publish; codec patents (H.264 / AAC) are a separate topic from MIT/GPL; GPLv2 still requires corresponding source of **this** object, a public offer, and notices, regardless of the editor’s MIT license.

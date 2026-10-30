# Corresponding source for PixelCut FFmpeg / FFprobe n6.1.1

This directory is the **in-repo offer** for the Windows executables shipped
with PixelCut (`third-party/ffmpeg/ffmpeg.exe` and `ffprobe.exe`).

Those binaries are **GPL-2.0-or-later** (`--enable-gpl`, without
`--enable-version3`, without `--enable-nonfree`). GPLv2 requires the
complete corresponding source of **this** object, not a generic link to
someone else’s FFmpeg tree.

They are not MIT and are not original works of Kaell Soares Calacina.

## Canonical tree (this repository)

[`pixelcut-n6.1.1/`](pixelcut-n6.1.1/)

Do **not** copy these archives into `third-party/ffmpeg/` — electron-builder
packs that glob into the Windows installer.

| Required element | Location |
|---|---|
| Exact FFmpeg 6.1.1 sources | `pixelcut-n6.1.1/archives/ffmpeg-6.1.1.tar.xz` |
| Linked dependencies | x264, Rubber Band 1.8.1, FFTW 3.3.10, libsamplerate 0.2.2, FreeType 2.13.2, HarfBuzz 8.3.0, zlib 1.3.1 |
| Build script | `pixelcut-n6.1.1/scripts/build-all.sh` |
| Toolchain versions | `pixelcut-n6.1.1/logs/toolchain.txt` (gcc 16.2.0, NASM 3.02, meson 1.12.1, ninja 1.13.2) |
| Configure line | `pixelcut-n6.1.1/logs/binaries-version.txt`, `logs/ffmpeg-configure.log` |
| Patches | none (`pixelcut-n6.1.1/patches/README.md`) |
| License notices | `pixelcut-n6.1.1/LICENSE-NOTICES.md`, `COPYING.GPLv2` |
| SHA-256 of the shipped executables | `pixelcut-n6.1.1/dist/SHA256SUMS.txt` |

| File | SHA-256 |
|---|---|
| `ffmpeg.exe` | `050577AFFE30A13282A5145E9FD8220D3A3940CAE4E81E61987B340CD3C2D291` |
| `ffprobe.exe` | `0BB9D300815A59AA26B7F8494D5A4BE84F6803FCBC069486FADF63A62AE8668E` |

Rebuild: `pixelcut-n6.1.1/BUILD.md`. Work directory must not contain spaces (`C:\pixelcut-ffmpeg-n611`).

The in-repo copy omits `dist/*.exe` (already in `third-party/ffmpeg/`).
Root `.gitignore` skips `*.log`, so verbose compiler logs live in the
**release zip** only. Git keeps `logs/toolchain.txt`,
`logs/binaries-version.txt`, and `logs/ffmpeg-config.sh.txt`.
`logs/ffmpeg-config.log` in the zip is hygiened: host identity and
secret-class environment values were replaced with `<redacted>` /
`<user-profile>` / `<build-host>`, and IDE/agent keys were omitted.
The FFmpeg `configure` line and feature map are unchanged. Rebuild
work directory: `C:\pixelcut-ffmpeg-n611`.

## Release zip (attach next to the Windows installer)

`PixelCut-ffmpeg-n6.1.1-corresponding-source.zip`  
SHA-256 `27187E48A173F4096BDE53B2B9265C2C2703BA31F9DDD53F12B6BF27D1FB52F8` (42 315 883 bytes)

Local prepared path (not in git):
`PixelCut-distribuicao/third-party/ffmpeg/PixelCut-ffmpeg-n6.1.1-corresponding-source.zip`

GPLv2 for this beta: keep this tree in the public **PixelCut** repository
**and** attach the zip to the same GitHub Release as
`PixelCut-Setup-0.1.0-beta.4.exe`. Uploading only the EXE would leave the
corresponding source unavailable to the recipient.

Previous zips `D581603E…` (42 314 247 bytes) and `E06BD9FE…` (42 319 366 bytes)
are **local rollback only** (`%LOCALAPPDATA%\PixelCut\staging\`). Do not
attach them to the GitHub Release.

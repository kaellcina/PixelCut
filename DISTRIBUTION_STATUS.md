# Checklist before a public distribution — PixelCut

**Fase 29 / v0.1.0-beta.4 (30/10/2026):** Windows installer, signed Android APK, and FFmpeg corresponding-source zip prepared for GitHub Release `v0.1.0-beta.4`. Previous tags stay in place.

- Editor license: **MIT**, Copyright (c) 2026 Kaell Soares Calacina. `package.json` `"license": "MIT"`.
- FFmpeg/FFprobe: PixelCut n6.1.1, **GPL-2.0-or-later** (unchanged binaries).
- Public repository: **https://github.com/kaellcina/PixelCut**
- Tag: `v0.1.0-beta.4`.
- Windows installer: `PixelCut-Setup-0.1.0-beta.4.exe`  
  SHA-256 `2A842E13DF1FEA905C454F49E31E1B6FC1CF4F5AC2AB8E0AC45D004A5C847C80`  
  151 309 481 bytes. NotSigned (approved for this beta).
- Android APK: `%LOCALAPPDATA%\PixelCut\staging\PixelCut-Android-0.1.0-beta.4.apk`  
  SHA-256 `CB2CD29323A40FD160694909C0F6D307DCAE4CF6D0CD75C0D1AAC8BF9DC7ADDB`  
  6 539 581 bytes. Signed v2, `versionCode` 4, same certificate as beta.1 (`48e79a8f…`).
- FFmpeg corresponding-source zip (not in git): `PixelCut-distribuicao/third-party/ffmpeg/PixelCut-ffmpeg-n6.1.1-corresponding-source.zip`  
  SHA-256 `27187E48A173F4096BDE53B2B9265C2C2703BA31F9DDD53F12B6BF27D1FB52F8`  
  42 315 883 bytes. Attach to the same GitHub Release as the Windows installer.

## Before the EXE goes on GitHub Releases

- [x] Copyright line confirmed by the rights holder.
- [x] MIT (editor) + GPL-2.0-or-later (FFmpeg executables) accepted by the rights holder.
- [x] Public GitHub repository **PixelCut** exists under kaellcina.
- [x] `ffmpeg-corresponding-source/pixelcut-n6.1.1/` is in the PixelCut tree (tarballs, script, hashes). Zip still a Release asset.
- [x] Upload `PixelCut-Setup-0.1.0-beta.4.exe` only (not the older Setup files).
- [x] Workflow is manual (`workflow_dispatch` only).
- [x] Do not delete `v0.1.0-beta.1` or `v0.1.0-beta.2`.

## Before an APK goes on GitHub Releases

- [x] Signed APK: SHA-256 `CB2CD29323A40FD160694909C0F6D307DCAE4CF6D0CD75C0D1AAC8BF9DC7ADDB` (6 539 581 B).
- [x] Release keystore outside git (`%LOCALAPPDATA%\PixelCut\signing\`). Same key as beta.1.
- [x] Policy: never attach `app-debug.apk`.
- [x] Do not replace previous staging APKs (`…-beta.1.apk`, `…-beta.2.apk`, `…-beta.3.apk`).

CapRocket is **not** a distribution blocker. Authenticode is **not** required for this beta (SmartScreen warning expected). H.264/AAC patents are a separate topic from MIT/GPL. This checklist is not legal confirmation.

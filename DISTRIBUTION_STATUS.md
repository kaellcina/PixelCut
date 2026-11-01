# Checklist before a public distribution — PixelCut

**Fase 35 / v0.1.0-beta.5 (01/11/2026):** PR #1 integrated on `integrate/pr1-beta.5`. Windows installer and signed Android APK rebuilt locally. **Not published.** No push, tag, merge or GitHub Release until the rights holder approves. PR #1 remains open.

- Editor license: **MIT**, Copyright (c) 2026 Kaell Soares Calacina. `package.json` `"license": "MIT"`.
- FFmpeg/FFprobe: PixelCut n6.1.1, **GPL-2.0-or-later** (unchanged binaries).
- Public repository: **https://github.com/kaellcina/PixelCut**
- Last published tag: `v0.1.0-beta.4`. Proposed next tag: `v0.1.0-beta.5` (do not create until authorized).
- Windows installer: `PixelCut/release/PixelCut-Setup-0.1.0-beta.5.exe`  
  SHA-256 `CD7DCECB3B76B0F0644B1D50F019D9E8BF6ED47DBC6E2A624F6D6D114BB1D48C`  
  151 311 918 bytes. NotSigned (approved for this beta). NSIS `deleteAppDataOnUninstall: false`.
- Android APK: `%LOCALAPPDATA%\PixelCut\staging\PixelCut-Android-0.1.0-beta.5.apk`  
  SHA-256 `1381919E9A32EF20EDE26F76F81770C538F23358145BDC7A133618DE07F12DCB`  
  6 547 137 bytes. Signed v2, `versionCode` 11, `versionName` `0.1.0-beta.5`, same certificate as beta.1 (`48e79a8f…`).
- FFmpeg corresponding-source zip (not in git): `PixelCut-distribuicao/third-party/ffmpeg/PixelCut-ffmpeg-n6.1.1-corresponding-source.zip`  
  SHA-256 `27187E48A173F4096BDE53B2B9265C2C2703BA31F9DDD53F12B6BF27D1FB52F8`  
  42 315 883 bytes. Attach to the same GitHub Release as the Windows installer.

## Before the EXE goes on GitHub Releases

- [x] Copyright line confirmed by the rights holder.
- [x] MIT (editor) + GPL-2.0-or-later (FFmpeg executables) accepted by the rights holder.
- [x] Public GitHub repository **PixelCut** exists under kaellcina.
- [x] `ffmpeg-corresponding-source/pixelcut-n6.1.1/` is in the PixelCut tree (tarballs, script, hashes). Zip still a Release asset.
- [ ] Upload `PixelCut-Setup-0.1.0-beta.5.exe` only after authorization (not the older Setup files).
- [x] Workflow is manual (`workflow_dispatch` only).
- [x] Do not delete `v0.1.0-beta.1`, `v0.1.0-beta.2` or `v0.1.0-beta.4`.
- [x] Do not merge PR #1 without authorization.

## Before an APK goes on GitHub Releases

- [x] Signed APK: SHA-256 `1381919E9A32EF20EDE26F76F81770C538F23358145BDC7A133618DE07F12DCB` (6 547 137 B).
- [x] Release keystore outside git (`%LOCALAPPDATA%\PixelCut\signing\`). Same key as beta.1.
- [x] Policy: never attach `app-debug.apk`.
- [x] Do not replace previous staging APKs (`…-beta.1.apk` … `…-beta.4.apk`).
- [ ] Attach `PixelCut-Android-0.1.0-beta.5.apk` to the GitHub Release only after authorization.

CapRocket is **not** a distribution blocker. Authenticode is **not** required for this beta (SmartScreen warning expected). H.264/AAC patents are a separate topic from MIT/GPL. This checklist is not legal confirmation.

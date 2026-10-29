# Checklist before a public distribution — PixelCut

**Fase 11 (29/10/2026):** public tree prepared. **Nothing is published.** No tag, no Release, no push, no remote.

- Editor license: **MIT**, Copyright (c) 2026 Kaell Soares Calacina. `package.json` `"license": "MIT"`.
- FFmpeg/FFprobe: PixelCut n6.1.1, **GPL-2.0-or-later**.
- Proposed public repository name: **PixelCut**. GitHub owner not stored here.
- Proposed tag: `v0.1.0-beta.1`.
- Windows installer (local): `PixelCut-Setup-0.1.0-beta.1.exe`  
  SHA-256 `9D3D4BC53C7851487EB345BD8AE6B88CC5062D098E586E88AE2AD33F3A86F49C`  
  NotSigned (approved for this beta).
- Android APK (local): `%LOCALAPPDATA%\PixelCut\staging\PixelCut-Android-0.1.0-beta.1.apk`  
  SHA-256 `1FE4A4B01B212AB2E7D4BCA7AE73D72568E66DE5396E92FDE5707723BC054F18`  
  Signed v2; tested on Galaxy A54 (29/10/2026).
- FFmpeg corresponding-source zip (local, not in git): `PixelCut-distribuicao/third-party/ffmpeg/PixelCut-ffmpeg-n6.1.1-corresponding-source.zip`  
  SHA-256 `27187E48A173F4096BDE53B2B9265C2C2703BA31F9DDD53F12B6BF27D1FB52F8`  
  42 315 883 bytes. Attach to the same GitHub Release as the Windows installer.

## Before the EXE goes on GitHub Releases

- [x] Copyright line confirmed by the rights holder.
- [x] MIT (editor) + GPL-2.0-or-later (FFmpeg executables) accepted by the rights holder.
- [ ] Public GitHub repository **PixelCut** created under the real owner account.
- [x] `ffmpeg-corresponding-source/pixelcut-n6.1.1/` is in the PixelCut tree (tarballs, script, hashes). Zip still a Release asset.
- [ ] Manual upload of `PixelCut-Setup-0.1.0-beta.1.exe` only (not the older Setup files).
- [x] Workflow is manual (`workflow_dispatch` only).

## Before an APK goes on GitHub Releases

- [x] Signed APK: SHA-256 `1FE4A4B01B212AB2E7D4BCA7AE73D72568E66DE5396E92FDE5707723BC054F18` (6 267 993 B).
- [x] Release keystore outside git (`%LOCALAPPDATA%\PixelCut\signing\`). Backup that folder.
- [x] Device install of the **signed** APK on SM-A546E: Success. Import / cut / export MP4 checked.
- [x] Policy: never attach `app-debug.apk`.

CapRocket is **not** a distribution blocker. Authenticode is **not** required for this beta (SmartScreen warning expected). H.264/AAC patents are a separate topic from MIT/GPL. This checklist is not legal confirmation.

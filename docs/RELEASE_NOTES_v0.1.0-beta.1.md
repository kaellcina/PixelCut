# PixelCut v0.1.0-beta.1 — draft GitHub Release

**Status:** prepared 29 October 2026. **Do not publish. Do not create the git tag. Do not upload assets.**

Proposed tag: `v0.1.0-beta.1`  
Repository name (approved): **PixelCut**  
GitHub owner/account: **not recorded in this tree** — do not invent a URL.

Paste the English block below into the GitHub Release body after the rights holder authorizes upload. Attach **all three** files listed under Downloads.

---

## GitHub Release body (English)

### PixelCut 0.1.0-beta.1

**This is a free public beta.** It will break. Save copies of your media. Projects stay on your machine (`%AppData%\PixelCut\projects` on Windows; app-private storage on Android). PixelCut is not CapCut and is not affiliated with ByteDance.

Original editor code is open source under MIT, Copyright (c) 2026 Kaell Soares Calacina. The Windows app also ships FFmpeg and FFprobe as **separate GPL-2.0-or-later executables**. Android export uses AndroidX Media3 (Apache-2.0) and **does not** bundle FFmpeg.

**Windows and Android are not at feature parity.**

### Highlights

- Multi-track timeline on Windows: main video, overlay, text, audio, effects, and transitions
- Autosave and a Recents home screen
- Windows export to H.264 + AAC MP4, including **effects, transitions, chroma, titles, overlays, voice effects, and the music track** (tested)
- Android editor UI (Capacitor + Media3). Export is **main track only**
- Signed Android APK, sideloaded and tested on a Galaxy A54 5G (SM-A546E, Android 16)

### Downloads

| File | Platform | SHA-256 | Bytes |
|---|---|---|---|
| `PixelCut-Setup-0.1.0-beta.1.exe` | Windows 10/11 x64 | `9D3D4BC53C7851487EB345BD8AE6B88CC5062D098E586E88AE2AD33F3A86F49C` | 144 836 084 |
| `PixelCut-Android-0.1.0-beta.1.apk` | Android 7+ (`com.pixelcut.editor`) | `1FE4A4B01B212AB2E7D4BCA7AE73D72568E66DE5396E92FDE5707723BC054F18` | 6 267 993 |
| `PixelCut-ffmpeg-n6.1.1-corresponding-source.zip` | FFmpeg/FFprobe source for the shipped Windows binaries | `27187E48A173F4096BDE53B2B9265C2C2703BA31F9DDD53F12B6BF27D1FB52F8` | 42 315 883 |

Electron 44.10.0. Windows installer is **NotSigned** — SmartScreen may warn. That is expected.

Do **not** use `PixelCut-Setup-0.1.0.exe`, `PixelCut-Setup-0.1.0-electron44.exe`, `PixelCut-Setup-0.1.0-ownffmpeg.exe`, any `app-debug.apk`, or the obsolete unsigned Android hash `AF4B1588…`.

### Install (Windows)

1. 64-bit Windows 10 or 11
2. Verify SHA-256:

   ```powershell
   Get-FileHash .\PixelCut-Setup-0.1.0-beta.1.exe -Algorithm SHA256
   ```

3. Quit PixelCut if it is running
4. Run the NSIS installer (folder picker, Start Menu + desktop shortcuts)
5. Keep `%AppData%\PixelCut\projects` if you uninstall later

**Requirements:** 64-bit Windows 10 or 11; disk space for the app plus your media. Network is needed only for Google Fonts in the text preview. Export does not need the network.

### Install (Android sideload)

1. Android 7.0 (API 24) or later
2. Verify SHA-256:

   ```powershell
   Get-FileHash .\PixelCut-Android-0.1.0-beta.1.apk -Algorithm SHA256
   ```

3. Uninstall any **debug** PixelCut first if install reports a signature mismatch (that deletes app-private projects)
4. Enable install from unknown sources
5. Open `PixelCut-Android-0.1.0-beta.1.apk`
6. Export writes **only the main track** (cut, sequence, stills, speed, original video audio). Overlays, titles, transitions, chroma, catalog visual effects, voice effects, and the separate music track are **omitted** from the Android MP4. The on-device preview can show more than the file you get.

Device check (29 October 2026): Galaxy A54, signed APK, import → timeline → play → split → save/reopen → Media3 MP4 (H.264 High 1280×720 + AAC-LC, 4.027 s, `ffmpeg -v error` exit 0). See `docs/ANDROID.md` and `docs/ANDROID_DEVICE.md`.

### Known issues

- Beta quality; not a full professional NLE
- Unsigned Windows installer (SmartScreen)
- Preview (Chromium / Android player) and export (FFmpeg / Media3) can differ
- Windows projects store absolute local media paths
- Android export is main-track only — **not** Windows parity
- Android omitted-track warnings currently show **after** export, not as a blocking confirm beforehand (open UI item; the signed APK was not rebuilt for it)
- Google Fonts needed for some text-preview typefaces; Windows export uses fonts already installed on the PC
- A brief system/WebView toast was seen once on first add-to-timeline on the A54; H.264 decode and the rest of the flow succeeded

### License and corresponding source

- Original PixelCut editor code: **MIT**, Copyright (c) 2026 Kaell Soares Calacina (`LICENSE`). That copyright does not cover FFmpeg or other third-party works.
- `ffmpeg.exe` / `ffprobe.exe`: **GPL-2.0-or-later** (`COPYING.GPLv2` next to the binaries). SHA-256:
  - ffmpeg `050577AFFE30A13282A5145E9FD8220D3A3940CAE4E81E61987B340CD3C2D291`
  - ffprobe `0BB9D300815A59AA26B7F8494D5A4BE84F6803FCBC069486FADF63A62AE8668E`
- Other components: `THIRD_PARTY_NOTICES.md`
- Rebuild package: attach `PixelCut-ffmpeg-n6.1.1-corresponding-source.zip` and keep `ffmpeg-corresponding-source/pixelcut-n6.1.1/` in the repository. A link to ffmpeg.org is not enough.

This release text is technical. It is not legal confirmation.

### Bugs

Open a GitHub Issue on this repository (templates in `.github/ISSUE_TEMPLATE/`). Include the installer or APK SHA-256. Do not send personal media, keystores, or `.env` files.

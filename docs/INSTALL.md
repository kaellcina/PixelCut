# Install PixelCut

Public downloads, when published, will be on GitHub Releases for the
repository named **PixelCut**. The GitHub owner/account is not stored in
this tree, so no `github.com/...` URL is invented here.

Nothing in this document uploads files.

## Windows installer (EXE)

**Local artifact prepared for `v0.1.0-beta.1` (not uploaded):**

| Field | Value |
|---|---|
| File | `PixelCut-Setup-0.1.0-beta.1.exe` |
| SHA-256 | `9D3D4BC53C7851487EB345BD8AE6B88CC5062D098E586E88AE2AD33F3A86F49C` |
| Size | 144 836 084 bytes |
| App | Electron 44.10.0, x64 |
| FFmpeg | PixelCut n6.1.1 (`050577AF…` / `0BB9D300…`) |
| Signature | NotSigned |

Older local installers must **not** be the public beta download:

- `PixelCut-Setup-0.1.0.exe`
- `PixelCut-Setup-0.1.0-electron44.exe`
- `PixelCut-Setup-0.1.0-ownffmpeg.exe`

### Steps

1. On Windows 10 or 11 (64-bit), download `PixelCut-Setup-0.1.0-beta.1.exe`.
2. Confirm the SHA-256:

   ```powershell
   Get-FileHash .\PixelCut-Setup-0.1.0-beta.1.exe -Algorithm SHA256
   ```

3. Quit PixelCut if it is already running.
4. Run the installer. NSIS lets you choose the folder. It creates Start Menu and desktop shortcuts.
5. Windows SmartScreen may warn because the file is **not** Authenticode-signed. That is expected for this beta. There is no publisher signature to “trust” beyond verifying the SHA-256 above.
6. Do **not** delete `%AppData%\PixelCut\projects`. Uninstalling the app should leave your projects unless you remove that folder yourself.

The installer shows MIT (original PixelCut code) and GPL-2.0-or-later (FFmpeg/FFprobe). License files after install:

- `resources/LICENSE`
- `resources/THIRD_PARTY_NOTICES.md`
- `resources/app.asar.unpacked/third-party/ffmpeg/COPYING.GPLv2`
- `resources/app.asar.unpacked/third-party/ffmpeg/LICENSE-NOTICES.md`

### Minimum requirements (Windows)

- Windows 10 or Windows 11, 64-bit
- Disk space for the app (installer is about 138 MiB on disk; the EXE is 144 836 084 bytes) plus your media
- Internet only for Google Fonts in the **text preview**; export does not need the network

## Android APK

Product notes: [ANDROID.md](ANDROID.md). Signing: [ANDROID_SIGNING.md](ANDROID_SIGNING.md).

**Minimum:** Android 7.0 (API 24), 64- or 32-bit ABI as packaged. `applicationId` `com.pixelcut.editor`.

### Signed local build (not uploaded)

| Field | Value |
|---|---|
| Staging | `%LOCALAPPDATA%\PixelCut\staging\PixelCut-Android-0.1.0-beta.1.apk` |
| Bytes | 6 267 993 |
| SHA-256 | `1FE4A4B01B212AB2E7D4BCA7AE73D72568E66DE5396E92FDE5707723BC054F18` |
| Signature | v2, `apksigner verify` OK. Package `com.pixelcut.editor`, version `0.1.0-beta.1`, minSdk 24. |

Do **not** distribute `app-debug.apk`. Do not use the old unsigned hash `AF4B1588…`.

### Sideload

1. Uninstall any debug PixelCut first if install is rejected (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`). That wipes app-private projects.
2. Enable install from unknown sources for the browser or Files app you use to open the APK.
3. Open `PixelCut-Android-0.1.0-beta.1.apk` and check the SHA-256 above.
4. Unknown-source / Play Protect warnings are expected for a GitHub sideload.
5. Export still writes **only the main video track**. Overlay, titles, transitions, chroma, catalog effects, voice effects, and a separate music track are omitted.

The signed APK was installed and tested on a Galaxy A54 5G (Android 16) on 29 October 2026. See [ANDROID.md](ANDROID.md) and [ANDROID_DEVICE.md](ANDROID_DEVICE.md).

## Corresponding source (FFmpeg)

The Windows installer includes GPL FFmpeg/FFprobe executables. Source to rebuild those exact binaries:

[`../ffmpeg-corresponding-source/pixelcut-n6.1.1/`](../ffmpeg-corresponding-source/pixelcut-n6.1.1/)

Release zip (attach next to the EXE):
`PixelCut-ffmpeg-n6.1.1-corresponding-source.zip`  
SHA-256 `27187E48A173F4096BDE53B2B9265C2C2703BA31F9DDD53F12B6BF27D1FB52F8` (42 315 883 bytes)

Offer summary: [`../ffmpeg-corresponding-source/README.md`](../ffmpeg-corresponding-source/README.md)

## Bugs

GitHub Issues on this repository (templates in `.github/ISSUE_TEMPLATE/`). Include the SHA-256 of the file you installed. Do not attach personal media, keystores, or `.env` files.

# PixelCut Android — v0.1.0-beta.1

Sideload beta. This is not a Play Store listing.

## What works in the app

- Recents: create, open, rename, duplicate, delete projects (app-private storage)
- Import video, image, and audio through the system document picker
- Timeline editing: trim, split, arrange clips, text, overlays, effects in the **preview**
- Playback on the device player
- Autosave in the app’s private directory (uninstalling the app removes that copy)
- Export MP4 with AndroidX Media3 Transformer **1.11.1**

## Export limitation (unchanged)

Android export writes **only the main video track**: cut, sequence, stills, speed, and the original audio of that video.

**Not written into the Android MP4:** transitions, overlays, titles, chroma key, catalog visual effects, the voice-effect chain, or the separate music track. The preview can show more than the file you get.

## Requirements

- Android **7.0** (API 24) or later
- `applicationId` `com.pixelcut.editor`
- `targetSdk` 36
- Internet only for Google Fonts in the text preview

## Install (signed APK)

1. If an older **debug** PixelCut is already on the phone, uninstall it first (that **deletes** app-private projects). A debug and a release build cannot coexist under `com.pixelcut.editor`.
2. Enable “Install unknown apps” for the browser or Files app you use to open the APK.
3. Open `PixelCut-Android-0.1.0-beta.1.apk`.
4. Confirm SHA-256 `1FE4A4B01B212AB2E7D4BCA7AE73D72568E66DE5396E92FDE5707723BC054F18`.
5. Unknown-source / Play Protect warnings are expected for a GitHub sideload.

Do **not** install `app-debug.apk`.

## Current local build (not uploaded)

| Field | Value |
|---|---|
| Staging | `%LOCALAPPDATA%\PixelCut\staging\PixelCut-Android-0.1.0-beta.1.apk` |
| SHA-256 | `1FE4A4B01B212AB2E7D4BCA7AE73D72568E66DE5396E92FDE5707723BC054F18` |
| Size | 6 267 993 bytes |
| Signature | APK Signature Scheme v2; `apksigner verify` OK |

**Device test (29 October 2026):** this signed APK was installed on a Galaxy A54 5G (SM-A546E, Android 16) after the old debug 1.0 build was uninstalled. Import MP4 → add to V1 → play → split → save/reopen → Media3 export succeeded (H.264 High 1280×720 + AAC-LC). See [ANDROID_DEVICE.md](ANDROID_DEVICE.md). Signing backup: [ANDROID_SIGNING.md](ANDROID_SIGNING.md).

Android omitted-track warnings currently appear **after** export in `ExportDialog`, not as a blocking confirm beforehand. That pre-export confirm is an open UI item; this signed APK was not rebuilt for it.

## Security

- Keep the release `.jks` and `keystore.properties` off Git.
- PixelCut Android does **not** ship FFmpeg. Media3 is Apache-2.0 (see `THIRD_PARTY_NOTICES.md`).
- Original editor code is MIT, Copyright (c) 2026 Kaell Soares Calacina.

## Bugs

GitHub Issues on this repository, template “Bug”, platform Android. Include the APK SHA-256. Do not attach personal videos, keystores, or `.env` files. The GitHub owner is not stored in this tree, so no issue URL is invented here.

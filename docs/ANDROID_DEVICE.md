# Android device report — 29 October 2026 (Fase 10)

**Not a GitHub publish.** Signed APK **installed** on the Galaxy A54 and exercised end-to-end. Windows NSIS / FFmpeg / keystore were **not** changed. No second keystore. Personal phone data outside PixelCut was **not** deleted.

## Signature (unchanged from Fase 9)

| Field | Value |
|---|---|
| Staging APK | `%LOCALAPPDATA%\PixelCut\staging\PixelCut-Android-0.1.0-beta.1.apk` |
| Also built at | `PixelCut/android/app/build/outputs/apk/release/PixelCut-Android-0.1.0-beta.1.apk` |
| Bytes | 6 267 993 |
| SHA-256 | `1FE4A4B01B212AB2E7D4BCA7AE73D72568E66DE5396E92FDE5707723BC054F18` |
| `apksigner verify --verbose --print-certs` | **Verifies** (v2) |
| Package | `com.pixelcut.editor` |
| versionName / versionCode | `0.1.0-beta.1` / `1` |
| minSdk / targetSdk | 24 / 36 |
| Signer DN | `CN=Kaell Soares Calacina, OU=PixelCut, O=PixelCut, C=BR` |
| Signer cert SHA-256 | `48e79a8fa8ec49514f2ff7ce032f6b2d40b87a1457ed6f20ad168e32461c7d0b` |

The previous **unsigned** hash `AF4B1588…` is obsolete. Do not publish that file. Do not ship the debug APK.

Keystore (first release key, not the debug key): `%LOCALAPPDATA%\PixelCut\signing\pixelcut-release.jks`  
Gradle pointer: `android/keystore.properties` (gitignored). Passwords are not in git and must not be pasted into chat. Backup: copy the whole `signing` folder to an encrypted USB / password manager; losing the `.jks` means you cannot update this app identity.

## ADB

| Field | Value |
|---|---|
| Serial | omitted (personal device identifier; not required to rebuild) |
| Status | `device` (authorized) |
| Model | SM-A546E (Galaxy A54 5G) |
| Android | 16 (SDK 36) |
| Display | 1080×2340 density 450 |

## Install

The 28/10 **debug** PixelCut (`versionName 1.0`) was uninstalled by the titular before this phase. `pm path com.pixelcut.editor` then failed (no package). App private data of that debug install is gone with the uninstall; no extra wipe of Photos / Downloads / other apps was done.

`adb install` of the staged signed APK: **Success**.

| Field | Installed package |
|---|---|
| firstInstallTime / lastUpdateTime | 2026-10-29 13:12:44 |
| versionName / versionCode | `0.1.0-beta.1` / `1` |
| minSdk / targetSdk | 24 / 36 |
| signatures | scheme v2 (`PackageSignatures version:2`) |
| installer | null (sideload via ADB) |
| codePath | `/data/app/~~…/com.pixelcut.editor-…/base.apk` |

## Signed-APK tests on device (29/10/2026 13:12–13:24)

Test clip pushed only for this run: `/sdcard/Download/pixelcut-beta-test.mp4` (46 296 B, 4 s, 1280×720 H.264 + AAC, solid blue, generated with PixelCut `ffmpeg.exe`). SAF picker: Recentes → Downloads → that file.

| Test | Result |
|---|---|
| Install signed APK | **OK** (`Success`) |
| Cold start `com.pixelcut.editor/.MainActivity` | **OK** — Recentes empty, «Novo projeto» |
| New project | **OK** — editor, toast «Projeto criado» |
| Import MP4 via SAF | **OK** — `pixelcut-beta-test.mp4` 00:04 in library |
| Add to V1 (`＋`) | **OK** — clip on V + linked A; duration 00:04.00 |
| Play | **OK** — playhead ran to **00:04.00 / 00:04.00**; logcat `c2.exynos.h264.decoder` crop 1280×720; AAudio played |
| Cut (`Dividir`) | **OK** — seek 00:02.28 → two V clips + two «Áudio ligado» + transition diamond |
| Save / leave Recentes | **OK** — logo → Recentes card «Projeto sem título · 16:9 · 00:04.00 · 29 de out., 13:22» |
| Reopen | **OK** — playhead 00:02.28, both halves on V1 restored; **no** missing-media dialog |
| Export main-track MP4 (Media3) | **OK** — dialog «Exportação concluída» `Movies/PixelCut/PixelCut-20261029-132442.mp4` |
| Relaunch / process after export | **OK** — pid still `com.pixelcut.editor`; no crash |
| logcat crash of signed APK | **none** observed during the flow |

### Export probe (pulled to `%TEMP%\pixelcut-fase10-export\`)

| Field | Value |
|---|---|
| Device path | `/sdcard/Movies/PixelCut/PixelCut-20261029-132442.mp4` |
| Bytes | 473 426 |
| SHA-256 | `226D3F7D6497BDD0DA82F486BE3830A0F9A992CC2572ECF56BB7295324D4C228` |
| Container | MP4 (`isom` / `iso2` / `mp41`) |
| Duration | **4.027 s** (video **4.000 s** / 120 frames @ 30 fps; audio 4.027 s AAC padding) |
| Video | H.264 High `avc1`, 1280×720, yuv420p, bt709, progressive, 30 fps |
| Audio | AAC-LC `mp4a`, 44 100 Hz, **mono** |
| Integrity | `ffmpeg -v error -i … -f null -` **exit 0** |

This matches the 4 s main-track timeline (two halves of the same clip). Overlay / text / transition / chroma / extra music were **not** in this project; Android still **omits** those on export (`MainTrackExporter` / `ANDROID_NATIVE_GAPS`). Preserve that gap — do not advertise Windows parity.

## Observations (not blockers for this APK)

1. **Brief toast** `Não foi possível abrir a mídia.` appeared in the accessibility dump at the first `＋` (add to timeline). The string is **not** in PixelCut `src/` or the Android plugin. H.264 decode started in the same second (`cr_MediaCodecBridge` / `c2.exynos.h264.decoder`, crop 1280×720). Preview showed the blue test pattern; play, reopen and export succeeded. Treated as a **WebView/system** media toast, not a PixelCut crash. **No APK rebuild** (would change the staged hash and require a full retest).
2. Library `＋` (fullwidth) vs zoom `+` are distinct; the documented mobile hint «toque em ＋ na biblioteca» is the correct add-to-V1 control.
3. Export of this 4 s colour clip finished in the same UI dump as the tap (~2–3 s). That is not a performance claim for camera footage.

## Pending before GitHub Android asset

1. Keep the signing backup offline. Do **not** generate a second keystore.
2. Attach **this** file `PixelCut-Android-0.1.0-beta.1.apk` (hash `1FE4A4B0…`) only after P0 licence / corresponding-source decisions — **not** done in Fase 10.
3. Release notes must say: Android export is **main track only** (Media3). Preview can show overlays/text that will not be in the MP4.
4. This report is **technical**. It is not legal clearance and not a GitHub publish.

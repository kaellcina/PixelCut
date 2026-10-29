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

---

# Relato da hotfix 0.1.0-beta.2 — 29 de outubro de 2026

**Não é publicação no GitHub.** APK assinado com a **mesma** keystore da beta.1. Sem segunda chave. Sem desinstalar. Sem `pm clear`. Sem apagar projetos.

## APK

| Campo | Valor |
|---|---|
| Staging | `%LOCALAPPDATA%\PixelCut\staging\PixelCut-Android-0.1.0-beta.2.apk` |
| Build | `PixelCut/android/app/build/outputs/apk/release/PixelCut-Android-0.1.0-beta.2.apk` |
| Bytes | 6 533 933 |
| SHA-256 | `EA6CAA2EEEADA4C11B21B8CC253FAEEC20CAECF0AA91736E38ED527ACCB1D606` |
| `apksigner verify` | **Verifies** (v2) |
| versionName / versionCode | `0.1.0-beta.2` / `2` |
| Certificado SHA-256 | `48e79a8fa8ec49514f2ff7ce032f6b2d40b87a1457ed6f20ad168e32461c7d0b` (igual à beta.1) |

## Atualização no Galaxy A54 (SM-A546E, Android 16)

| Campo | Antes | Depois |
|---|---|---|
| versionName | `0.1.0-beta.1` | `0.1.0-beta.2` |
| versionCode | `1` | `2` |
| firstInstallTime | `2026-10-29 13:12:44` | `2026-10-29 13:12:44` (inalterado) |
| lastUpdateTime | `2026-10-29 13:12:44` | `2026-10-29 18:45:43` |
| userId | 10282 | 10282 |

`adb install -r` sobre a beta.1: sucesso. Os recentes da beta.1 reapareceram (projeto com duração 02:16.60).

## Testes reais neste aparelho (hotfix)

Executados:

1. Instalar beta.2 por cima da beta.1 — projetos preservados.
2. Arranque a frio — o projeto antigo abriu com o clipe na faixa V e preview.
3. `am force-stop` + abrir de novo — o vídeo continuou na timeline; o playhead 01:44.35 foi restaurado.
4. Reproduzir — o relógio avançou (00:37.75 / 02:16.60) e o preview mudou de quadro.
5. Exportar MP4 da mídia restaurada — `Movies/PixelCut/PixelCut-20261029-185604.mp4` (103 903 697 bytes).
6. ffprobe: H.264 High 1280×720, AAC-LC, duração 136,65 s (bate com 02:16.60 da timeline).
7. Ícone oficial visível no cabeçalho do app (tesoura + play). Os mipmaps adaptive/round do APK vêm de `assets/icon.png`.

Não executados de forma destrutiva neste aparelho (cobertos por testes automatizados, sem apagar o trabalho do titular):

- Arquivo original movido no armazenamento compartilhado (a cópia privada deve bastar).
- URI `content://` expirada sem cópia.
- Disco cheio na importação.

O corte visual em dois clipes magnéticos não foi confirmado com clareza na captura (a faixa principal fica contínua). A reprodução, o playhead persistido e a exportação após `force-stop` foram confirmados.

Avisos da exportação (inesperados / já documentados): a faixa principal entra no arquivo; sobreposição, texto, chroma, efeitos do catálogo, voz e faixa de música separada não entram.

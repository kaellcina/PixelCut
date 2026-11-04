# Checklist before a public distribution — PixelCut

## v0.1.0-beta.6 — preparada em 03/11/2026

Branch de desenvolvimento `feat/beta6`, baseada na tag pública `v0.1.0-beta.5`. A validação em aparelho foi concluída no Samsung SM-A546E / Android 16 e aceita para esta beta. Nenhuma release anterior deve ser alterada ou removida.

- Editor: MIT, Copyright (c) 2026 Kaell Soares Calacina.
- Windows: Electron 44.10.0, FFmpeg/FFprobe PixelCut n6.1.1 GPL-2.0-or-later.
- Android: Media3 1.11.1, `com.pixelcut.editor`, `versionName` `0.1.0-beta.6`, `versionCode` 12.
- Certificado Android SHA-256: `48e79a8fa8ec49514f2ff7ce032f6b2d40b87a1457ed6f20ad168e32461c7d0b`, igual ao da beta.5.

## Artefatos autorizados

| Arquivo | SHA-256 | Bytes | Estado |
|---|---|---:|---|
| `PixelCut-Setup-0.1.0-beta.6.exe` | `04D481008D32A6F885C6FD1D1A00D8E84576F904679A71272FC8800B1D9936CE` | 150.912.773 | NSIS x64, NotSigned |
| `PixelCut-Android-0.1.0-beta.6.apk` | `EC62FE34B69ABBA3574ED2E89B379119D27CD7CC6C0019EF5C70C6A40DAE280F` | 6.554.985 | v2, zipalign OK, certificado oficial |
| `PixelCut-ffmpeg-n6.1.1-corresponding-source.zip` | `27187E48A173F4096BDE53B2B9265C2C2703BA31F9DDD53F12B6BF27D1FB52F8` | 42.315.883 | mesmo pacote higienizado das releases anteriores |

Nunca publicar `app-debug.apk`, o APK técnico sem assinatura, os ZIPs rollback `D581603E…` / `E06BD9FE…` ou instaladores antigos sem o sufixo correto.

## Validação concluída

- [x] Build Vite, boot Electron e fluxo GUI.
- [x] Suíte de exportação Windows e verificação dos binários FFmpeg/FFprobe.
- [x] Testes JVM Android, `assembleDebug` e `assembleRelease`.
- [x] Corte na agulha e pan da timeline no aparelho.
- [x] Exportações Android com blur, música, texto, imagem e digitação progressiva.
- [x] APK alinhado, assinatura v2 e certificado comparado com a beta.5.
- [x] Hashes e notas de versão atualizados.
- [ ] Instalação do APK assinado por cima da beta.5: opcional, indisponível porque o aparelho não estava conectado no fechamento.

## Publicação autorizada

- [ ] Commit final e fast-forward de `main`.
- [ ] Tag anotada `v0.1.0-beta.6` e push.
- [ ] GitHub Release com os três anexos exatos acima.
- [ ] Confirmar os anexos e hashes na Release publicada.

## Histórico

`v0.1.0-beta.5` foi publicada em 01/11/2026. As releases `v0.1.0-beta.1`, `v0.1.0-beta.2`, `v0.1.0-beta.4` e `v0.1.0-beta.5` permanecem disponíveis. CapRocket não é bloqueador de distribuição. Authenticode não é exigido nesta beta; o aviso do SmartScreen é esperado.

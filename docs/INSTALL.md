# Instalar o PixelCut

Quando a versão `v0.1.0-beta.1` for **publicada**, os downloads ficam em:

[https://github.com/kaellcina/PixelCut/releases/tag/v0.1.0-beta.1](https://github.com/kaellcina/PixelCut/releases/tag/v0.1.0-beta.1)

Neste momento a Release ainda está em rascunho: os links acima **ainda não** servem como download público.

Nada neste documento envia arquivos para o GitHub.

## Instalador Windows (EXE)

| Campo | Valor |
|---|---|
| Arquivo | `PixelCut-Setup-0.1.0-beta.1.exe` |
| SHA-256 | `9D3D4BC53C7851487EB345BD8AE6B88CC5062D098E586E88AE2AD33F3A86F49C` |
| Tamanho | 144 836 084 bytes |
| App | Electron 44.10.0, x64 |
| FFmpeg | PixelCut n6.1.1 (`050577AF…` / `0BB9D300…`) |
| Assinatura | NotSigned |

Não use instaladores locais antigos como download da beta pública:

- `PixelCut-Setup-0.1.0.exe`
- `PixelCut-Setup-0.1.0-electron44.exe`
- `PixelCut-Setup-0.1.0-ownffmpeg.exe`

### Passos

1. No Windows 10 ou 11 (64 bits), baixe `PixelCut-Setup-0.1.0-beta.1.exe`.
2. Confira o SHA-256:

   ```powershell
   Get-FileHash .\PixelCut-Setup-0.1.0-beta.1.exe -Algorithm SHA256
   ```

3. Feche o PixelCut se já estiver aberto.
4. Execute o instalador. O NSIS deixa escolher a pasta e cria atalhos no menu Iniciar e na área de trabalho.
5. O SmartScreen do Windows pode avisar porque o arquivo **não** tem assinatura Authenticode. Isso é esperado nesta beta. Confie no SHA-256 acima, não num “editor” da Microsoft.
6. **Não** apague `%AppData%\PixelCut\projects`. Desinstalar o app deve deixar os projetos, salvo se você remover essa pasta.

O instalador mostra MIT (código original do PixelCut) e GPL-2.0-or-later (FFmpeg/FFprobe). Depois da instalação:

- `resources/LICENSE`
- `resources/THIRD_PARTY_NOTICES.md`
- `resources/app.asar.unpacked/third-party/ffmpeg/COPYING.GPLv2`
- `resources/app.asar.unpacked/third-party/ffmpeg/LICENSE-NOTICES.md`

### Requisitos mínimos (Windows)

- Windows 10 ou Windows 11, 64 bits
- Espaço em disco para o app (o EXE tem 144 836 084 bytes) e para as suas mídias
- Internet só para Google Fonts no **preview de texto**; a exportação não precisa de rede

## APK Android

Notas do produto: [ANDROID.md](ANDROID.md). Assinatura: [ANDROID_SIGNING.md](ANDROID_SIGNING.md).

**Mínimo:** Android 7.0 (API 24). `applicationId` `com.pixelcut.editor`.

### Build assinado

| Campo | Valor |
|---|---|
| Nome | `PixelCut-Android-0.1.0-beta.1.apk` |
| Bytes | 6 267 993 |
| SHA-256 | `1FE4A4B01B212AB2E7D4BCA7AE73D72568E66DE5396E92FDE5707723BC054F18` |
| Assinatura | v2, `apksigner verify` OK. Pacote `com.pixelcut.editor`, versão `0.1.0-beta.1`, minSdk 24. |

**Não** distribua `app-debug.apk`. Não use o hash antigo unsigned `AF4B1588…`.

### Instalação direta (sideload)

1. Desinstale um PixelCut de depuração se a instalação for recusada (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`). Isso apaga os projetos privados do app.
2. Permita instalar de fontes desconhecidas no navegador ou no app Arquivos.
3. Abra `PixelCut-Android-0.1.0-beta.1.apk` e confira o SHA-256 acima.
4. Avisos de fonte desconhecida / Play Protect são esperados num sideload do GitHub.
5. A exportação ainda grava **somente a faixa principal de vídeo**. Sobreposição, títulos, transições, chroma, efeitos do catálogo, efeitos de voz e uma faixa de música separada ficam de fora.

O APK assinado foi instalado e testado num Galaxy A54 5G (Android 16) em 29 de outubro de 2026. Veja [ANDROID.md](ANDROID.md) e [ANDROID_DEVICE.md](ANDROID_DEVICE.md).

## Fontes correspondentes (FFmpeg)

O instalador Windows inclui os executáveis GPL do FFmpeg/FFprobe. Fontes para reconstruir exatamente esses binários:

[`../ffmpeg-corresponding-source/pixelcut-n6.1.1/`](../ffmpeg-corresponding-source/pixelcut-n6.1.1/)

ZIP da Release (junto do EXE):
`PixelCut-ffmpeg-n6.1.1-corresponding-source.zip`  
SHA-256 `27187E48A173F4096BDE53B2B9265C2C2703BA31F9DDD53F12B6BF27D1FB52F8` (42 315 883 bytes)

Resumo da oferta: [`../ffmpeg-corresponding-source/README.md`](../ffmpeg-corresponding-source/README.md)

## Bugs

[Issues do repositório](https://github.com/kaellcina/PixelCut/issues) (modelos em `.github/ISSUE_TEMPLATE/`). Inclua o SHA-256 do arquivo que instalou. Não anexe mídia pessoal, keystores ou `.env`.

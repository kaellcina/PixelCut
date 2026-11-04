# Instalar o PixelCut

Versão atual: **[`v0.1.0-beta.6`](https://github.com/kaellcina/PixelCut/releases/tag/v0.1.0-beta.6)**.

As tags anteriores permanecem no repositório. Não altere os anexos delas.

## Instalador Windows (EXE)

| Campo | Valor |
|---|---|
| Arquivo | `PixelCut-Setup-0.1.0-beta.6.exe` |
| SHA-256 | `04D481008D32A6F885C6FD1D1A00D8E84576F904679A71272FC8800B1D9936CE` |
| Tamanho | 150 912 773 bytes |
| App | Electron 44.10.0, x64 |
| FFmpeg | PixelCut n6.1.1 (`050577AF…` / `0BB9D300…`) |
| Assinatura | NotSigned |

Não use instaladores locais antigos como download da beta pública:

- `PixelCut-Setup-0.1.0.exe`
- `PixelCut-Setup-0.1.0-electron44.exe`
- `PixelCut-Setup-0.1.0-ownffmpeg.exe`

### Passos

1. No Windows 10 ou 11 (64 bits), use `PixelCut-Setup-0.1.0-beta.6.exe`.
2. Confira o SHA-256:

   ```powershell
   Get-FileHash .\PixelCut-Setup-0.1.0-beta.6.exe -Algorithm SHA256
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
- Espaço em disco para o app (o EXE tem 150 912 773 bytes) e para as suas mídias
- Internet só para Google Fonts no **preview de texto**; a exportação não precisa de rede

## APK Android

Notas do produto: [ANDROID.md](ANDROID.md). Assinatura: [ANDROID_SIGNING.md](ANDROID_SIGNING.md).

**Mínimo:** Android 7.0 (API 24). `applicationId` `com.pixelcut.editor`. `versionCode` 12, `versionName` `0.1.0-beta.6`.

### Build assinado (0.1.0-beta.6)

| Campo | Valor |
|---|---|
| Nome | `PixelCut-Android-0.1.0-beta.6.apk` |
| Bytes | 6 554 985 |
| SHA-256 | `EC62FE34B69ABBA3574ED2E89B379119D27CD7CC6C0019EF5C70C6A40DAE280F` |
| Assinatura | v2, `apksigner verify` e `zipalign -c` OK. Pacote `com.pixelcut.editor`, versão `0.1.0-beta.6`, `versionCode` 12, minSdk 24. Mesma keystore da beta.1 (`48e79a8f…`). |

A beta.1 (`PixelCut-Android-0.1.0-beta.1.apk`, SHA-256 `1FE4A4B01B212AB2E7D4BCA7AE73D72568E66DE5396E92FDE5707723BC054F18`) e a beta.2 (`EA6CAA2EEEADA4C11B21B8CC253FAEEC20CAECF0AA91736E38ED527ACCB1D606`) **permanecem disponíveis**. Não altere os anexos daquelas versões.

**Não** distribua `app-debug.apk`. Não use o hash antigo unsigned `AF4B1588…`.

### Atualizar de uma beta anterior (recomendado)

1. **Não** desinstale o PixelCut e **não** limpe os dados.
2. Permita fontes desconhecidas e abra `PixelCut-Android-0.1.0-beta.6.apk`.
3. Confira o SHA-256 da beta.6 acima.
4. Os projetos das betas anteriores devem continuar no aparelho.

### Instalação nova (sideload)

1. Desinstale um PixelCut de depuração se a instalação falhar por assinatura diferente (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`). Isso apaga os projetos privados do app.
2. Permita instalar de fontes desconhecidas no navegador ou no app Arquivos.
3. Abra o APK da beta.6 e confira o SHA-256.
4. Avisos de fonte desconhecida / Play Protect são esperados num sideload do GitHub.
5. A beta.6 exporta a faixa principal, volume, músicas/áudio, textos, sobreposições de imagem, zoom e efeitos Media3 compatíveis. Vídeos sobrepostos, chroma key e efeitos de voz ainda não entram no MP4 Android.

## Fontes correspondentes (FFmpeg)

O instalador Windows inclui os executáveis GPL do FFmpeg/FFprobe. Fontes para reconstruir exatamente esses binários:

[`../ffmpeg-corresponding-source/pixelcut-n6.1.1/`](../ffmpeg-corresponding-source/pixelcut-n6.1.1/)

ZIP da Release (junto do EXE):
`PixelCut-ffmpeg-n6.1.1-corresponding-source.zip`  
SHA-256 `27187E48A173F4096BDE53B2B9265C2C2703BA31F9DDD53F12B6BF27D1FB52F8` (42 315 883 bytes)

Resumo da oferta: [`../ffmpeg-corresponding-source/README.md`](../ffmpeg-corresponding-source/README.md)

## Bugs

[Issues do repositório](https://github.com/kaellcina/PixelCut/issues) (modelos em `.github/ISSUE_TEMPLATE/`). Inclua o SHA-256 do arquivo que instalou. Não anexe mídia pessoal, keystores ou `.env`.

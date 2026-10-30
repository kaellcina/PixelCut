# PixelCut v0.1.0-beta.4

Tag: `v0.1.0-beta.4`  
Repositório: [github.com/kaellcina/PixelCut](https://github.com/kaellcina/PixelCut)

Esta é uma beta pública gratuita. Pode falhar. Guarde cópias da sua mídia. Os projetos ficam no seu aparelho (`%AppData%\PixelCut\projects` no Windows; armazenamento privado do app no Android). O PixelCut **não** é o CapCut e **não** tem ligação com a ByteDance.

O código original do editor é MIT, Copyright (c) 2026 Kaell Soares Calacina. No Windows, o app também envia FFmpeg e FFprobe como executáveis **separados** GPL-2.0-or-later. No Android, a exportação usa AndroidX Media3 (Apache-2.0) e **não** inclui FFmpeg.

**Windows e Android não têm os mesmos recursos.** No Android, a exportação ainda grava **somente a faixa principal**.

## O que mudou nesta versão

- **Linha do tempo:** agulha arrastável pelo cabo e pela linha, rolagem automática nas bordas e viewport que acompanha a reprodução, com o preview sincronizado ao tempo da agulha.
- **Cortes e transições:** cada corte guarda o próprio tipo de transição; aplicar um preset usa o corte selecionado, não o mais próximo por engano.
- **Estabilidade:** preview nas pontas do corte, desfazer/refazer e autosave sem sobrescrever o projeto com um estado vazio.
- **Persistência:** projetos, mídia importada e o último quadro sobrevivem ao fechar o app (no Android, sem desinstalar e sem limpar os dados).
- **Identidade:** Windows e Android saem juntos como `0.1.0-beta.4` (`versionCode` 4 no Android, mesma chave das betas anteriores).

As releases `v0.1.0-beta.1` e `v0.1.0-beta.2` **permanecem disponíveis**. Os anexos delas não foram alterados.

## Downloads

| Arquivo | Plataforma | SHA-256 | Bytes |
|---|---|---|---|
| `PixelCut-Setup-0.1.0-beta.4.exe` | Windows 10/11 x64 | `2A842E13DF1FEA905C454F49E31E1B6FC1CF4F5AC2AB8E0AC45D004A5C847C80` | 151 309 481 |
| `PixelCut-Android-0.1.0-beta.4.apk` | Android 7+ (`com.pixelcut.editor`) | `CB2CD29323A40FD160694909C0F6D307DCAE4CF6D0CD75C0D1AAC8BF9DC7ADDB` | 6 539 581 |
| `PixelCut-ffmpeg-n6.1.1-corresponding-source.zip` | Fontes do FFmpeg/FFprobe enviados no Windows | `27187E48A173F4096BDE53B2B9265C2C2703BA31F9DDD53F12B6BF27D1FB52F8` | 42 315 883 |

Electron 44.10.0. O instalador Windows **não** tem Authenticode — o SmartScreen pode avisar. Isso é esperado.

Não use `PixelCut-Setup-0.1.0.exe`, `PixelCut-Setup-0.1.0-electron44.exe`, `PixelCut-Setup-0.1.0-ownffmpeg.exe`, `app-debug.apk` nem o hash Android antigo sem assinatura `AF4B1588…`.

## Instalar (Windows)

1. Windows 10 ou 11 de 64 bits
2. Confira o SHA-256:

   ```powershell
   Get-FileHash .\PixelCut-Setup-0.1.0-beta.4.exe -Algorithm SHA256
   ```

3. Feche o PixelCut se estiver aberto
4. Execute o instalador NSIS (pasta à escolha, atalhos no menu Iniciar e na área de trabalho)
5. Não apague `%AppData%\PixelCut\projects` se quiser manter o trabalho

## Instalar (Android)

1. Android 7.0 (API 24) ou posterior
2. Confira o SHA-256:

   ```powershell
   Get-FileHash .\PixelCut-Android-0.1.0-beta.4.apk -Algorithm SHA256
   ```

3. **Não** desinstale e **não** limpe os dados se já usa a beta.1, beta.2 ou beta.3 — instale por cima
4. Permita fontes desconhecidas e abra o APK
5. A exportação Android grava **somente a faixa principal** (corte, sequência, imagens paradas, velocidade e o áudio original desse vídeo). Sobreposições, textos, transições, chroma, efeitos visuais do catálogo, efeitos de voz e a faixa de música **não entram** no MP4. O preview no celular pode mostrar mais do que o arquivo final.

Só desinstale um PixelCut de depuração se a instalação falhar por chave diferente (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`). Isso apaga os projetos privados do app.

## Limitação da exportação Android

Inalterada em relação às betas anteriores: Media3 1.11.1, **só a faixa principal**. Isso **não** é paridade com o Windows, onde a exportação FFmpeg inclui efeitos, transições, chroma, títulos, sobreposições, voz e música.

## Licença e fontes correspondentes

- Código original do PixelCut: **MIT**, Copyright (c) 2026 Kaell Soares Calacina (`LICENSE`)
- `ffmpeg.exe` / `ffprobe.exe`: **GPL-2.0-or-later**. SHA-256:
  - ffmpeg `050577AFFE30A13282A5145E9FD8220D3A3940CAE4E81E61987B340CD3C2D291`
  - ffprobe `0BB9D300815A59AA26B7F8494D5A4BE84F6803FCBC069486FADF63A62AE8668E`
- Outros componentes: `THIRD_PARTY_NOTICES.md`
- Pacote para reconstruir o par enviado: `PixelCut-ffmpeg-n6.1.1-corresponding-source.zip` (mesmo hash das releases anteriores; o FFmpeg do Windows não mudou)

## Bugs

Abra um issue em [github.com/kaellcina/PixelCut/issues](https://github.com/kaellcina/PixelCut/issues). Inclua o SHA-256 do instalador ou do APK. Não envie mídia pessoal, keystore ou `.env`.

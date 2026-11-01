# PixelCut v0.1.0-beta.5

Tag proposta: `v0.1.0-beta.5`  
Repositório: [github.com/kaellcina/PixelCut](https://github.com/kaellcina/PixelCut)

**Ainda não publicada.** Sem tag, sem push e sem GitHub Release até autorização explícita. A última Release pública continua a `v0.1.0-beta.4`.

Esta é uma beta pública gratuita. Pode falhar. Guarde cópias da sua mídia. Os projetos ficam no seu aparelho (`%AppData%\PixelCut\projects` no Windows; armazenamento privado do app no Android). O PixelCut **não** é o CapCut e **não** tem ligação com a ByteDance.

O código original do editor é MIT, Copyright (c) 2026 Kaell Soares Calacina. No Windows, o app também envia FFmpeg e FFprobe como executáveis **separados** GPL-2.0-or-later. No Android, a exportação usa AndroidX Media3 (Apache-2.0) e **não** inclui FFmpeg.

**Windows e Android não têm os mesmos recursos.** No Android, a exportação ainda grava **somente a faixa principal**.

## O que mudou nesta versão

- **Linha do tempo:** cortes com transições empacotadas (sobreposição real no tempo), agulha arrastável, rolagem nas bordas e preview sincronizado. Cada corte guarda o próprio tipo de transição.
- **Transições na exportação Android:** dissolver, fade preto, flash (fade branco) e wipe ←/→/↑/↓ passam a ser gravados no MP4 da faixa principal (Media3, duas sequências + compositor). Testado no Galaxy A54. O compositor esconde a sequência de cima nos vãos empacotados, para não deixar um ponto preto no centro entre um corte e outro.
- **Exportação Windows:** cortes secos e transições (`xfade` / `acrossfade`) no FFmpeg, com duração empacotada (soma dos clipes menos as sobreposições).
- **Estabilidade:** preview nas pontas do corte, desfazer/refazer e autosave sem sobrescrever o projeto com um estado vazio; diálogo de exportação Android só pede confirmação quando a transição realmente não entra no arquivo.
- **Mídia e projetos (JosiasAz, PR #1):** remover um vídeo da biblioteca já não apaga o arquivo na hora — o arquivo só é liberado ao sair do projeto, depois de salvar. Duplicar um projeto no Android deixa de apagar o vídeo do original. O autosave não marca “Salvo” quando ainda há um salvamento na fila. A fila de liberação distingue `deleted`, `in-use` e `failed`.
- **Identidade:** Windows e Android saem juntos como `0.1.0-beta.5` (`versionCode` 11 no Android). Mesma chave das betas anteriores. O instalador NSIS **não** apaga `%AppData%\PixelCut` na desinstalação.

As releases `v0.1.0-beta.1`, `v0.1.0-beta.2` e `v0.1.0-beta.4` **permanecem disponíveis**. Os anexos delas não foram alterados.

## Downloads (arquivos locais, pré-publicação)

| Arquivo | Plataforma | SHA-256 | Bytes |
|---|---|---|---|
| `PixelCut-Setup-0.1.0-beta.5.exe` | Windows 10/11 x64 | `CD7DCECB3B76B0F0644B1D50F019D9E8BF6ED47DBC6E2A624F6D6D114BB1D48C` | 151 311 918 |
| `PixelCut-Android-0.1.0-beta.5.apk` | Android 7+ (`com.pixelcut.editor`) | `1381919E9A32EF20EDE26F76F81770C538F23358145BDC7A133618DE07F12DCB` | 6 547 137 |
| `PixelCut-ffmpeg-n6.1.1-corresponding-source.zip` | Fontes do FFmpeg/FFprobe enviados no Windows | `27187E48A173F4096BDE53B2B9265C2C2703BA31F9DDD53F12B6BF27D1FB52F8` | 42 315 883 |

Electron 44.10.0. O instalador Windows **não** tem Authenticode — o SmartScreen pode avisar. Isso é esperado.

Não use `PixelCut-Setup-0.1.0.exe`, `PixelCut-Setup-0.1.0-electron44.exe`, `PixelCut-Setup-0.1.0-ownffmpeg.exe`, `app-debug.apk` nem o hash Android antigo sem assinatura `AF4B1588…`.

## Instalar (Windows)

1. Windows 10 ou 11 de 64 bits
2. Confira o SHA-256:

   ```powershell
   Get-FileHash .\PixelCut-Setup-0.1.0-beta.5.exe -Algorithm SHA256
   ```

3. Feche o PixelCut se estiver aberto
4. Execute o instalador NSIS (pasta à escolha, atalhos no menu Iniciar e na área de trabalho)
5. Não apague `%AppData%\PixelCut\projects` se quiser manter o trabalho. Reinstalar ou desinstalar o app **não** remove essa pasta.

## Instalar (Android)

1. Android 7.0 (API 24) ou posterior
2. Confira o SHA-256:

   ```powershell
   Get-FileHash .\PixelCut-Android-0.1.0-beta.5.apk -Algorithm SHA256
   ```

3. **Não** desinstale e **não** limpe os dados se já usa uma beta anterior — instale por cima (`versionCode` 11)
4. Permita fontes desconhecidas e abra o APK
5. A exportação Android grava **somente a faixa principal**. Dissolver, fade preto, flash e wipe entram no MP4 dessa faixa. Sobreposições, textos, chroma, efeitos do catálogo, efeitos de voz, volume diferente de 100% e a faixa de música **não entram**.

Só desinstale um PixelCut de depuração se a instalação falhar por chave diferente (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`). Isso apaga os projetos privados do app.

## Limitação da exportação Android

Media3 1.11.1, **só a faixa principal**. Transições suportadas nessa faixa: dissolver, fade preto, flash, wipe ←/→/↑/↓. Outros presets de transição saem como dissolver. Isso **não** é paridade com o Windows, onde a exportação FFmpeg inclui efeitos, chroma, títulos, sobreposições, voz e música.

O volume da faixa principal diferente de 100% ainda não é aplicado no Android (mudo remove o áudio).

## Licença e fontes correspondentes

- Código original do PixelCut: **MIT**, Copyright (c) 2026 Kaell Soares Calacina (`LICENSE`)
- `ffmpeg.exe` / `ffprobe.exe`: **GPL-2.0-or-later**. SHA-256:
  - ffmpeg `050577AFFE30A13282A5145E9FD8220D3A3940CAE4E81E61987B340CD3C2D291`
  - ffprobe `0BB9D300815A59AA26B7F8494D5A4BE84F6803FCBC069486FADF63A62AE8668E`
- Outros componentes: `THIRD_PARTY_NOTICES.md`
- Pacote para reconstruir o par enviado: `PixelCut-ffmpeg-n6.1.1-corresponding-source.zip` (mesmo hash das releases anteriores; o FFmpeg do Windows não mudou)

## Agradecimento

Obrigado a **JosiasAz** (Josias Azevedo) pelas correções de preservação de mídia no PR #1 — em especial por evitar a perda de vídeos ao desfazer uma remoção, ao duplicar projetos no Android e no autosave. A autoria desses commits permanece a dele.

## Bugs

Abra um issue em [github.com/kaellcina/PixelCut/issues](https://github.com/kaellcina/PixelCut/issues). Inclua o SHA-256 do instalador ou do APK. Não envie mídia pessoal, keystore ou `.env`.

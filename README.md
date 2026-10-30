<p align="center">
  <img src="docs/screenshots/icon.png" alt="Ícone do PixelCut" width="112" height="112">
</p>

<h1 align="center">PixelCut</h1>

<p align="center"><strong>Editor de vídeo gratuito e de código aberto</strong></p>

<p align="center">
  Corte, organize e exporte vídeos no computador ou no celular, sem assinatura e sem loja obrigatória.
</p>

<p align="center">
  <img alt="Windows" src="https://img.shields.io/badge/Windows-10%2F11%20x64-0A84FF?style=flat-square">
  <img alt="Android" src="https://img.shields.io/badge/Android-7%2B-3DDC84?style=flat-square">
  <img alt="Beta" src="https://img.shields.io/badge/versão-v0.1.0--beta.4-1D4ED8?style=flat-square">
  <img alt="Licença MIT" src="https://img.shields.io/badge/licença-MIT-22C55E?style=flat-square">
</p>

O PixelCut é uma beta pública gratuita para **Windows 10/11 (64 bits)** e **Android 7 ou superior**. Os projetos ficam no seu aparelho. Ele **não** é o CapCut e **não** tem ligação com a ByteDance.

Windows e Android **não** têm os mesmos recursos. No Android, a exportação ainda grava **somente a faixa principal**.

## Capturas de tela

Janela real do PixelCut 0.1.0 no Windows. A mídia da demonstração é gerada (padrão de teste e o ícone do app) — sem rostos nem arquivos pessoais.

<p align="center">
  <img src="docs/screenshots/editor-timeline.png" alt="Editor e linha do tempo do PixelCut" width="900">
</p>

<p align="center"><em>Editor — preview, biblioteca, propriedades e linha do tempo com vídeo, texto, áudio e sobreposição</em></p>

<p align="center">
  <img src="docs/screenshots/home.png" alt="Tela inicial do PixelCut" width="820">
</p>

<p align="center"><em>Tela inicial — começar um projeto neste computador</em></p>

## O que o PixelCut faz

No **Windows** você pode:

- Editar em linha do tempo, com várias faixas (vídeo, sobreposição, texto e áudio)
- Importar vídeo, imagem e áudio
- Cortar, dividir, reorganizar clipes, ajustar velocidade e volume
- Navegar a timeline com agulha arrastável, rolagem automática e preview sincronizado
- Inserir textos, transições, efeitos visuais e chroma key
- Tratar áudio (incluindo efeitos de voz e faixa de música)
- Salvar projetos com autosave
- Exportar MP4 em H.264 + AAC, com o que está na linha do tempo — efeitos, transições, chroma, títulos, sobreposições, voz e música

No **Android** a interface do editor é a mesma ideia (projetos, linha do tempo com agulha arrastável, preview e persistência ao fechar o app). A exportação, porém, usa o Media3 e **grava só a faixa principal** (corte, sequência, imagens paradas, velocidade e o áudio original desse vídeo).

**Não entram no MP4 do Android:** sobreposições, textos, transições, chroma key, efeitos visuais do catálogo, cadeia de efeitos de voz nem a faixa de música separada. O preview no celular pode mostrar mais do que o arquivo final. Isso **não** é paridade com o Windows.

## Baixar o PixelCut

A versão atual é a **`v0.1.0-beta.4`** (Windows e Android). As releases anteriores permanecem no GitHub; os anexos delas **não** foram alterados.

**[github.com/kaellcina/PixelCut/releases/tag/v0.1.0-beta.4](https://github.com/kaellcina/PixelCut/releases/tag/v0.1.0-beta.4)**

| Plataforma | Arquivo | SHA-256 |
|---|---|---|
| Windows 10/11 x64 | `PixelCut-Setup-0.1.0-beta.4.exe` | `2A842E13DF1FEA905C454F49E31E1B6FC1CF4F5AC2AB8E0AC45D004A5C847C80` |
| Android 7+ | `PixelCut-Android-0.1.0-beta.4.apk` | `CB2CD29323A40FD160694909C0F6D307DCAE4CF6D0CD75C0D1AAC8BF9DC7ADDB` |
| Fontes FFmpeg n6.1.1 | `PixelCut-ffmpeg-n6.1.1-corresponding-source.zip` | `27187E48A173F4096BDE53B2B9265C2C2703BA31F9DDD53F12B6BF27D1FB52F8` |

Passo a passo: [docs/INSTALL.md](docs/INSTALL.md). Notas: [docs/RELEASE_NOTES_v0.1.0-beta.4.md](docs/RELEASE_NOTES_v0.1.0-beta.4.md).

- **Windows:** baixe o EXE, confira o SHA-256, execute o instalador NSIS. O arquivo **não** tem assinatura Authenticode — o SmartScreen pode avisar. Isso é esperado nesta beta.
- **Android:** o APK é **assinado** (esquema v2, mesma chave das betas anteriores) e distribuído **fora da Play Store**. Ative a instalação de fontes desconhecidas, confira o SHA-256 e instale. Para atualizar de uma beta anterior, **não** desinstale e **não** limpe os dados. Só desinstale um PixelCut de depuração (chave diferente).

Não use instaladores antigos (`PixelCut-Setup-0.1.0.exe`, `…-electron44.exe`, `…-ownffmpeg.exe`) nem `app-debug.apk`.

## Como instalar

### Windows

1. Windows 10 ou 11 de 64 bits
2. Confira o SHA-256:

   ```powershell
   Get-FileHash .\PixelCut-Setup-0.1.0-beta.4.exe -Algorithm SHA256
   ```

3. Feche o PixelCut se estiver aberto
4. Execute o instalador (pasta à escolha, atalhos no menu Iniciar e na área de trabalho)
5. Os projetos ficam em `%AppData%\PixelCut\projects` — não apague essa pasta se quiser manter o trabalho

### Android (instalação direta)

1. Android 7.0 (API 24) ou posterior
2. Confira o SHA-256:

   ```powershell
   Get-FileHash .\PixelCut-Android-0.1.0-beta.4.apk -Algorithm SHA256
   ```

3. Se já tiver a beta.1, beta.2 ou beta.3, **não** desinstale: instale por cima
4. Permita fontes desconhecidas e abra o APK
5. Lembrete: a exportação no Android inclui **só a faixa principal**

Detalhes: [docs/INSTALL.md](docs/INSTALL.md) e [docs/ANDROID.md](docs/ANDROID.md).

## Rodar a partir do código (Windows)

```powershell
npm ci
npm start
```

Node.js 22+ e Windows 64 bits. O fluxo de CI **não** gera nem publica instaladores sozinho (`workflow_dispatch`).

## Como reportar bugs

Abra um issue em [github.com/kaellcina/PixelCut/issues](https://github.com/kaellcina/PixelCut/issues). Há modelos em [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/).

Inclua:

- Windows ou Android
- Versão ou o SHA-256 do instalador/APK
- Passos, resultado esperado e o que aconteceu

**Não** envie mídia pessoal, pasta de projetos, keystore ou arquivos `.env`.

## Como contribuir

Veja [CONTRIBUTING.md](CONTRIBUTING.md). Mudanças em FFmpeg, no alcance da exportação Android ou nas licenças pedem conversa antes do pull request.

## Licença e créditos

- **Código original do PixelCut** (aplicação, documentos originais e recursos originais): licença **MIT**, Copyright (c) 2026 Kaell Soares Calacina. Texto oficial: [LICENSE](LICENSE). Esse copyright **não** cobre o FFmpeg nem outros trabalhos de terceiros.
- **FFmpeg e FFprobe** no Windows são executáveis **separados**, **GPL-2.0-or-later**. O PixelCut os inicia com `spawn` e argumentos de linha de comando; não liga `libav*`. Avisos: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) e `third-party/ffmpeg/COPYING.GPLv2`.
- Fontes correspondentes do par enviado: [`ffmpeg-corresponding-source/`](ffmpeg-corresponding-source/README.md). O ZIP `PixelCut-ffmpeg-n6.1.1-corresponding-source.zip` deve ir na mesma Release que o instalador Windows.
- Os demais componentes conservam as próprias licenças. Nota de arquitetura (não é parecer jurídico): [docs/LICENSING.md](docs/LICENSING.md).

FFmpeg é marca de Fabrice Bellard.

## Limitações desta beta

- É um editor que funciona, não uma suíte profissional completa
- Instalador Windows sem Authenticode (alerta do SmartScreen)
- Preview e exportação podem divergir
- No Windows, os projetos guardam caminhos locais absolutos
- No Android, a exportação é só a faixa principal
- Sem remoção de fundo, máscaras, legendas automáticas, síntese de fala ou assistente de IA

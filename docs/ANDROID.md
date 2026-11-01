# PixelCut Android — v0.1.0-beta.5

Sideload. Isto não é um anúncio da Play Store.

A `v0.1.0-beta.5` atualiza o APK (`versionCode` 10, mesma chave) **e** o instalador Windows. **Ainda não publicada no GitHub.** As tags anteriores permanecem; os anexos delas não foram alterados.

## O que esta versão traz no celular

- Agulha da timeline arrastável, rolagem automática nas bordas e preview sincronizado
- Cortes com transições independentes; o preset vai para o corte escolhido
- Persistência ao fechar o app: projetos, mídia importada e o último quadro
- Ícone launcher / adaptive / round da identidade oficial do PixelCut

## O que funciona no app

- Recentes: criar, abrir, renomear, duplicar, apagar projetos (armazenamento privado)
- Importar vídeo, imagem e áudio pelo seletor de documentos do sistema (SAF); o arquivo original não é apagado
- Edição na timeline: corte, divisão, clipes, texto, sobreposições, efeitos no **preview**
- Reprodução no aparelho
- Autosave; desinstalar o app apaga essa cópia
- Exportar MP4 com AndroidX Media3 Transformer **1.11.1**

## Limitação da exportação

A exportação Android grava **somente a faixa principal de vídeo**: corte, sequência, imagens paradas, velocidade, o áudio original desse vídeo e as transições suportadas (dissolver, fade preto, flash, wipe ←/→/↑/↓). Outros presets saem como dissolver.

**Não entram no MP4 do Android:** sobreposições, títulos, chroma key, efeitos visuais do catálogo, cadeia de efeitos de voz, volume diferente de 100% nem a faixa de música separada. O preview pode mostrar mais do que o arquivo. Isso **não** é paridade com o Windows.

## Requisitos

- Android **7.0** (API 24) ou posterior
- `applicationId` `com.pixelcut.editor`
- `targetSdk` 36
- Internet só para as Google Fonts no preview de texto

## Atualizar de uma beta anterior

1. **Não** desinstale. **Não** limpe os dados do aplicativo.
2. Instale `PixelCut-Android-0.1.0-beta.5.apk` por cima (`adb install -r` ou o instalador de APK).
3. Confira o SHA-256 `AE999F2D6AD412EDE6B65172AFF75822F8205B16F0B78B46E4CC9901112D74A3`.
4. Abra um projeto antigo: o vídeo deve voltar à timeline.

Se a instalação for recusada com `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, existe um PixelCut assinado com **outra** chave (debug). Desinstalar nesse caso apaga os projetos privados.

Não instale `app-debug.apk`.

## Build local

| Campo | beta.5 (local) | beta.4 | beta.2 | beta.1 |
|---|---|---|---|---|
| Staging | `%LOCALAPPDATA%\PixelCut\staging\PixelCut-Android-0.1.0-beta.5.apk` | `…-beta.4.apk` | `…-beta.2.apk` | `…-beta.1.apk` |
| SHA-256 | `AE999F2D6AD412EDE6B65172AFF75822F8205B16F0B78B46E4CC9901112D74A3` | `CB2CD29323A40FD160694909C0F6D307DCAE4CF6D0CD75C0D1AAC8BF9DC7ADDB` | `EA6CAA2EEEADA4C11B21B8CC253FAEEC20CAECF0AA91736E38ED527ACCB1D606` | `1FE4A4B01B212AB2E7D4BCA7AE73D72568E66DE5396E92FDE5707723BC054F18` |
| Tamanho | 6 546 577 bytes | 6 539 581 bytes | 6 533 933 bytes | 6 267 993 bytes |
| versionName / versionCode | `0.1.0-beta.5` / `10` | `0.1.0-beta.4` / `4` | `0.1.0-beta.2` / `2` | `0.1.0-beta.1` / `1` |
| Assinatura | v2, mesmo certificado | v2 | v2 |

Relato de aparelho: [ANDROID_DEVICE.md](ANDROID_DEVICE.md). Assinatura: [ANDROID_SIGNING.md](ANDROID_SIGNING.md).

## Segurança

- Mantenha o `.jks` de release e o `keystore.properties` fora do Git.
- O PixelCut Android **não** embarca FFmpeg. O Media3 é Apache-2.0 (veja `THIRD_PARTY_NOTICES.md`).
- O código original do editor é MIT, Copyright (c) 2026 Kaell Soares Calacina.

## Bugs

Issues no GitHub deste repositório, modelo “Bug”, plataforma Android. Inclua o SHA-256 do APK. Não anexe vídeos pessoais, keystores nem `.env`.

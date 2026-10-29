# PixelCut Android — v0.1.0-beta.2

Sideload. Isto não é um anúncio da Play Store.

A `v0.1.0-beta.1` continua válida. Esta hotfix **substitui só o APK Android** (`versionCode` 2) e não altera o instalador Windows.

## O que a hotfix corrige

- Ícone launcher / adaptive / round: identidade oficial do PixelCut (tesoura + play em pixel art), gerada a partir de `assets/icon.png`.
- Vídeos importados sobrevivem ao fechar o aplicativo: cópia privada em `files/media`, flush do projeto no `pause`, reconstrução da URL de reprodução ao reabrir.
- Autosave recusa gravar um projeto vazio por cima de um projeto com mídia.
- Mídia ausente: o clipe permanece; o usuário pode localizar o arquivo de novo.

## O que funciona no app

- Recentes: criar, abrir, renomear, duplicar, apagar projetos (armazenamento privado)
- Importar vídeo, imagem e áudio pelo seletor de documentos do sistema (SAF); o arquivo original não é apagado
- Edição na timeline: corte, divisão, clipes, texto, sobreposições, efeitos no **preview**
- Reprodução no aparelho
- Autosave; desinstalar o app apaga essa cópia
- Exportar MP4 com AndroidX Media3 Transformer **1.11.1**

## Limitação da exportação (inalterada)

A exportação Android grava **somente a faixa principal de vídeo**: corte, sequência, imagens paradas, velocidade e o áudio original desse vídeo.

**Não entram no MP4 do Android:** transições, sobreposições, títulos, chroma key, efeitos visuais do catálogo, cadeia de efeitos de voz nem a faixa de música separada. O preview pode mostrar mais do que o arquivo.

## Requisitos

- Android **7.0** (API 24) ou posterior
- `applicationId` `com.pixelcut.editor`
- `targetSdk` 36
- Internet só para as Google Fonts no preview de texto

## Atualizar da beta.1

1. **Não** desinstale. **Não** limpe os dados do aplicativo.
2. Instale `PixelCut-Android-0.1.0-beta.2.apk` por cima (`adb install -r` ou o instalador de APK).
3. Confira o SHA-256 `EA6CAA2EEEADA4C11B21B8CC253FAEEC20CAECF0AA91736E38ED527ACCB1D606`.
4. Abra um projeto antigo: o vídeo deve voltar à timeline.

Se a instalação for recusada com `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, existe um PixelCut assinado com **outra** chave (debug). Desinstalar nesse caso apaga os projetos privados.

Não instale `app-debug.apk`.

## Build local (ainda não publicado no GitHub)

| Campo | beta.2 (hotfix) | beta.1 (permanece disponível) |
|---|---|---|
| Staging | `%LOCALAPPDATA%\PixelCut\staging\PixelCut-Android-0.1.0-beta.2.apk` | `%LOCALAPPDATA%\PixelCut\staging\PixelCut-Android-0.1.0-beta.1.apk` |
| SHA-256 | `EA6CAA2EEEADA4C11B21B8CC253FAEEC20CAECF0AA91736E38ED527ACCB1D606` | `1FE4A4B01B212AB2E7D4BCA7AE73D72568E66DE5396E92FDE5707723BC054F18` |
| Tamanho | 6 533 933 bytes | 6 267 993 bytes |
| versionName / versionCode | `0.1.0-beta.2` / `2` | `0.1.0-beta.1` / `1` |
| Assinatura | v2, mesmo certificado | v2 |

**Teste no aparelho (29 de outubro de 2026):** a beta.2 foi instalada **por cima** da beta.1 num Galaxy A54 5G (SM-A546E, Android 16), sem desinstalar e sem limpar dados. `firstInstallTime` permaneceu `2026-10-29 13:12:44`. O projeto recente reabriu com o vídeo na faixa principal, reproduziu, e a exportação Media3 gerou `Movies/PixelCut/PixelCut-20261029-185604.mp4` (H.264 High 1280×720 + AAC-LC, 136,65 s). Relato: [ANDROID_DEVICE.md](ANDROID_DEVICE.md). Assinatura: [ANDROID_SIGNING.md](ANDROID_SIGNING.md).

## Segurança

- Mantenha o `.jks` de release e o `keystore.properties` fora do Git.
- O PixelCut Android **não** embarca FFmpeg. O Media3 é Apache-2.0 (veja `THIRD_PARTY_NOTICES.md`).
- O código original do editor é MIT, Copyright (c) 2026 Kaell Soares Calacina.

## Bugs

Issues no GitHub deste repositório, modelo “Bug”, plataforma Android. Inclua o SHA-256 do APK. Não anexe vídeos pessoais, keystores nem `.env`.

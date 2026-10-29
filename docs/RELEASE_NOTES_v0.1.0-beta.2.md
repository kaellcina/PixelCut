# PixelCut v0.1.0-beta.2 — hotfix Android (rascunho)

Hotfix só do Android. O Windows `v0.1.0-beta.1` permanece o instalador público atual.

**Não publicar automaticamente.** A tag e os anexos da `v0.1.0-beta.1` não devem ser alterados. Esta nota descreve o APK local; a GitHub Release desta hotfix só deve ser criada quando o titular autorizar.

## O que esta versão corrige

- Ícone do aplicativo no Android (tela inicial, lista de apps, configurações e recentes): o launcher Capacitor genérico foi trocado pelo ícone oficial do PixelCut (`assets/icon.png`).
- Persistência dos vídeos importados: ao importar, o PixelCut copia o arquivo para o armazenamento privado do app. Fechar o processo e abrir de novo restaura a timeline, a pré-visualização e a exportação Media3.
- O autosave não grava um projeto vazio por cima de um projeto com mídia.
- Se o arquivo sumir ou a URI do Android expirar, aparece um aviso para **localizar de novo**, sem apagar o clipe.

## O que não muda

- Windows (Electron + FFmpeg) não foi alterado nesta hotfix.
- FFmpeg, licenças e a keystore de release continuam os mesmos.
- A exportação Android ainda grava **somente a faixa principal**.

## Como atualizar (beta.1 → beta.2)

1. Não desinstale o PixelCut. Não limpe os dados do aplicativo.
2. Instale `PixelCut-Android-0.1.0-beta.2.apk` por cima da beta.1 (`versionCode` 2, mesma assinatura).
3. Os projetos já criados devem permanecer. Abra um projeto antigo e confira se o vídeo volta à timeline.
4. Se algum clipe aparecer como “mídia ausente”, toque em **Localizar** e escolha o arquivo de novo.

## Limitações conhecidas

- Exportação Android: só a faixa principal (corte, sequência, imagens, velocidade e o áudio original desse vídeo).
- Desinstalar o aplicativo apaga as cópias privadas dos vídeos importados.
- Arquivos muito grandes exigem espaço livre equivalente no armazenamento interno do PixelCut.
- URIs `content://` sem cópia privada (projetos antigos que não chegaram a importar) ainda precisam ser localizadas de novo.

## Arquivo

| Campo | Valor |
|---|---|
| APK | `PixelCut-Android-0.1.0-beta.2.apk` |
| versionName / versionCode | `0.1.0-beta.2` / `2` |
| SHA-256 | `EA6CAA2EEEADA4C11B21B8CC253FAEEC20CAECF0AA91736E38ED527ACCB1D606` |
| Tamanho | 6 533 933 bytes |
| Assinatura | APK Signature Scheme v2; mesmo certificado da beta.1 (`48e79a8f…`) |
| Staging | `%LOCALAPPDATA%\PixelCut\staging\PixelCut-Android-0.1.0-beta.2.apk` |
| Build | `PixelCut/android/app/build/outputs/apk/release/PixelCut-Android-0.1.0-beta.2.apk` |

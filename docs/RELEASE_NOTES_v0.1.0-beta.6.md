# PixelCut v0.1.0-beta.6

Tag proposta: `v0.1.0-beta.6`
Repositório: [github.com/kaellcina/PixelCut](https://github.com/kaellcina/PixelCut)

Publicação autorizada em 03/11/2026. As releases anteriores permanecem inalteradas.

Esta é uma beta pública gratuita. Guarde cópias da mídia e dos projetos. O PixelCut não tem ligação com o CapCut ou com a ByteDance.

## O que mudou

- **Corte no celular:** o botão de tesoura agora divide o clipe que está sob a agulha, mesmo quando outro item continuou selecionado.
- **Timeline por toque:** arrastar imediatamente sobre clipes e faixas desloca a timeline. Segurar por 360 ms antes de arrastar preserva o gesto de mover/reordenar o clipe; os handles de trim continuam imediatos.
- **Áudio Android:** volume do vídeo principal de 0% a 200%, faixas separadas de música/áudio, posição, trim, velocidade, volume e fades entram na exportação Media3.
- **Texto Android:** títulos bitmap com posição, tamanho, cor, estilos, famílias equivalentes, animações e digitação progressiva entram no MP4.
- **Sobreposição Android:** imagens entram no MP4 com posição, escala, opacidade, animação de entrada e zoom.
- **Efeitos Android:** brilho, contraste, saturação, blur e os presets P&B/noir, espelho, vivo, frio, glow, sonho, noite, teal, bleach e cartoon usam efeitos nativos Media3.
- **Zoom Android:** o zoom da faixa principal usa uma matriz GL por clipe com a curva da prévia.
- **Isolamento de teste:** builds debug usam `com.pixelcut.editor.debug`, evitando substituir ou ler projetos da versão pública assinada.

## Validação

- Build Vite, boot Electron, fluxo GUI e suíte completa de exportação Windows aprovados.
- Testes lógicos: editor 325, projetos 23, caminhos 50, persistência Android 56, estabilidade 66 e transições 44 verificações.
- Testes JVM Android, `assembleDebug` e `assembleRelease` aprovados.
- Samsung SM-A546E, Android 16/API 36: corte exato em `6,120635 s`, pan da timeline, texto, blur, música, imagem sobreposta e digitação progressiva confirmados.
- Quatro MP4s Media3 de 10 s inspecionados fora do app. O cenário final gerou H.264 1280×720/30 fps e AAC 48 kHz.

## Artefatos locais de pré-publicação

| Arquivo | Estado | SHA-256 | Bytes |
|---|---|---|---:|
| `PixelCut-Setup-0.1.0-beta.6.exe` | Windows x64, NSIS, sem Authenticode | `04D481008D32A6F885C6FD1D1A00D8E84576F904679A71272FC8800B1D9936CE` | 150.912.773 |
| `PixelCut-Android-0.1.0-beta.6.apk` | Android 7+, assinatura v2 oficial | `EC62FE34B69ABBA3574ED2E89B379119D27CD7CC6C0019EF5C70C6A40DAE280F` | 6.554.985 |
| `PixelCut-ffmpeg-n6.1.1-corresponding-source.zip` | Fontes correspondentes do FFmpeg/FFprobe | `27187E48A173F4096BDE53B2B9265C2C2703BA31F9DDD53F12B6BF27D1FB52F8` | 42.315.883 |

O APK foi alinhado e verificado pelo `apksigner`: esquema v2, pacote `com.pixelcut.editor`, `versionCode` 12 e o mesmo certificado SHA-256 `48e79a8f…` da beta.5. Nunca publique `app-debug.apk` nem o build técnico sem assinatura.

## Limitações Android conhecidas

- Sobreposições de vídeo ainda não entram no MP4.
- Chroma key, efeitos visuais sem equivalente Media3 e efeitos de voz continuam fora da exportação.
- As fontes Windows não são embarcadas; o Android usa famílias equivalentes do sistema.
- Presets de transição sem equivalente continuam saindo como dissolver.

## Atualização segura

- Pacote público: `com.pixelcut.editor`, `versionCode` 12, `versionName` `0.1.0-beta.6`.
- O APK público precisa usar o mesmo certificado das betas anteriores. Não gere outra keystore.
- Não desinstale a beta anterior nem limpe os dados para atualizar.
- A beta.5 e todas as releases anteriores permanecem inalteradas.

## Licenças

- Código original do PixelCut: MIT, Copyright (c) 2026 Kaell Soares Calacina.
- FFmpeg/FFprobe PixelCut n6.1.1 no Windows: GPL-2.0-or-later; os binários e fontes correspondentes não mudaram.
- AndroidX Media3: Apache-2.0; o APK Android não inclui FFmpeg.

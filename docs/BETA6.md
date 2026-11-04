# PixelCut v0.1.0-beta.6 — desenvolvimento

Esta é a árvore preparada para publicação da beta.6. O instalador Windows e o APK assinado estão prontos; tag, push e GitHub Release são feitos somente no fechamento da publicação autorizada.

## Implementado e validado por build/testes

- O botão de corte resolve o clipe divisível sob a agulha, mesmo quando a seleção móvel ficou em outro clipe.
- A timeline móvel pode ser deslocada com o dedo em áreas livres e sobre os clipes.
- No celular, arrastar imediatamente um clipe desloca a timeline; segurar por 360 ms antes de arrastar move/reordena o clipe. Os handles de trim continuam imediatos.
- O plano Android leva volume de 0% a 200% para o áudio principal e combina esse ganho com os crossfades.
- Faixas separadas de música/áudio entram como sequências de áudio do Media3, com posição, trim, velocidade, volume e fades.
- Textos entram como overlays bitmap no tempo global da composição, com posição, tamanho, cor, famílias Android equivalentes, negrito/itálico, estilos e animações, inclusive digitação progressiva.
- Sobreposições de imagem entram com posição, escala, opacidade, entrada e zoom. Sobreposições de vídeo continuam explicitamente omitidas.
- Ajustes de brilho, contraste, saturação e blur, além dos presets P&B/noir, espelho, vivo, frio, glow, sonho, noite, teal, bleach e cartoon, usam efeitos nativos do Media3. Presets sem equivalente continuam com aviso.
- O zoom da faixa principal usa uma matriz GL por clipe com a mesma curva smoothstep da prévia.

Validações executadas: build Vite, boot Electron, fluxo GUI, suíte de exportação Windows, build APK debug, testes JVM Android, testes lógicos do editor e ensaio em aparelho Samsung SM-A546E com Android 16 (API 36).

No aparelho real, uma variante isolada `com.pixelcut.editor.debug` foi instalada ao lado da beta.5 pública. O corte gerou os intervalos `0 → 6,120635 s` e `6,120635 → 10 s` exatamente sob a agulha. O gesto curto sobre o clipe deslocou a timeline, enquanto a pressão longa manteve o modo de mover/reordenar. Quatro exportações Media3 de 10 s foram concluídas: base, texto + blur, texto + blur + música e o cenário combinado com imagem sobreposta + digitação progressiva. Os MP4 resultantes foram H.264 1280×720/30 fps com AAC 48 kHz; quadros extraídos confirmaram imagem, texto, blur e a revelação `T` → `TÍT` → `TÍTULO`, permanecendo completa após a entrada. A análise de áudio confirmou a mistura dos tons de 440 Hz e 880 Hz com a música em 47%.

A validação em aparelho desta beta foi concluída no Samsung SM-A546E; não será exigida uma matriz adicional de modelos para a beta.6.

## Ainda pendente

- Fontes exatas do Windows não são embarcadas; a exportação Android usa famílias equivalentes do sistema.
- Sobreposições de vídeo e composição com mais decoders.
- Chroma key, efeitos visuais sem equivalente Media3 e efeitos de voz.
- Concluir commit, tag, push e publicação autorizados.

## Artefatos locais de pré-publicação

- Windows: `release/PixelCut-Setup-0.1.0-beta.6.exe`, 150.912.773 bytes, SHA-256 `04D481008D32A6F885C6FD1D1A00D8E84576F904679A71272FC8800B1D9936CE`, sem Authenticode conforme a política das betas.
- Android: `%LOCALAPPDATA%/PixelCut/staging/PixelCut-Android-0.1.0-beta.6.apk`, 6.554.985 bytes, SHA-256 `EC62FE34B69ABBA3574ED2E89B379119D27CD7CC6C0019EF5C70C6A40DAE280F`. Assinatura v2, certificado SHA-256 `48e79a8f…`, igual ao da beta.5.

## Segurança de atualização

- `applicationId`: `com.pixelcut.editor`
- `versionName`: `0.1.0-beta.6`
- `versionCode`: `12`
- A variante de teste local usa `applicationId` `com.pixelcut.editor.debug` e `versionName` `0.1.0-beta.6-debug`, portanto não substitui nem lê os projetos da beta.5 assinada.
- A chave de release não foi acessada nem alterada.
- Não gerar uma segunda keystore.

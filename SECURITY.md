# Segurança

## Beta atual (0.1.0-beta.6)

- O instalador Windows **não** tem assinatura Authenticode (`NotSigned`). O SmartScreen pode avisar. SHA-256 `04D481008D32A6F885C6FD1D1A00D8E84576F904679A71272FC8800B1D9936CE`.
- O APK Android de release é assinado v2 (SHA-256 `EC62FE34B69ABBA3574ED2E89B379119D27CD7CC6C0019EF5C70C6A40DAE280F`, `versionCode` 12, mesma chave `48e79a8f…`). O keystore **não** entra no Git (`%LOCALAPPDATA%\PixelCut\signing\`). Não faça commit de `keystore.properties`. Não distribua `app-debug.apk`.
- Não envie keystores, senhas, `.env` ou `google-services.json` para issues nem para este repositório.

## Como reportar

Descreva o impacto, a versão do app (e o SHA-256 do instalador ou do APK, se tiver) e os passos. Não anexe projetos com mídia pessoal.

Use as [GitHub Issues](https://github.com/kaellcina/PixelCut/issues) deste repositório. Quando existir um endereço dedicado de segurança, ele entra aqui.

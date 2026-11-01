# Segurança

## Beta atual (0.1.0-beta.5, ainda não publicada)

- O instalador Windows **não** tem assinatura Authenticode (`NotSigned`). O SmartScreen pode avisar. SHA-256 `DD83CCC767B29DF74E182E7C2235C2B6D297430057F268C1F2427EA66EACC537`.
- O APK Android de release é assinado v2 (SHA-256 `C6692D5F9B44586336CE4EDE383633DC1211CAE5ED8DBA8F22AA85E4DF7DFD0A`, `versionCode` 11, mesma chave `48e79a8f…`). O keystore **não** entra no Git (`%LOCALAPPDATA%\PixelCut\signing\`). Não faça commit de `keystore.properties`. Não distribua `app-debug.apk`.
- Não envie keystores, senhas, `.env` ou `google-services.json` para issues nem para este repositório.

## Como reportar

Descreva o impacto, a versão do app (e o SHA-256 do instalador ou do APK, se tiver) e os passos. Não anexe projetos com mídia pessoal.

Use as [GitHub Issues](https://github.com/kaellcina/PixelCut/issues) deste repositório. Quando existir um endereço dedicado de segurança, ele entra aqui.

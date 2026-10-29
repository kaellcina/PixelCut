# Segurança

## Beta atual (0.1.0-beta.1)

- O instalador Windows **não** tem assinatura Authenticode (`NotSigned`). O SmartScreen pode avisar. Essa é a distribuição Windows aprovada para esta beta gratuita.
- O APK Android de release é assinado v2 (SHA-256 `1FE4A4B0…`). O keystore **não** entra no Git (`%LOCALAPPDATA%\PixelCut\signing\`). Não faça commit de `keystore.properties`. Não distribua `app-debug.apk`.
- Não envie keystores, senhas, `.env` ou `google-services.json` para issues nem para este repositório.

## Como reportar

Descreva o impacto, a versão do app (e o SHA-256 do instalador ou do APK, se tiver) e os passos. Não anexe projetos com mídia pessoal.

Use as [GitHub Issues](https://github.com/kaellcina/PixelCut/issues) deste repositório. Quando existir um endereço dedicado de segurança, ele entra aqui.

# Segurança

## Beta atual (0.1.0-beta.5, ainda não publicada)

- O instalador Windows **não** tem assinatura Authenticode (`NotSigned`). O SmartScreen pode avisar. SHA-256 `CD7DCECB3B76B0F0644B1D50F019D9E8BF6ED47DBC6E2A624F6D6D114BB1D48C`.
- O APK Android de release é assinado v2 (SHA-256 `1381919E9A32EF20EDE26F76F81770C538F23358145BDC7A133618DE07F12DCB`, `versionCode` 11, mesma chave `48e79a8f…`). O keystore **não** entra no Git (`%LOCALAPPDATA%\PixelCut\signing\`). Não faça commit de `keystore.properties`. Não distribua `app-debug.apk`.
- Não envie keystores, senhas, `.env` ou `google-services.json` para issues nem para este repositório.

## Como reportar

Descreva o impacto, a versão do app (e o SHA-256 do instalador ou do APK, se tiver) e os passos. Não anexe projetos com mídia pessoal.

Use as [GitHub Issues](https://github.com/kaellcina/PixelCut/issues) deste repositório. Quando existir um endereço dedicado de segurança, ele entra aqui.

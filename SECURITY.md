# Segurança

## Beta atual (0.1.0-beta.4)

- O instalador Windows **não** tem assinatura Authenticode (`NotSigned`). O SmartScreen pode avisar. Essa é a distribuição Windows desta beta gratuita. SHA-256 `2A842E13DF1FEA905C454F49E31E1B6FC1CF4F5AC2AB8E0AC45D004A5C847C80`.
- O APK Android de release é assinado v2 (SHA-256 `CB2CD29323A40FD160694909C0F6D307DCAE4CF6D0CD75C0D1AAC8BF9DC7ADDB`). O keystore **não** entra no Git (`%LOCALAPPDATA%\PixelCut\signing\`). Não faça commit de `keystore.properties`. Não distribua `app-debug.apk`.
- Não envie keystores, senhas, `.env` ou `google-services.json` para issues nem para este repositório.

## Como reportar

Descreva o impacto, a versão do app (e o SHA-256 do instalador ou do APK, se tiver) e os passos. Não anexe projetos com mídia pessoal.

Use as [GitHub Issues](https://github.com/kaellcina/PixelCut/issues) deste repositório. Quando existir um endereço dedicado de segurança, ele entra aqui.

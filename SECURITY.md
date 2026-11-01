# Segurança

## Beta atual (0.1.0-beta.5, ainda não publicada)

- O instalador Windows **não** tem assinatura Authenticode (`NotSigned`). O SmartScreen pode avisar. SHA-256 `57923AE1ED3B0FF1AB5DD274948907ADE4CAF9C0E5F9A43A626A851DCDD681A1`.
- O APK Android de release é assinado v2 (SHA-256 `AE999F2D6AD412EDE6B65172AFF75822F8205B16F0B78B46E4CC9901112D74A3`, `versionCode` 10, mesma chave `48e79a8f…`). O keystore **não** entra no Git (`%LOCALAPPDATA%\PixelCut\signing\`). Não faça commit de `keystore.properties`. Não distribua `app-debug.apk`.
- Não envie keystores, senhas, `.env` ou `google-services.json` para issues nem para este repositório.

## Como reportar

Descreva o impacto, a versão do app (e o SHA-256 do instalador ou do APK, se tiver) e os passos. Não anexe projetos com mídia pessoal.

Use as [GitHub Issues](https://github.com/kaellcina/PixelCut/issues) deste repositório. Quando existir um endereço dedicado de segurança, ele entra aqui.

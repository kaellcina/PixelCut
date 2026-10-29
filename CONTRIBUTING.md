# Contribuir com o PixelCut

Obrigado por ajudar nesta beta pública.

## Regras básicas

- Mantenha Windows (Electron + FFmpeg) e Android (Capacitor + Media3) como dois motores. Não substitua um pelo outro.
- Não coloque no repositório APK de depuração, keystore, `.env` ou mídia de usuário.
- Não trate o `spawn` do FFmpeg como autorização para copiar código GPL para o editor, nem para abandonar o pacote de fontes correspondentes.
- Não reconstrua o FFmpeg a menos que a mudança seja sobre esse binário. O par enviado é o PixelCut n6.1.1 (`050577AF…` / `0BB9D300…`).

## Desenvolvimento (Windows)

```powershell
npm ci
npm start
```

Verificações úteis:

```powershell
npm run test:export
npm run test:electron
npm run test:gui
```

`PIXELCUT_USER_DATA` aponta o Electron para um perfil temporário. Não apague `%AppData%\PixelCut\projects` numa máquina de desenvolvimento.

## Pull requests

1. Abra um issue antes se a mudança envolver licença, FFmpeg ou o alcance da exportação Android.
2. Mantenha o diff focado.
3. Descreva como testou (comando + resultado).

## Licença das contribuições

Contribuições originais ao editor são oferecidas sob a licença MIT em [LICENSE](LICENSE), Copyright (c) 2026 Kaell Soares Calacina. FFmpeg/FFprobe continuam GPL-2.0-or-later e não são código MIT original do PixelCut.

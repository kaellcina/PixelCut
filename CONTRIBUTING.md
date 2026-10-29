# Contributing to PixelCut

Thank you for helping with this public beta.

## Ground rules

- Keep Windows Electron + FFmpeg and Android Capacitor + Media3 as two engines. Do not replace one with the other.
- Do not add a debug APK, keystore, `.env`, or user media to the repository.
- Do not treat `spawn` of FFmpeg as permission to copy GPL code into the editor, or to drop the corresponding-source package.
- Do not rebuild FFmpeg unless the change is about that binary. The shipped pair is PixelCut n6.1.1 (`050577AF…` / `0BB9D300…`).

## Development (Windows)

```powershell
npm ci
npm start
```

Useful checks:

```powershell
npm run test:export
npm run test:electron
npm run test:gui
```

`PIXELCUT_USER_DATA` points Electron at a throwaway profile. Do not delete `%AppData%\PixelCut\projects` on a developer machine.

## Pull requests

1. Open an issue first for license, FFmpeg, or Android export changes.
2. Keep diffs focused.
3. Describe how you tested (command + result).

## License of contributions

Original editor contributions are offered under the MIT License in [LICENSE](LICENSE), Copyright (c) 2026 Kaell Soares Calacina. FFmpeg/FFprobe stay GPL-2.0-or-later and are not original PixelCut MIT code.

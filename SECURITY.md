# Security

## Current beta (0.1.0-beta.1)

- The Windows installer is **not** Authenticode-signed (`NotSigned`). SmartScreen may warn. That is the approved Windows distribution for this free beta.
- The Android release APK is signed v2 (SHA-256 `1FE4A4B0…`). The keystore stays **off** Git (`%LOCALAPPDATA%\PixelCut\signing\`). Do not commit `keystore.properties`. Do not distribute `app-debug.apk`.
- Do not send keystores, passwords, `.env`, or `google-services.json` to issues or this repository.

## How to report

Describe the impact, the app version (and the installer or APK SHA-256 if you have it), and the steps. Do not attach projects that contain personal media.

Use GitHub Issues on this repository once it exists. When a dedicated security address exists, it goes here.

# Android release signing (PixelCut)

The public beta APK must **not** be signed with the Android debug key.

## First release key (local machine)

Created 29 October 2026 at:

`%LOCALAPPDATA%\PixelCut\signing\pixelcut-release.jks`

Alias: `pixelcut`. Certificate CN=Kaell Soares Calacina. Gradle reads
`android/keystore.properties` (gitignored). Do not commit the `.jks` or that
properties file. Do not paste passwords into git, LICENSE, or chat.

Do **not** generate a second release key unless you intend to change the
Android app identity (users would have to uninstall).

## Backup

Copy the entire folder `%LOCALAPPDATA%\PixelCut\signing\` (the `.jks` plus
`storepass.dpapi` and `README.txt`) to an encrypted USB stick or a password
manager vault. Also keep a private copy of `android/keystore.properties`.

If the `.jks` is lost, you cannot ship updates as the same `com.pixelcut.editor`
install. Play App Signing is not used for this GitHub sideload beta.

## Rebuild a signed APK

```powershell
npm run android:release
apksigner verify --verbose --print-certs android\app\build\outputs\apk\release\PixelCut-Android-0.1.0-beta.4.apk
```

## If you ever need a new keystore (do not do this for the current beta)

```text
keytool -genkeypair -v -keystore pixelcut-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias pixelcut
```

`keytool` will prompt for passwords. Then copy `keystore.properties.example`
to `android/keystore.properties` and fill it in locally.

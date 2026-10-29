# Manual publication — v0.1.0-beta.1

**Only after an explicit go-ahead from the rights holder.** This file does not create a remote, a tag, a push, or a GitHub Release.

The GitHub account owner is **not** in this tree. Replace `<owner>` with the real user or organization. The approved repository name is `PixelCut`.

The public git root is the **`PixelCut/` directory** (this folder: `package.json`, `LICENSE`, `src/`, `ffmpeg-corresponding-source/`). Do not nest a second `PixelCut/` inside the GitHub repo.

## 1. Create the public repository

In the GitHub UI: repository **PixelCut**, public, **without** a GitHub-generated README.

```powershell
# inside PixelCut/ (this directory)
git init
git add -A
git status
# Confirm none of: .env, keystore.properties, *.jks, *.apk, release/*.exe
git commit -m "Prepare PixelCut v0.1.0-beta.1 public beta."
git remote add origin https://github.com/<owner>/PixelCut.git
git push -u origin HEAD
```

Do not run those commands until authorized. Do not invent `<owner>`.

Do not commit `release/*.exe` or `*.apk` (already in `.gitignore`). Those files go **only** on the GitHub Release.

Corresponding source in git: `ffmpeg-corresponding-source/pixelcut-n6.1.1/` (tarballs, `build-all.sh`, hashes). The 42 MB zip is a Release asset, not a git object.

## 2. GitHub Release (UI — not the workflow)

1. Releases → Draft a new release.
2. Tag: `v0.1.0-beta.1` (create it in the UI; do not `git tag` and do not use the workflow).
3. Title: `PixelCut v0.1.0-beta.1`
4. Paste the English block from `docs/RELEASE_NOTES_v0.1.0-beta.1.md`.
5. Attach, after re-checking SHA-256:
   - `PixelCut/release/PixelCut-Setup-0.1.0-beta.1.exe`
   - `%LOCALAPPDATA%\PixelCut\staging\PixelCut-Android-0.1.0-beta.1.apk`
   - `PixelCut-distribuicao/third-party/ffmpeg/PixelCut-ffmpeg-n6.1.1-corresponding-source.zip`
6. Do **not** attach `app-debug.apk`, the unsigned APK, or Setup `0.1.0.exe` / `electron44` / `ownffmpeg`.
7. Publish the release.

Local verification before upload:

```powershell
Get-FileHash .\release\PixelCut-Setup-0.1.0-beta.1.exe -Algorithm SHA256
# expected: 9D3D4BC53C7851487EB345BD8AE6B88CC5062D098E586E88AE2AD33F3A86F49C
Get-FileHash "$env:LOCALAPPDATA\PixelCut\staging\PixelCut-Android-0.1.0-beta.1.apk" -Algorithm SHA256
# expected: 1FE4A4B01B212AB2E7D4BCA7AE73D72568E66DE5396E92FDE5707723BC054F18
Get-FileHash ..\PixelCut-distribuicao\third-party\ffmpeg\PixelCut-ffmpeg-n6.1.1-corresponding-source.zip -Algorithm SHA256
# expected: 27187E48A173F4096BDE53B2B9265C2C2703BA31F9DDD53F12B6BF27D1FB52F8
```

Attach the hygiened zip `27187E48…` (42 315 883 bytes). Previous `D581603E…` and `E06BD9FE…` files are local rollback only — do not upload them.

## 3. What not to do

- Do not set `publish_release` on `.github/workflows/release-windows.yml` for the first publication. That workflow is `workflow_dispatch` only and would still create a **draft** missing the APK and the FFmpeg zip.
- Do not `git tag` until the rights holder asks.
- Do not invent the GitHub URL if `<owner>` is still unknown.
- Do not generate a second Android keystore.

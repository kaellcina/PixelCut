# Creates the first PixelCut Android release keystore OUTSIDE git.
# Passwords are written only to gitignored / DPAPI files. Do not echo them.
$ErrorActionPreference = 'Stop'

$signDir = Join-Path $env:LOCALAPPDATA 'PixelCut\signing'
New-Item -ItemType Directory -Force -Path $signDir | Out-Null
$jks = Join-Path $signDir 'pixelcut-release.jks'
if (Test-Path $jks) {
    Write-Output 'EXISTING_RELEASE_KEYSTORE'
    Write-Output $jks
    exit 2
}

$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$bytes = New-Object byte[] 32
$rng.GetBytes($bytes)
$pass = -join ($bytes | ForEach-Object { '{0:x2}' -f $_ })

$keytoolCandidates = @('C:\Program Files\Java\jdk-21.0.12.1\bin\keytool.exe')
if ($env:JAVA_HOME) {
    $keytoolCandidates += Join-Path $env:JAVA_HOME 'bin\keytool.exe'
}
$keytool = $keytoolCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $keytool) { throw 'keytool.exe not found' }
$dname = 'CN=Kaell Soares Calacina, OU=PixelCut, O=PixelCut, C=BR'
& $keytool -genkeypair -keystore $jks -alias pixelcut -keyalg RSA -keysize 2048 -validity 10000 -storetype JKS -dname $dname -storepass $pass -keypass $pass -noprompt
if ($LASTEXITCODE -ne 0) { throw "keytool exit $LASTEXITCODE" }

$props = Join-Path $PSScriptRoot '..\android\keystore.properties'
$storeFile = $jks.Replace('\', '/')
$lines = @(
    "storeFile=$storeFile"
    "storePassword=$pass"
    "keyAlias=pixelcut"
    "keyPassword=$pass"
)
Set-Content -Path $props -Value $lines -Encoding ascii

$secure = ConvertTo-SecureString $pass -AsPlainText -Force
ConvertFrom-SecureString $secure | Set-Content -Path (Join-Path $signDir 'storepass.dpapi') -Encoding ascii

@'
PixelCut Android release signing material (local machine, not git).

Files:
  pixelcut-release.jks     the key (keep forever)
  storepass.dpapi          password encrypted for THIS Windows user

Also: PixelCut/android/keystore.properties (gitignored) for Gradle.

Backup: copy this entire folder to an encrypted USB / password manager vault.
If you lose the .jks, you cannot update the same Android app identity.
Do not commit these files. Do not share them in chat.
'@ | Set-Content -Path (Join-Path $signDir 'README.txt') -Encoding utf8

$pass = $null
$bytes = $null
Write-Output 'KEYSTORE_CREATED'
Write-Output $jks
Write-Output $props

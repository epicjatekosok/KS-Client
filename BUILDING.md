# Build KS Client for Windows

## Tools

| Tool | Tested build line | Use |
| --- | --- | --- |
| Windows x64 | Windows Server 2022 in CI | Build and run the Windows startup and installer tests |
| PowerShell | 7.x (`pwsh`) | Prepare Electron, build native executables, and run Windows tests |
| Go | 1.23.x | Build the launcher, uninstaller and offline installer. The Go modules declare 1.22 as their minimum. |
| Python | 3.12 | Icon generation, packaging and verification |
| Node.js | 22.x | JavaScript source tests |
| Electron | 45.3.2 x64 | Downloaded and SHA-256 verified by `ci/Prepare-Electron.ps1` |
| Windows SDK | SignTool, optional | Authenticode-sign developer or publisher builds |

Allow access to GitHub Releases, PyPI and the Playwright browser download host when preparing dependencies. The Electron app has no npm packages to install. The Go programs use the standard library and the included `ksui` module. Git and GitHub CLI are useful for maintainers and are optional for rebuilding the downloadable archive.

## Verify and extract the source

Download the project Source ZIP and accompanying `Source.sha256.txt` from the same [release](https://github.com/epicjatekosok/KS-Client-Updates/releases). In a directory with the downloads, run:

```powershell
$zip = 'KS-Client-beta-1.0.27-Source.zip'
$expected = ((Get-Content ($zip -replace '\.zip$', '.sha256.txt') -Raw).Trim() -split '\s+')[0]
if ((Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'Source checksum mismatch' }
Expand-Archive $zip -DestinationPath .\ks-client-source
Set-Location .\ks-client-source
```

Use a fresh extraction for each release and put build outputs in that working copy. The source archive contains committed source files, including the tests and build scripts. The ZIP comment records the source commit. Its SHA-256 is also in the release manifest.

## Build the Portable ZIP and Setup EXE

Use an x64 PowerShell 7 session in the extracted source root. The Windows smoke test writes a successful startup marker that the packager verifies against the exact Electron executable.

```powershell
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
python -m pip install Pillow
./ci/Prepare-Electron.ps1
./ci/Test-GameResolution.ps1
./ci/Test-Engines.ps1 -Engine Electron
./ci/Build-Native.ps1
./ci/Test-Updater.ps1
./ci/Test-Switching.ps1
python ci/package_offline.py
./ci/Build-Setup.ps1
python ci/verify_offline.py
./ci/Verify-Signing.ps1
```

The root contains `KS-Client-beta-1.0.27-Portable.zip` and `KS-Client-beta-1.0.27-Setup.exe`. The setup embeds the portable payload. For a manual smoke test, extract the portable build into a separate directory and launch `KS-Client.exe`. Use a disposable Windows account for installation and engine-migration tests that interact with the local profile. Setup works offline, though connecting to Kirka.io requires internet access.

## Run tests

```powershell
node --check electron-app/main.cjs
node tests/test_kirka_stats.cjs
node tests/test_packs_125.cjs
node tests/test_native_login_111.cjs
python ci/check_source.py
python tests/test_public_source_103.py
python tests/test_ci_release_gates.py
python -m pip install playwright
python -m playwright install chromium
python tests/test_kirka_stats_ui.py
python tests/test_workshop_125.py
python tests/test_overlay_112.py
Push-Location launcher
try { go test -timeout 5m -v . } finally { Pop-Location }
Push-Location installer
try { go test -timeout 20m -v . } finally { Pop-Location }
```

Run the installer Go tests after `package_offline.py` creates the embedded portable payload. The full release test list is in [the workflow](.github/workflows/windows-build.yml). Its Windows jobs check real Electron startup, WebGL render dimensions, legacy engine migration, offline installer extraction and in-place updates. Automated fixtures simulate Kirka pages for UI tests.

## Optional signing and maintainer releases

Local developer builds work unsigned. To use your own publisher certificate, provide `KS_SIGNING_PFX_BASE64` and `KS_SIGNING_PFX_PASSWORD` through a secure, temporary environment. Run `./ci/Sign-Release.ps1 -Stage native` immediately after `Build-Native.ps1`, before packaging, and `./ci/Sign-Release.ps1 -Stage setup` immediately after `Build-Setup.ps1`. Verify with `./ci/Verify-Signing.ps1`. SignTool uses a timestamp service, and the signing script deletes its temporary key file.

GitHub Actions packages and scans the exact checked-out commit before building from the extracted archive on Windows. Release credentials are supplied only to their respective workflow steps. A successful maintainer release supplies the source and binary downloads, SHA-256 checksums, a manifest, test results and the actual signing status. A local build may differ at the byte level due to ZIP metadata, tool patch versions and signatures. The public release checksums identify the original artifacts.

From an authorized maintainer checkout, `./ci/Package-Source.ps1` uses Git, Python and a pinned Gitleaks binary to verify and package the committed tree. The packager requires network access for the verified scanner download. The publication step is reserved for a successful build on the maintainer repository's main branch.

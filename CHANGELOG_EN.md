# KS Client alpha 1.1.9

- Supervised CEF ↔ Electron native engine switching with launcher-owned readiness, persisted selection only after native host confirmation and 45-second timeout.
- Engine readiness independent of Kirka.io network loads. Failed engine starts retain the previously selected browser and produce local logs.
- Direct '--engine electron' and '--engine cef' commands now wait for real native window acknowledgment.
- Windows CI starts actual native Electron and CEF windows and verifies switching in both directions using offline probes.
- Display native Chromium FPS launch switch status and estimated rAF callback frequency separately, without claiming measured GPU or Kirka.io render FPS.
- Preserve shared UI, graphics preferences, crosshair, Eye Comfort and existing offline installer behavior.

## Earlier changes
# KS Client alpha 1.1.9

- Add native engine identification, handshake retries and actionable switch status in Client > General.
- Prevent losing the current window when switching Electron/CEF: nonce-based new-engine acknowledgment and 20-second timeout.
- Update Unlimited FPS selection and a dedicated button to request experimental Chromium uncap flags and restart, while preserving user FPS settings.
- Add UI and Windows launcher tests for engine switching; retain the shared interface, crosshair, CSS and language settings.
- Chromium can still be capped by the game, the driver, VSync, compositor or monitor. CI does not claim to prove unlimited GPU FPS.

## Earlier releases
# KS Client alpha 1.1.9

- Fix CEF local dotnet.exe by bundling .NET 10 base and Windows Desktop runtimes together.
- Preserve Electron downloads without mandatory libEGL.dll.
- Detect CEF 0xC0000005 native failures and retain diagnostic logs.
- Require successful Windows process smoke tests for both engines before creating the offline installer.

## Prior changes
# KS Client — Alpha 1.1.9

## CEF compilation repair

- Corrected the C# host namespace collision (`KS.Cef.Client` versus `CefSharp.Cef`), which led to CS0246 and CS0234 errors at Program.cs lines 21, 38 and 46 in alpha 1.1.5.
- The CEF host now uses an unambiguous `KSClient.CefHost` namespace and explicit CefSharp type references.
- Added `--ks-self-test` mode to the CEF host to initialize and shut down the native runtime without starting the game.

## Install verification

- Electron and CEF installers now check required files and run a 30-second runtime-startup self-test BEFORE replacing the current runtime. Failed checks preserve the previous installed engine.
- Engine version markers force an upgrade when alpha 1.1.9 is installed over older builds.
- Added a standalone, non-destructive Windows verification script: `Verify-Installed.ps1`.
- Retained official Electron SHA-256 verification, CEF NuGet restore/build, PowerShell syntax checking and the installer's transaction-like file replacement.

## Unchanged

- CEF default, Electron alternative with restart-based engine selection.
- English-language setup, uninstaller and engine setup; KS Client appearance and previous game features.

## Validation boundary

The Go host programs can be cross-compiled on Linux, and JavaScript and packages checked offline. The full .NET/CefSharp Windows build, actual runtime downloads, and live Windows engine startup cannot be executed in this offline Linux environment, so successful Windows installation is not yet independently verified. The new installer performs runtime tests on the target PC.

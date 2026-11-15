# KS Client alpha 1.1.13

- Added shared scene-aware Kirka.io integration core for CEF and Electron, with read-only HUD augmentation and pointer-lock logging.
- Added validated drag-and-drop Quick Join and conditional Spectate button for available Kirka.io friend room links.
- Extended Workshop lobby presets to save visible map, mode and weapon checkbox selections.
- Added passive early WebGL observation as preparation for future cosmetic rendering, without changing game draw calls.
- Added CEF browser-focus improvements and new cross-engine integration regression tests.
- Both Windows runtimes, offline Setup.exe and Portable.zip must pass gated CI verification; live Kirka.io and CEF gameplay input still need manual testing.

# KS Client alpha 1.1.12

- Add separate local Workshop menu: weapon preview coloring and Custom Skin Link, saved presets, lobby form/room presets, local player notes and inventory favorites with manual market estimates.
- Add opt-in exact-path image/audio/CSS resource replacement for Electron and CEF; no game scripts or authentication traffic intercepted.
- Add manual opt-in JavaScript plugins running in sandboxed preview frames, with narrowly scoped cosmetic message/tint API only; no raw game scripting.
- Extend existing HTML-based HUD with visible killfeed team colorization, assist/headshot detection when Kirka exposes matching HTML, adjustable keystroke layout and optional HTML hitmarker images.
- All features work locally and do not modify Kirka.io server data or prices. 3D WebGL weapon texture swaps require a separate compatibility patch and are not verified in this build.

## Previous releases
# KS Client alpha 1.1.12

- Add native Electron and CEF permission handling for Kirka.io pointer lock.
- Optional trusted user-click mouse lock on an actual game canvas, with ESC release and hidden settings button during active gameplay.
- Add a shared game-extras.js module: read-only HTML gameplay stats, WASD/Space/Shift overlay and optional CSS-only HTML hitmarker customization.
- Add validated room URL quick-join and screenshot saving to Pictures/KSClient in both engines (CEF captures the visible screen area).
- Add a Game Integration settings section and automated menu/source checks.

Not in this release: arbitrary remote JavaScript plugin execution, WebGL weapon/skin hacking, Discord RPC and self-updating setup. These require separate audited implementations.
HTML game integrations depend on Kirka.io DOM selectors and may require updating.

## Previous releases
# KS Client alpha 1.1.12

- Repair CEF to Electron switch when CefSharp.PostMessage cannot deliver a native response.
- Add a native CEF navigation-intercept fallback from the same trusted Kirka.io origin.
- Add a real Windows CEF renderer-to-native JavaScript message integration test.
- Replace indefinitely stuck switch request UI with actionable fallback and timeout feedback.
- Keep the 1.1.9 native launcher verification, FPS diagnostics, full Electron/CEF offline package and previous settings.

## Earlier changes
# KS Client alpha 1.1.12

- Supervised CEF ↔ Electron native engine switching with launcher-owned readiness, persisted selection only after native host confirmation and 45-second timeout.
- Engine readiness independent of Kirka.io network loads. Failed engine starts retain the previously selected browser and produce local logs.
- Direct '--engine electron' and '--engine cef' commands now wait for real native window acknowledgment.
- Windows CI starts actual native Electron and CEF windows and verifies switching in both directions using offline probes.
- Display native Chromium FPS launch switch status and estimated rAF callback frequency separately, without claiming measured GPU or Kirka.io render FPS.
- Preserve shared UI, graphics preferences, crosshair, Eye Comfort and existing offline installer behavior.

## Earlier changes
# KS Client alpha 1.1.12

- Add native engine identification, handshake retries and actionable switch status in Client > General.
- Prevent losing the current window when switching Electron/CEF: nonce-based new-engine acknowledgment and 20-second timeout.
- Update Unlimited FPS selection and a dedicated button to request experimental Chromium uncap flags and restart, while preserving user FPS settings.
- Add UI and Windows launcher tests for engine switching; retain the shared interface, crosshair, CSS and language settings.
- Chromium can still be capped by the game, the driver, VSync, compositor or monitor. CI does not claim to prove unlimited GPU FPS.

## Earlier releases
# KS Client alpha 1.1.12

- Fix CEF local dotnet.exe by bundling .NET 10 base and Windows Desktop runtimes together.
- Preserve Electron downloads without mandatory libEGL.dll.
- Detect CEF 0xC0000005 native failures and retain diagnostic logs.
- Require successful Windows process smoke tests for both engines before creating the offline installer.

## Prior changes
# KS Client — Alpha 1.1.12

## CEF compilation repair

- Corrected the C# host namespace collision (`KS.Cef.Client` versus `CefSharp.Cef`), which led to CS0246 and CS0234 errors at Program.cs lines 21, 38 and 46 in alpha 1.1.5.
- The CEF host now uses an unambiguous `KSClient.CefHost` namespace and explicit CefSharp type references.
- Added `--ks-self-test` mode to the CEF host to initialize and shut down the native runtime without starting the game.

## Install verification

- Electron and CEF installers now check required files and run a 30-second runtime-startup self-test BEFORE replacing the current runtime. Failed checks preserve the previous installed engine.
- Engine version markers force an upgrade when alpha 1.1.12 is installed over older builds.
- Added a standalone, non-destructive Windows verification script: `Verify-Installed.ps1`.
- Retained official Electron SHA-256 verification, CEF NuGet restore/build, PowerShell syntax checking and the installer's transaction-like file replacement.

## Unchanged

- CEF default, Electron alternative with restart-based engine selection.
- English-language setup, uninstaller and engine setup; KS Client appearance and previous game features.

## Validation boundary

The Go host programs can be cross-compiled on Linux, and JavaScript and packages checked offline. The full .NET/CefSharp Windows build, actual runtime downloads, and live Windows engine startup cannot be executed in this offline Linux environment, so successful Windows installation is not yet independently verified. The new installer performs runtime tests on the target PC.

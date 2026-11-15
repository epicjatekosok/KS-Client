# KS Client - Windows-verified CI source (alpha 1.1.9 codebase)

This is NOT a finished, verified release and does not include Electron/CEF binaries.

Use the GitHub Actions workflow `.github/workflows/windows-build.yml` to build and smoke-test **both** engines on real Windows CI runners. A complete offline installer candidate is generated ONLY if the Electron, CEF, UI and offline packaging tests all succeed.

To get started, see **START_HERE_HU.md**.

The Windows CI candidate bundles the official SHA256-verified Electron runtime, the compiled CefSharp app, and an app-local .NET 10 Windows Desktop runtime. It doesn't compile CEF or download engines on the end user's machine.

The Windows CI smoke tests initialize the engines and exercise installer file extraction/upgrade logic; they do not establish Kirka.io game compatibility, FPS unlock, successful installer GUI interaction or clean-machine uninstall reliability. Additional manual QA is required before a public release.


## Alpha 1.1.9 offline release
GitHub Actions builds both Electron and CEF with app-local .NET 10 runtimes. Only successful Windows engine startup tests allow generating the offline Setup.exe. CEF GPU rendering in gameplay requires separate testing.


## Alpha 1.1.9 improvements
- Engine identity now has a preload/CEF fallback and a retry handshake; no permanent Loading label.
- Switching engines waits for a startup confirmation before closing the current engine; failures leave it running with an error.
- Performance > Activate Unlimited FPS enables the experimental browser startup switches and requests a restart. Actual Kirka.io FPS above the monitor refresh rate is NOT guaranteed by Chromium flags.


## Alpha 1.1.9: verified native engine switching
When changing engines, KS-Client.exe supervises the requested runtime until its native window is visible. It commits the selected engine only after an authenticated local nonce acknowledgement. Game page loading is a separate state. An unsuccessful switch leaves the old engine active with local logs.

The Windows CI now tests two native switching directions: CEF->Electron and Electron->CEF. The test is offline and does not constitute a live Kirka.io integration test.

## FPS diagnostics
Gameplay > Performance and Gameplay > Frame Stability distinguish Chromium startup requests from observed browser requestAnimationFrame callback rate. Both experimental Chromium switches can be requested, but that is NOT proof of actual Kirka.io GPU or in-game FPS exceeding monitor refresh. Read Kirka.io's native game HUD for game-side measurements.

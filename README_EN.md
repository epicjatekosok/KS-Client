# KS Client - Windows-verified CI source (alpha 1.1.12 codebase)

This is NOT a finished, verified release and does not include Electron/CEF binaries.

Use the GitHub Actions workflow `.github/workflows/windows-build.yml` to build and smoke-test **both** engines on real Windows CI runners. A complete offline installer candidate is generated ONLY if the Electron, CEF, UI and offline packaging tests all succeed.

To get started, see **START_HERE_HU.md**.

The Windows CI candidate bundles the official SHA256-verified Electron runtime, the compiled CefSharp app, and an app-local .NET 10 Windows Desktop runtime. It doesn't compile CEF or download engines on the end user's machine.

The Windows CI smoke tests initialize the engines and exercise installer file extraction/upgrade logic; they do not establish Kirka.io game compatibility, FPS unlock, successful installer GUI interaction or clean-machine uninstall reliability. Additional manual QA is required before a public release.


## Alpha 1.1.12 offline release
GitHub Actions builds both Electron and CEF with app-local .NET 10 runtimes. Only successful Windows engine startup tests allow generating the offline Setup.exe. CEF GPU rendering in gameplay requires separate testing.


## Alpha 1.1.12 improvements
- Engine identity now has a preload/CEF fallback and a retry handshake; no permanent Loading label.
- Switching engines waits for a startup confirmation before closing the current engine; failures leave it running with an error.
- Performance > Activate Unlimited FPS enables the experimental browser startup switches and requests a restart. Actual Kirka.io FPS above the monitor refresh rate is NOT guaranteed by Chromium flags.


## Alpha 1.1.12: verified native engine switching
When changing engines, KS-Client.exe supervises the requested runtime until its native window is visible. It commits the selected engine only after an authenticated local nonce acknowledgement. Game page loading is a separate state. An unsuccessful switch leaves the old engine active with local logs.

The Windows CI now tests two native switching directions: CEF->Electron and Electron->CEF. The test is offline and does not constitute a live Kirka.io integration test.

## FPS diagnostics
Gameplay > Performance and Gameplay > Frame Stability distinguish Chromium startup requests from observed browser requestAnimationFrame callback rate. Both experimental Chromium switches can be requested, but that is NOT proof of actual Kirka.io GPU or in-game FPS exceeding monitor refresh. Read Kirka.io's native game HUD for game-side measurements.


## Alpha 1.1.12: real CEF bridge checks
Windows CI now exercises CefSharp's actual JavascriptMessageReceived event in a renderer (offline HTML), not only process readiness. The CEF->Electron menu command has a same-origin intercepted navigation fallback if PostMessage does not acknowledge. Startup and actual in-game FPS remain separate verification requirements.


## Alpha 1.1.12 - Input and game integration
Clicking the game canvas may request native browser pointer lock (real user gesture required). ESC releases the pointer. Gameplay > Game Integration adds opt-in keystrokes, read-only HTML game stats, visual hitmarker CSS, quick join to validated Kirka.io room links and screenshots saved to Pictures/KSClient. CEF captures the visible browser rectangle and can capture other windows if they overlap. This is not a game automation/cheat module.

Known limits: Kirka.io can change DOM selectors; gameplay pointer lock is only verified by a real Windows gameplay test. No arbitrary user JS, WebGL skins, native auto-updater or Discord RPC yet.


## Alpha 1.1.12 Workshop
Weapon Studio provides local HTML weapon/inventory cosmetic previews (hue, brightness, saturation, Custom Skin Link and saved presets). Resource Swapper replaces only exact paths under `https://kirka.io/assets/{img,media,css}/...` with locally permitted image/audio/CSS files and is disabled by default. Put approved, owned assets at `Documents/KSClient/Swapper/assets/...`, enable and reload the game. Other network requests are untouched. JavaScript plugins manually run in a sandboxed, opaque preview, with a whitelisted cosmetic API. The browser and game logic, private cookies and arbitrary filesystem are not exposed. Room presets, profiles and inventory notes are local; no real trades or prices are requested. True in-game 3D WebGL skins, automated friend spectating and complete multiplayer game-state integration remain unverified, not advertised as working.

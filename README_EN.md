# KS Client - Windows-verified CI source (alpha 1.1.8 codebase)

This is NOT a finished, verified release and does not include Electron/CEF binaries.

Use the GitHub Actions workflow `.github/workflows/windows-build.yml` to build and smoke-test **both** engines on real Windows CI runners. A complete offline installer candidate is generated ONLY if the Electron, CEF, UI and offline packaging tests all succeed.

To get started, see **START_HERE_HU.md**.

The Windows CI candidate bundles the official SHA256-verified Electron runtime, the compiled CefSharp app, and an app-local .NET 10 Windows Desktop runtime. It doesn't compile CEF or download engines on the end user's machine.

The Windows CI smoke tests initialize the engines and exercise installer file extraction/upgrade logic; they do not establish Kirka.io game compatibility, FPS unlock, successful installer GUI interaction or clean-machine uninstall reliability. Additional manual QA is required before a public release.


## Alpha 1.1.8 offline release
GitHub Actions builds both Electron and CEF with app-local .NET 10 runtimes. Only successful Windows engine startup tests allow generating the offline Setup.exe. CEF GPU rendering in gameplay requires separate testing.


## Alpha 1.1.8 improvements
- Engine identity now has a preload/CEF fallback and a retry handshake; no permanent Loading label.
- Switching engines waits for a startup confirmation before closing the current engine; failures leave it running with an error.
- Performance > Activate Unlimited FPS enables the experimental browser startup switches and requests a restart. Actual Kirka.io FPS above the monitor refresh rate is NOT guaranteed by Chromium flags.

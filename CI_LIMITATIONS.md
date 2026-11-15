# CI quality gate scope

**Never publish as a production-ready setup based only on the local cross-compile.**

Current readiness state: **GitHub Actions pipeline created; full hosted Windows run NOT YET EXECUTED.**

Gates: shared overlay test in headless Chromium; JS syntax; Electron official SHA-256; Electron `--ks-self-test`; CefSharp .NET 10 x64 publish and app-local Windows Desktop runtime; CefSharp `--ks-self-test`; both smoke tests repeated after GitHub artifact transfer; offline installer extraction and in-place copy test; build of offline setup; CRC and PE checks. Final artifact is gated by all previous jobs.

Important gaps: these engine startup self-tests do not load the online Kirka.io game nor verify GPU rendering, gameplay FPS, actual installer GUI clicks, Windows Installed Apps registration, or removal via the uninstaller. The package requires follow-up QA on a clean Windows computer. A successful CI artifact is a candidate, not a claim of fully working release.

System prerequisites like the Windows MSVC runtime may still need verification on a clean, non-developer Windows installation. A custom Go uninstaller self-copies to a temporary path; its GUI logic is not automatically tested here.

Version: alpha 1.1.9 source baseline. Do not republish old alpha 1.1.9 binaries under new CI results. Increment version only after release verification.


Alpha 1.1.9: CI-only CEF GPU fallback verifies runtime initialization but does not prove real Kirka.io GPU/FPS performance on all machines.


Alpha 1.1.9 also tests the engine-switch UI and native switch token handling in CI. It does not measure Kirka.io FPS above the monitor refresh or test a full real-game engine change on every PC.


Alpha 1.1.9 adds a Windows native-window switch integration test in both directions. These offline probes ensure each engine opens a native window, acknowledges the launcher, and commits the selection. They do not simulate Kirka.io network login, actual gameplay rendering, GPU driver behavior, a monitor refresh rate change, nor end-user installation GUI.

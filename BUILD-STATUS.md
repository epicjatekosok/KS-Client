# Build status

Status: **SOURCE-ONLY WINDOWS CI PREPARATION** (NOT a successful Windows CI build).

Local checks: JS syntax, UI browser test 1280x720 / 1600x900 / 2560x1440, Windows Go cross-compiles, YAML parse, ZIP content. Not run: real Windows Electron/CEF build & startup tests, GUI setup, uninstall, Kirka.io gameplay, FPS unlock.

The GitHub workflow will either generate a gated offline installer candidate after all engine tests pass, or stop and retain diagnostic logs. It has not yet been run on an actual Windows GitHub Actions runner.


Alpha 1.1.12: The Setup.exe is considered a release candidate only if both Windows engine tests pass and their executable hashes match their generated verification markers.


Alpha 1.1.12 adds browser-state handshake and switch-confirmation tests. The experimental FPS unlock requests Chromium launch flags, but any claim of actual >monitor-Hz gameplay requires manual Windows Kirka.io testing.


Alpha 1.1.12 release gate: Windows must run both engine self-tests AND two native-window switch probes before packaging. Native Chromium launch flag status is reported honestly; >monitor-Hz Kirka.io FPS is not asserted without an actual gameplay benchmark.


Alpha 1.1.12 gates: CEF renderer-to-C# bridge smoke test in Windows CI, engine startup in both directions, verified installer and update tests. The real user-clicked CEF->Electron path and Kirka.io FPS on end-user systems still require a manual smoke test.


Alpha 1.1.12: Adds browser-side mouse capture and optional game integration source/UI checks. Windows CI does not verify live Kirka.io pointer lock on the user's computer.

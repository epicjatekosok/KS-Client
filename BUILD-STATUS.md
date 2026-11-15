# Build status

Status: **SOURCE-ONLY WINDOWS CI PREPARATION** (NOT a successful Windows CI build).

Local checks: JS syntax, UI browser test 1280x720 / 1600x900 / 2560x1440, Windows Go cross-compiles, YAML parse, ZIP content. Not run: real Windows Electron/CEF build & startup tests, GUI setup, uninstall, Kirka.io gameplay, FPS unlock.

The GitHub workflow will either generate a gated offline installer candidate after all engine tests pass, or stop and retain diagnostic logs. It has not yet been run on an actual Windows GitHub Actions runner.


Alpha 1.1.9: The Setup.exe is considered a release candidate only if both Windows engine tests pass and their executable hashes match their generated verification markers.


Alpha 1.1.9 adds browser-state handshake and switch-confirmation tests. The experimental FPS unlock requests Chromium launch flags, but any claim of actual >monitor-Hz gameplay requires manual Windows Kirka.io testing.


Alpha 1.1.9 release gate: Windows must run both engine self-tests AND two native-window switch probes before packaging. Native Chromium launch flag status is reported honestly; >monitor-Hz Kirka.io FPS is not asserted without an actual gameplay benchmark.

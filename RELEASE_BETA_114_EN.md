# KS Client Beta 1.0.14 — FPS caps, CEF fullscreen, Discord status and Settings languages

## Changes
- **Discord status:** The client-owned "Opening KS Discord" message always disappears on a bounded timer, even if CEF's native same-origin link command has no asynchronous browser reply. Existing external browser opening is retained.
- **CEF fullscreen:** Borderless fullscreen can be toggled via a protected native same-origin command, WinForms UI-thread dispatch and an F11 handler for Chromium's focused child window. The previous window borders, bounds and always-on-top state are restored on exit. Electron's existing F11/fullscreen implementation remains unchanged.
- **FPS controls:** Added 200, 240, 300 and 360 FPS alongside 60/120/144/165/180 and Unlimited/Native. Fixed caps pace main-thread requestAnimationFrame callbacks and select non-unlimited Chromium startup mode. **Restart KS Client after switching from experimental unlimited FPS to a fixed cap** so previously enabled Chromium frame-rate/VSync bypass flags are removed. True game/GPU FPS and power savings depend on Kirka.io, hardware and driver behavior; the browser callback limiter is not a GPU driver limit.
- **Settings GPU overhead:** Replace the expensive full-screen blur over the running game with a lightweight opaque overlay. Reduce graph canvas pixel density and unnecessary 60–2500 Hz client FPS-observer callbacks when other Settings pages are open. Graph updates remain available on Performance and Frame Stability tabs.
- **Settings translations:** Add German, French, Spanish, Portuguese, Italian, Russian, Simplified Chinese and Japanese alongside English and Hungarian. Main menus, commonly used labels and controls are translated; advanced uncommon technical descriptions fall back to English. **The Windows installer and uninstaller remain English only.**
- **Version:** The launcher, Electron, CEF, native installer, UI, release scripts, manifest, and self-tests are all versioned Beta 1.0.14.

## Preservation
All previous Electron and CEF engines, Kirka native authentication paths, Workshop Experimental, resource swapping, account profiles, stored preferences, crosshairs, UI themes and verified manual/automatic update checks remain present. Earlier public GitHub Releases are not overwritten.

## Verification limits
GitHub Actions verifies JS syntax, regression tests, Electron/CEF native startup, engine switching, CEF JavaScript bridge, offline packaging and SHA-256 checks. Actual Kirka.io gameplay FPS, Windows GPU-utilization changes, CEF F11/fullscreen inside a real match and external-browser behavior on every PC require user testing.

## Install
Standalone Windows Setup EXE or Portable ZIP: https://github.com/epicjatekosok/KS-Client-Updates/releases/tag/v1.0.14-beta

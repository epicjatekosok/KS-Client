# KS Client Beta 1.0.13 — Correct version labels and CEF reliability

## Fixes requested by players

- **Current version labels:** The Updates screen incorrectly displayed Beta 1.0.5 and the Settings sidebar displayed Beta 1.0.9 even in Beta 1.0.12. Both labels now use one build-defined Beta 1.0.13 value. The smaller HUD badge and settings-export filename also display the correct new version. Historic release entries are preserved.
- **CEF IBrowser null crash:** Avoid sending JavaScript to a CEF browser or frame before initialization or after disposal. CefSharp calls are centralized through a defensive RunJS helper which checks browser readiness, validates the main frame and catches teardown races instead of raising a Windows unhandled-exception dialog.
- **CEF Discord and manual Releases:** The two KS-owned external actions no longer depend on an often-dropped CefSharp.PostMessage during Kirka single-page navigation. CEF now handles reserved same-origin internal commands before any browser navigation; native Windows launches the *constant* KS Discord invite and KS-Client-Updates GitHub Releases URL in the default browser. No website-supplied URL is forwarded to the OS.
- **Engine selection guidance:** The Settings engine picker explains that CEF may provide higher FPS but be less stable; Electron tends to favor stability even if the FPS is lower. Actual performance varies by system and game.
- **Electron untouched for gameplay/authentication:** Existing working Electron Google/email login, Chromium popups, and shell.openExternal handling remain as in Beta 1.0.12. Both browser engines, mouse capture, HUD, Workshop Experimental, custom settings, updater and offline installation remain supported.

## Validation

Source/Chromium-click regressions and Windows-native dual-engine startup, CEF JavaScript bridge, game-engine switching, updater, setup extraction and SHA-256 verification run before publication. These automated checks cannot substitute for reproducing the player's real long-session CEF game navigation or account credentials; report any remaining runtime issues with cef-1.0.13.log, never an account token.

## Installation

This is a new standalone Beta 1.0.13 release, not a patch to old installers. The Setup EXE and Portable ZIP contain Electron, CEF, the bundled .NET runtime and the updater. Beta 1.0.9 through 1.0.12 releases remain available unchanged in public GitHub releases. The public KS-Client-Updates repository receives binaries and checksum/manifest documents, not the private source archive.

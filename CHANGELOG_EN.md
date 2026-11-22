# KS Client Beta 1.0.25

## Beta 1.0.26

KirkaStats now opens inside the game. Search any public player ID, or look up names from the leaderboard and clans you have viewed. Open clan standings to inspect scores, members and their profiles. Player profiles include K/D, win percentage, ratings, equipped skins and a public inventory with estimated values and pricing coverage.

The market compares trader estimates, historical lows and highs, supply and recent price changes. Look up an item from its inventory or trade entry. The server view counts players in listed matches and flags unavailable regions. If all live regions are unavailable, a separately dated regional sample may be shown.

Open KirkaStats from Settings or a supported game menu. Only the visible view refreshes. All integrations are read-only and use public data.


[Workshop integrations and frame pacing](RELEASE_BETA_125_EN.md)

# KS Client Beta 1.0.24

[Pinned language picker and translations](RELEASE_BETA_124_EN.md)

# KS Client Beta 1.0.23

[Display languages and FPS restart guidance](RELEASE_BETA_123_EN.md)

# KS Client Beta 1.0.22

[Graphics profiles, render resolution and crosshair](RELEASE_BETA_122_EN.md)

# KS Client Beta 1.0.21

[Electron migration and edge smoothing](RELEASE_BETA_121_EN.md)

# KS Client Beta 1.0.20

[Frame pacing, measured averages and crosshair alignment](RELEASE_BETA_120_EN.md)

# KS Client Beta 1.0.19

[Game-loop and comfort improvements](RELEASE_BETA_119_EN.md)

# KS Client Beta 1.0.18

[Fixed frame pacing and menu power controls](RELEASE_BETA_118_EN.md)

# KS Client Beta 1.0.17

[Native Friends and Servers search and an optional F2 screenshot shortcut](RELEASE_BETA_117_EN.md)

# KS Client Beta 1.0.16

Portable Workshop profiles with media, custom callback caps, browser-surface CEF capture, live visible lists, asset discovery and optional desktop Discord activity.

# KS Client Beta 1.0.15

[Shared game integration and frame pacing](RELEASE_BETA_115_EN.md)

# KS Client Beta 1.0.14

- Fixed CEF fullscreen, Discord status timeout, FPS fixed caps up to 360 and uncapped native Chromium restart handling.
- Reduced Settings GPU overhead; added 8 Settings-only languages while keeping Setup/Uninstaller English.
- Preserved all older functions, profiles, settings and release history.

---

# KS Client Beta 1.0.0

- Promote product from Alpha 1.1.23 to Beta 1.0.0, with consistent Windows launcher, Electron and CEF version metadata.
- Unify the FPS HUD, Keystrokes, game stats, break reminder and Settings X button with the existing black/amber game controls.
- Label Workshop features Experimental, including an in-section caution note.
- Enable real public GitHub Beta release checks, verified automatic pre-download, manual install/restart and public manual download page.
- Preserve previous user preferences and profiles, including the legacy local settings key.
- Publish SHA256-verified Beta binaries publicly and include a one-time Alpha 1.1.23 compatibility bridge for the existing old updater.
- Keep all prior feature modules, Electron, CEF and native Windows installer/uninstaller.

---

# KS Client alpha 1.1.23

- Fix Electron main-process ReferenceError in the fixed KS Discord link handler; guard IPC messages from uncaught exceptions and report failures.
- Match the Settings gear design exactly to the KS Discord quick button, sharing background, border, rounded corners, shadow, hover and press effects.
- Animate Settings opening, content/tab changes, preset cards, switches, sliders, dropdowns and buttons. Respect system and in-app reduced-motion settings.
- Clarify that a separate public binary-only update repository and a publisher-side secret are prerequisites for anonymous auto-updates; add detailed setup documentation and verify public release assets.
- Preserve Electron/CEF, Workshop, FPS controls, game integrations, existing settings and dual-engine packaged Windows releases.

---

# KS Client alpha 1.1.22

- Full black/orange gamer-style Settings dashboard, with reference-matched header, sidebar, glowing active navigation and bottom action bar.
- Reorganize all existing settings into seven coherent categories without removing features.
- Add visual Low/Medium/High performance preset cards and logical option groupings.
- Add native Windows default-browser opening of the fixed KS Discord invite, including popup/navigation fallbacks and a direct launcher button.
- Prevent CefSharp disposed-IFrame crashes on asynchronous WinForms bridge callbacks and frame-load navigation races.
- Preserve local preferences, Workshop data, FPS features, dual-engine switch, updater and verified ZIP/EXE packaging.

---

# KS Client alpha 1.1.21

- Fix Settings becoming unopenable due to incomplete native diagnostics samples; the dialog stays operable on rendering errors.
- Provide actual Electron and CEF host/subprocess CPU, RAM and process counters, with graceful missing-value handling.
- Default fresh installations to Electron, preserving an explicitly saved CEF preference.
- Remove nonfunctional Hitmarker, Colored Killfeed, image/color/size options and obsolete CSS modifications; keep all other gameplay extras.
- Add bounded update checks, clear public-feed diagnostics, and native Open GitHub Releases manual fallback.
- Preserve all unaffected client options and ship a complete dual-engine Windows Portable ZIP and Setup EXE after verification.

---

# KS Client alpha 1.1.20

- Refresh settings with calmer colors, readable hierarchy, more consistent spacing, accessibility-focused keyboard outlines, and responsive navigation.
- Add a searchable section index across all existing settings groups without removing options or overwriting saved settings.
- Shrink and soften the lower-left version label to KS · 1.1.20.
- Direct Kirka.io Discord-button clicks to https://discord.gg/cxP386yGjk through each browser engine's trusted native external-link handling.
- Retain dual-engine integration, workshop, HUD, user preferences, and native 1.1.19 update support.
- Bump the complete verified offline Windows ZIP and Setup EXE release pipeline to 1.1.20.

---

# KS Client alpha 1.1.19

- New Client > Updates tab with manual update checking and optional automatic checking/background downloading.
- Unified Windows launcher update helper for Electron and CEF; verifies pinned GitHub release URLs, size and SHA-256 before installing.
- User-approved install from the existing offline Setup.exe; portable folders upgrade in place with preserved user profiles.
- Optional public binary-only GitHub release channel, with private source repository retained.
- Existing 1.1.18 functionality, FPS defaults, settings button, and Kirka HUD fixes preserved.

---

# KS Client alpha 1.1.18

- Keep the icon-only top-left Settings gear visible through matches and SPA transitions.
- Default the FPS overlay off; place it beneath the gear when enabled in the default position.
- Suppress the optional game's read-only HUD placeholder when stats aren't exposed in HTML, retaining real data display.
- Maintain both Windows runtimes and build a complete standalone ZIP and EXE after checks.

---

# KS Client alpha 1.1.17

- CEF: enable native Chromium window activation and default to the Chrome runtime style (diagnostic Alloy switch retained).
- Remove multiple manual Windows cursor/focus modifications that hide an arrow without real pointer lock.
- Prefer Kirka's own game click handler; avoid duplicate KS pointerlock during pointerdown. Add a guarded, optional late CEF click fallback and passive native-request diagnostics.
- Isolate Eye Comfort canvas filters from the CEF #game surface while leaving Electron and settings preview unchanged.
- New regression checks for game-first input, fallback, native release and Eye Comfort; CEF live match behavior still requires user verification.

# KS Client alpha 1.1.16

- New single Kirka Game Runtime 2.0 for visible scenes, HUD, achievements, feed, compatibility fingerprints and disconnectable observers, shared across CEF and Electron.
- Additional passive draw-call/matrix diagnostics without graphics depth changes, combat-state modification or automatic weapon identification.
- New direct independent GitHub Release ZIP + EXE assets after Windows CI, with SHA256SUMS.txt and RELEASE-MANIFEST.json containing source commit and audited signing status.
- No anti-virus/SmartScreen/Chrome bypass; real publisher code-signing is still required for trusted reputation.

# KS Client alpha 1.1.15

- Dark gold KS-logo startup animation for CEF and Electron, with an offline-safe fallback.
- CEF genuine game canvas Pointer Lock capture attempts, native Chromium HWND focus and locked-cursor display sync. Requires live Kirka.io game verification.
- Remove duplicate WebGL observer in frame-pacing module and preserve antialiasing diagnostics in the shared registry.
- Optional real Authenticode signing, visible signature audit, SHA256 reports and readable (non-encoded) Windows shortcut creation.

# KS Client alpha 1.1.14

- Opt-in real WebGL texImage2D exact-image texture replacement and manual signature-calibrated 3D scale/offset in Workshop.
- Early CEF V8 integration, focus and Pointer Lock diagnostics; live CEF game mouse capture remains a manual verification item.
- Kirka original Join and spectator controls, live visible HUD, inventory, profile, server and market DOM snapshots.
- Safe, sandboxed ks.snapshot() extension API, broader local image/audio/font/CSS resource swapper, optional frame-yield workaround.
- Integration regression tests and gated dual-engine offline Windows package with a separate Setup EXE and Portable ZIP.

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

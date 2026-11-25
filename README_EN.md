# KS Client Beta 1.0.31

This release ships Electron only. Older engine selections open Electron automatically. The previous releases below are historical.

[Beta 1.0.31 release notes](RELEASE_BETA_131_EN.md)

# KS Client Beta 1.0.14 — new FPS limits, CEF fullscreen and Settings languages

Beta 1.0.14 adds 200/240/300/360 FPS limits, correctly disables native Unlimited FPS startup flags when selecting a fixed cap (restart required), lowers Settings GPU compositing work, fixes the Discord opening indicator, improves CEF fullscreen/F11, and offers 8 additional Settings-only languages. **The Windows Setup and Uninstaller remain English.** All previous features and saved profiles are retained. See [Beta 1.0.14 release notes](RELEASE_BETA_114_EN.md).

---

# KS Client Beta 1.0.0 — Public updates and unified black/orange HUD

**Beta release:** All existing user settings and Workshop data are retained. The FPS counter, Keystrokes, readable game statistics, break reminder and Settings close button now share the black/orange visual language of the KS gear and Discord controls. The Workshop category and its features are marked **Experimental**.

**Automatic updates now use real public GitHub Releases.** The separate `epicjatekosok/KS-Client-Updates` repository is publicly accessible. The Beta channel checks for verified newer Beta or Stable releases; SHA-256 pinning, filename/host validation and the Windows installer protect the update process. New profiles check automatically and pre-download verified installers; installation always requires confirmation. Manual **Check for updates**, **Install update & restart**, and **Open GitHub Releases (manual)** use the public feed. Previously saved settings are preserved, including any explicit choice to disable background downloads.

**Alpha → Beta migration:** The Alpha 1.1.23 updater cannot parse Beta tags. The publisher creates a single documented `v1.1.24-alpha` *compatibility bridge* containing the verified Beta 1.0.0 installer byte-for-byte, so older Alpha users can use their existing update buttons. The official new release is `v1.0.0-beta`; only Windows binaries and checksums are public, source remains private.

Direct binary-only distribution: https://github.com/epicjatekosok/KS-Client-Updates/releases

---

# KS Client alpha 1.1.23 — Discord crash fix, matched quick buttons and settings animations

Fixed the Electron main-process `openKSDiscord is not defined` crash when clicking the KS Discord button; the fixed community invite now opens in the system-default HTTPS browser from a module-scoped native helper. The upper-left Settings gear and KS Discord quick button share matching black/orange visuals and a common toolbar. The Settings panel, category changes, buttons, dropdowns and sliders animate smoothly with full support for reduced-motion preferences.

**Automatic update status:** Source `epicjatekosok/KS-Client` is private, and public binary repository `epicjatekosok/KS-Client-Updates` is not available (GitHub 404). Automatic downloads require the publisher to create this separate PUBLIC, binary-only repository and configure `KS_PUBLIC_RELEASE_TOKEN` in the private repo's Actions secrets. Never embed access tokens in the client. See [Public updates setup (Hungarian)](PUBLIC_UPDATES_SETUP_HU.md). Until configured, use Open GitHub Releases (manual) while signed in.

---

# KS Client alpha 1.1.22 — Reference-inspired orange gamer Settings

The old settings interface has been rebuilt as a full, visually consistent black-and-orange dashboard inspired by the supplied mockup. It features a KS logo and large Settings heading, seven logical navigation sections with SVG icons, glowing orange active arrows, visual Low/Medium/High performance cards, cohesive option panels, styled switches/selects, and functional Reset/Cancel/Apply actions. Every existing setting remains under a relevant category. The old Workshop data still saves separately.

Discord now opens the fixed KS community invite https://discord.gg/cxP386yGjk through the Windows default HTTPS browser (including when no browser is open). Native Electron navigation/popup and CEF navigation/popup fallbacks complement the integrated Discord buttons. A status message reports native opening success or failure.

CEF stability: navigations and SPA transitions can destroy CefSharp frames; asynchronous WinForms callbacks no longer retain IFrame references. Frame-loading handlers use IsValid guards and disposal-safe catches. The release keeps both engines, the launcher, auto-update logic, all other gameplay and browser features.

---

# KS Client alpha 1.1.21 — Stability, Diagnostics and Updates

Version 1.1.21 repairs Settings becoming unopenable in both Electron and CEF when an incomplete native diagnostics sample arrived. All missing fields now display a dash; the Settings dialog remains usable even if a panel fails to render. Advanced Diagnostics reads actual CPU, memory and process data from Electron/Chromium and the CEF host and its directly owned subprocesses; the first CPU reading can be zero.

**First-launch engine: Electron.** Explicit saved CEF selections are preserved. The inactive Hitmarker and Colored Killfeed menus and their cosmetic code have been removed; keystrokes, game stats, Quick Join, screenshots and all unrelated user preferences remain.

Updates: network lookup and UI now have bounded timeouts and accurate errors, plus an **Open GitHub Releases (manual)** option. Fully automatic downloads still require a public, binary-only `epicjatekosok/KS-Client-Updates` release repository and a publisher-side `KS_PUBLIC_RELEASE_TOKEN` Actions secret. The private source repository cannot serve anonymous client downloads. No GitHub credential is embedded in the client.

---

# KS Client alpha 1.1.20 — Menu refresh and KS Discord community

Alpha 1.1.20 refines the existing six-category KS Client settings menu with calmer dark surfaces, improved visual hierarchy, more consistent spacing and responsive controls. A new section/option keyword search finds existing settings without changing any saved preferences. The unobtrusive in-game lower-left version marker now sits closer to the screen corner. Clicking a Discord-labelled game control opens the verified KS Client community invite (https://discord.gg/cxP386yGjk) in the system browser, without navigating away from Kirka.io. Both Chromium engines share the same UI and native external-link action.

The launcher and verified Windows Portable ZIP / standalone Setup EXE build pipeline now target alpha 1.1.20. Existing Workshop, Game Integration, Resource Swapper, saved preferences and the alpha 1.1.19 update manager are preserved. A live game session is still needed to validate the game's exact Discord DOM and pointer-lock interaction.

---

# KS Client alpha 1.1.19 – CEF pointer-lock and input regression repair

## 1.1.19: built-in release updates

The new Client > Updates tab can check a public GitHub Releases update feed, optionally pre-download future releases and open a verified standalone installer after user confirmation. It is shared between CEF and Electron, and retains portable/installed folders, existing profiles and Workshop settings. See [RELEASE_119_HU.md](RELEASE_119_HU.md). **Automatic updates require the separate public `epicjatekosok/KS-Client-Updates` GitHub repository and the `KS_PUBLIC_RELEASE_TOKEN` Actions secret.** Without those two steps, the build is downloadable privately but the updater correctly reports its feed as not configured.


## What's new in 1.1.18

- An icon-only Settings gear stays fixed at the top left throughout Kirka.io matches and weapon-selection transitions, even when the game replaces page content.
- The FPS overlay is off by default for fresh profiles; when enabled its default location is below the gear. Previously stored preferences are preserved.
- The optional game stats panel no longer displays a technical placeholder when the game's HTML has no stats; existing accessible statistics remain supported.
- Existing Electron, CEF and other client features are retained.


CEF now uses Chrome-style Chromium embedding with an activatable native child window. Removed Win32 cursor hiding/focus hacks and the premature KS pointerdown capture. The Kirka game receives the first input request; a user-click-only fallback is conditional. CEF Eye Comfort filters no longer affect the active #game canvas; Electron input stays unchanged. See RELEASE_117_HU.md for evidence, CEF Alloy fallback, and essential live-game validation. Offline Windows CI cannot guarantee camera capture in a live match.

# KS Client alpha 1.1.16 – Kirka Game Integration Runtime 2.0

Built on 1.1.15, preserving both native engines and existing Workshop/UI. Shared visible Kirka scene/HUD/feed event bus, compatibility fingerprints, passive bounded WebGL draw instrumentation, and expanded regression tests. Two separately published Windows files (Portable ZIP and Setup EXE) now come from a verified GitHub Release with SHA256SUMS and a truthful code-signing report. Source checks cannot prove a live Kirka match, true CEF camera capture, or malware reputational approval. Details in RELEASE_116_HU.md.

# KS Client alpha 1.1.15 – game integration and trusted release readiness

Retains the 1.1.14 deep Kirka integration and adds a KS-logo animated startup on CEF/Electron, real pointer-lock-driven CEF cursor handling and motion diagnostics, and fixes a duplicate FPS WebGL observer. Optional genuine Authenticode signing and SHA256 build reports improve publisher verification. Unsigned first-time downloads may still be warned by SmartScreen or Chrome; no security bypasses are used. See RELEASE_115_HU.md.

# KS Client alpha 1.1.14 – advanced Kirka game integration (Windows release candidate)

Version 1.1.14 extends 1.1.13 with opt-in exact-asset WebGL texture replacement and manually calibrated 3D transforms, early CEF V8-context setup, Kirka's native Join/Spectate controls, visible game events, profile/inventory/market snapshots, audited sandbox plugin snapshots and an optional freeze workaround. All existing dual-engine settings and features remain available.

Offline Portable ZIP and standalone Setup EXE are produced only after both native Windows engine smoke tests, bridge, switching, installer and CRC/hash checks pass. Actual Kirka.io pointer lock, 3D skin behavior and live match integration still require manual Windows game testing. Details: DEEP_INTEGRATION_114_HU.md.

# KS Client alpha 1.1.13 – deep Kirka integration release candidate

Version 1.1.13 adds common CEF/Electron game-scene detection, read-only in-game HUD augmentation, lobby map/mode/weapon presets, drag-and-drop Quick Join, conditional friend spectating, early passive WebGL context diagnostics, and pointer-lock event logging. Both native engines remain available. See `DEEP_INTEGRATION_HU.md`.

The offline Windows ZIP and standalone Setup.exe are produced **only after** GitHub Actions passes source, UI, Electron, CEF, bridge, switching, installer and ZIP verification. Live Kirka.io match input, FPS and WebGL cosmetic compatibility still require manual testing.

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

### Checking performance on Windows 11

For an A/B comparison, keep the display at the same resolution and refresh rate (for example 2560 × 1440 at 180 Hz). Keep the same game settings, driver profile, VRR, camera and scene. Restart after changing the experimental Chromium unlock. Record its startup status.

1. Capture each engine separately with PresentMon. In Task Manager identify the presenting Electron or CEF process under the KS installation. Capture its PID, then select the game's swapchain. Exclude the launcher and loading window.
2. Warm up the scene for 15 seconds. Record 60 seconds per run, three times each. Use Unlimited, 60, 120, 180 and 240. Repeat with Settings closed, open on a normal tab, Performance, and Frame Stability. Compare the lobby, active match, unfocused and minimized states separately.
3. In the capture compare application submission intervals (FrameTime or MsBetweenPresents) and displayed intervals (DisplayedTime or MsBetweenDisplayChange). Exclude dropped frames from displayed timing. Record median, p95 and p99. A 180 Hz display can show up to 180 complete refreshes per second even when the application submits more.
4. In parallel log GPU utilization and board power in watts at one-second intervals using HWiNFO, and the CPU usage and private working set for the KS process tree. Keep other GPU applications idle. Report unavailable sensors as unavailable. Compare median watts and frame-time percentiles between repeated runs.
5. Verify that audio, matchmaking, chat, login and mouse capture still work after closing Settings, switching focus and restoring the minimized client. Compare with the optional lobby and unfocused caps disabled and enabled. On a 180 Hz display, 5.56 ms is the nominal interval at 180 FPS.

The in-client counter identifies page callbacks or browser ticks. For a separate driver-level comparison on NVIDIA, apply a Max Frame Rate profile only to the verified KS rendering executable. Record the driver's setting with the capture.

### Desktop Discord activity

KS Client connects to the local Discord desktop app at startup when a registered public application ID is available. It reconnects if Discord opens later. Activity privacy is controlled by Discord and the client switch in Advanced → General. A local ID can be supplied there if the distributor has not configured one. The older KS_DISCORD_APPLICATION_ID environment setting remains supported.

Use the gold settings control or the violet KS Discord control in the Kirka lobby. The original Kirka gear has an additional KS Client entry. Open Interface → Appearance or CSS Editor to drop a local CSS file or KS palette JSON. Apply keeps the preview and Cancel restores earlier preferences.

# KS Client Beta 1.0.11 — native Kirka login compatibility

## Login interaction repair

- Followed Dawn Client's simple sign-in principle: **Kirka handles its own Google, Discord and email/password login UI.** No KS-owned custom login dialog, manual token entry or Settings redirect is required to use the normal game sign-in buttons.
- With no Kirka game session yet, **Electron and CEF refrain from injecting any KS game overlays, canvas hooks, input listeners, cosmetics, or renderer instrumentation** into the original Kirka page. The original website owns all account-click and form-submit handlers.
- A small passive timer checks only whether Kirka itself has created a local game session; its value is **never read into the native process, transferred or logged**. After successful authentication, the page reloads once with the complete KS runtime and restores every existing HUD, Workshop, browser, gaming and settings feature.
- Removed the generic document-capture rule that treated any text-only 'Discord' game button as a KS community invite, even when it was Kirka's own OAuth login button. Explicit Discord invitation URLs and KS-owned Discord shortcuts continue working.
- Added a real Chromium user-click smoke test for the website's own Google, Discord and email/password controls, and an automatic session-ready test that uses only synthetic dummy values.

## Google provider limitation

Automated checks verify that KS no longer consumes Kirka's sign-in clicks, but **do not establish that Google will authorize a real account**. Google's OAuth rules generally disallow embedded browser login. The Dawn reference currently uses Electron 10 with `sandbox:false` and `webSecurity:false` and opens some popups in the system browser. KS does not clone those unsafe permissions or counterfeit OAuth callbacks; a fully compliant native Google flow would require a Kirka-supported external-browser authorization callback.

## Full standalone delivery

This is a **separate complete** `v1.0.11-beta` Windows release with a standalone Setup EXE and portable ZIP containing both Electron and CEF plus the app-local .NET runtime. Existing `v1.0.9-beta`, R2 and `v1.0.10-beta` GitHub releases remain untouched. Auto-update discovers the newer semantic version through the public binary-only `KS-Client-Updates` feed.

## Features kept

Engine switcher, original saved profiles/cookies, user settings, auto/manual updates, Workshop Experimental, HUD/FPS, input and pointer lock, resources and cosmetics, themes, diagnostics, network restrictions and previous release notes remain part of the install. During sign-in, game-specific injected modules are deliberately deferred until the game's own authenticated session exists.

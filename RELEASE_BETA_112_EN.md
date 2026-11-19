# KS Client Beta 1.0.12 — native Chromium sign-in and Redline-style simplicity

## Why this release exists

Beta 1.0.11 still displayed a spinning CEF Google account flow or an unresponsive Electron account click for some players. The earlier KS-specific popup and provider-domain routing code was more complicated than the simple native browser setup in Redline Client. **This version removes those extra KS restrictions**, rather than layering more Google-specific workarounds on top.

## Changes

- **Electron**: deleted the KS provider hostname allowlist, custom Google sign-in checks, custom BrowserWindow popup overrides, nested popup depth limits, manual OAuth redirect filtering and main-frame navigation guards. Electron/Chromium now handles Kirka-originated windows and ordinary HTTPS navigations by default, preserving its own session and built-in web security.
- **CEF**: removed its custom authentication popup LifeSpanHandler, Google/Firebase provider hostname allowlist, and browser-specific OAuth chain tracking. CEF now handles ordinary HTTP(S) login navigation and provider popups itself.
- Preserved sandbox:true, contextIsolation:true, nodeIntegration:false and webSecurity:true for Electron; CEF retains its Chromium security defaults and denies local/privileged URI schemes. No user-agent spoofing, credentials interception, account token export, or disabling cross-origin protections.
- Preserved Kirka's own Google, Discord and email/password UI. The passive 1.0.11 login gate still refrains from injecting KS overlay or WebGL hooks before Kirka has created its own session.
- KS-owned Discord invite still opens the fixed KS community URL; the game provider login buttons are not intercepted by a text-only match. Original HUD, Workshop Experimental, resource swapper, FPS options, pointer lock, engine switcher, cosmetics, diagnostics, settings, and updater remain.
- Added a new regression test for **absence of KS-managed OAuth handlers**, alongside the real-browser synthetic click tests for Google, Discord, and the email form.

## Important authentication limitation

This fixes a genuine source of client-side OAuth navigation blocking; **it does not prove a real Google login will work**. Google formally disallows embedded-browser OAuth in many cases. A fully supported external-browser authentication callback would require Kirka.io to provide a legitimate browser-to-client handoff; this client neither spoofs Google nor collects Google credentials. Live authenticated sign-in still requires user testing.

## Separate standalone release

The full Windows Setup EXE and Portable ZIP contain both tested engines and the offline CEF .NET runtime, without needing prior KS versions. This new release uses tag v1.0.12-beta; older v1.0.9-beta, v1.0.10-beta, and v1.0.11-beta remain separately downloadable and intact. Only built binaries, checksum/manifest files, and audit notes are published in the public updates repository; source stays in the private source repository.

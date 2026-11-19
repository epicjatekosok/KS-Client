# KS Client — Beta 1.0.10

## Kirka sign-in route isolation

- Fixed a real conflict between KS's Discord community shortcut and Kirka's own Discord login: the native Electron and CEF link handlers now recognize community invitations by **path**, rather than treating every discord.com URL as a community invite. Discord OAuth authorization and sign-in URLs stay in Kirka's existing, restricted authentication flow.
- The game's Discord account button inside the authentication dialog is no longer intercepted by the overlay's generic “Discord” label matcher.
- Fixed an additional Google account-picker routing bug: when Kirka's main game frame navigated into an approved HTTPS identity provider, Electron and CEF could block secondary popups created by the provider because the current page was no longer kirka.io. Both engines now track that **Kirka-initiated and allowlisted** navigation chain per browser and permit only approved provider popup destinations; the trust resets on return to Kirka.
- Retained the Beta 1.0.9 R2 Kirka-initiated Google/Firebase HTTPS navigation, native authentication popups, opener/callback continuity and regular in-game email/password entry. The app must never open its Settings panel automatically in response to a game-provider sign-in click.
- Kept Electron Chromium sandbox, context isolation and web security enabled, and CEF's existing trusted-provider URL checks. Unlike Dawn's permissive browser flags, the game must not get Node.js or uncontrolled local-file access.
- No password, provider cookie, authorization code or login token is copied into native IPC, logs or release telemetry. The existing optional Kirka session import is preserved as a separate user-controlled recovery tool, **not required for ordinary in-game login attempts**.

## Important limitation

Automated build, navigation and popup tests are not a live Google identity authentication test. Google may reject OAuth inside embedded Chromium/CEF (disallowed_useragent), irrespective of Kirka popup handling. Correct system-browser OAuth would need a Kirka-supported desktop redirect/deep-link or other authorized callback mechanism; KS Client does not invent credentials, forge callbacks or bypass Google's policy.

## Existing features preserved

Both Electron and CEF engines, in-place engine switching, mouse pointer lock, game statistics, skins, Workshop Experimental, overlays, custom themes, saved local browser profiles and settings, offline Setup/Portable delivery and verified GitHub automatic/manual updates remain available. Earlier Beta 1.0.9 and R2 release assets remain untouched; Beta 1.0.10 is a distinct release tagged `v1.0.10-beta` so older 1.0.9 clients can discover a newer version.

Public distribution: `epicjatekosok/KS-Client-Updates` — compiled EXE/ZIP and integrity metadata only. The `epicjatekosok/KS-Client` source repository remains private.

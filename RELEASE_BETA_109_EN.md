# KS Client — Beta 1.0.9

## Beta 1.0.9 Revision 2 — Kirka login navigation hotfix

The original Beta 1.0.9 build incorrectly intercepted Google sign-in navigation in BOTH Electron and CEF, replacing the real Kirka account flow with the KS account-helper dialog. Revision 2 corrects that bug:

- Trusted Kirka-initiated HTTPS Google sign-in/navigation is now treated like other allowlisted providers rather than blocked by a Google-only rule. The game's own email/password login, provider popup, Firebase callback and account selector can proceed to the extent supported by Kirka and the identity provider.
- No automatic Settings screen, token importer or KS account dialog is forced when Kirka navigates to a trusted Google account URL.
- The existing security boundaries remain: exact trusted HTTPS hosts only, original browser sandbox, no disabled web security, no Node.js exposed to a remote game, no UA spoofing, no credential/token interception, no arbitrary third-party or local-file navigation.
- Both browser engines, update logic, Workshop, HUD and player settings are preserved.

**This is still Beta 1.0.9**, published as a separate immutable hotfix tag `v1.0.9-beta-r2` so the SHA256-verified original release is not silently replaced. The current 1.0.9 updater compares version numbers only and will **not** detect this same-version revision automatically. Install the hotfix Setup.exe manually over your existing installation.

**Important:** Google OAuth can reject embedded browsers (`disallowed_useragent`) regardless of these fixes. Source-level navigation tests are not proof of a completed Google account login; Kirka and Google's servers decide whether authentication completes. Revision 2 does not bypass that policy.

---

**Windows · Electron + CEF · Account sign-in clarity and direct local Kirka-session recovery**

## Why this release

In Beta 1.0.8, clicking Google's button in the Kirka.io game could navigate to Settings → Advanced → General. This looked like successful Google login was expected but was merely a fallback from the embedded browser's blocked Google main-frame navigation.

## Changed

- Clicking Google's button **no longer automatically opens the full Settings menu**. If Google attempts to navigate the Kirka main frame rather than creating an allowed popup, Electron and CEF invoke the same compact **in-client account dialog**.
- This responsive dialog explains the Google embedded-OAuth restriction and offers a **local Kirka-session import** directly over the game, with a masked input, explicit consent checkbox, close/cancel option and validation feedback.
- The existing import routine is reused, including Kirka.io origin verification, token format bounds, overwrite confirmation, immediate secret-field clearing, and in-game reload. No bearer tokens go through KS native IPC, logs or analytics.
- OAuth popups for providers permitting embedded flows stay allowlisted, scoped to the game profile, and keep the existing opener/callback behavior. Discord and other external links are unaffected.
- The full current Windows launcher, Electron, CEF, Setup, Portable and CI release files are marked **Beta 1.0.9**. All earlier release notes are preserved in the client's version history.

## What this DOES NOT change

**This is not direct Google OAuth authentication inside the client.** Google's OAuth rules disallow its authorization endpoint in embedded browsers. With no documented Kirka-controlled desktop OAuth return endpoint or token exchange, KS Client cannot safely make a Google website login turn into a client session by itself. An existing Kirka game session can instead be *voluntarily* transferred from the user's browser. The Kirka server alone decides whether this session is accepted.

The product deliberately does **not** spoof Chrome, disable web security, intercept Google credentials/cookies, or redirect the game to the external browser. It does not claim to have tested a real Google identity account.

## Preserved

Electron and CEF startup, engine switching, the updater's verified public Github binary feed, in-place upgrades, local profiles, Workshop Experimental, HUD, mouse/pointer-lock behaviors, game statistics, skins and the rest of Beta 1.0.8.

Windows code signing is not configured; SmartScreen may warn until a publisher certificate is installed. The public **KS-Client-Updates** repository includes compiled ZIP/EXE and check metadata only; the source stays in the private **KS-Client** repo.

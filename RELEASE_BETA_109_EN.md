# KS Client — Beta 1.0.9

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

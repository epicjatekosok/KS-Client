# KS Client — Beta 1.0.8

**Platform:** Windows x64 · Electron + CEF · Public beta

## Kirka account sign-in: stays inside the client

- **No automatic handoff to Chrome:** When Kirka opens an allowlisted HTTPS identity-provider popup, Electron and CEF keep it in the client's persistent browser profile with the original `window.opener` relationship intact. A separate Chrome game session no longer opens as a supposed login solution.
- **Google policy is not bypassed:** Google's OAuth service can reject embedded browsers. KS Client does not spoof a browser user agent, steal provider cookies, intercept credentials, or claim that such an OAuth login succeeded. If Google refuses this user agent, it still requires a provider-supported OAuth callback / Kirka integration for fully automatic return to the game.
- **In-client account help:** If a Google login tries to replace the Kirka main game page instead of opening a real popup, the game stays loaded and the General account-help settings are shown. Login choices for supported providers remain in the game UI.
- **Existing Kirka session import retained:** For users with a legitimate existing Kirka session, Settings → General still offers a local, voluntary, password-masked Kirka session token import. It writes only into the current game's origin-local storage and reloads that game; it does not copy Google cookies, phone/SMS codes, or the token into native IPC or KS servers.
- **Facebook, Twitch, Discord, VK, Firebase/provider callbacks:** Popup navigation can complete within the browser host only when allowed by the provider, using the same persistent engine profile. Arbitrary external targets, local files and insecure redirects remain blocked.

## Preserved features

- Verified Windows offline Setup and Portable ZIP with **both Electron and CEF**.
- KS Client native auto/manual updater and verified public `KS-Client-Updates` release feed, SHA-256-checked downloads and in-place upgrades.
- Workshop Experimental, Resource Swapper, crosshair/FPS/HUD, game integrations, mouse controls, profiles, stats, settings and engine switching.

## Transparency and limitations

A login already completed in Google Chrome does **not** automatically authenticate Kirka in an independent Electron/CEF browser profile. Dawn's source similarly shows a **manual Kirka token import** workaround and no verified, automatic cross-browser Google OAuth callback. Fully automatic Google account login inside an embedded client cannot be guaranteed without cooperation from Kirka's authentication provider.

Windows Authenticode signing is not configured for this release, so Microsoft Defender SmartScreen may warn. Public releases contain only verified ZIP/EXE and checksum/QA metadata. Private source snapshots remain private.

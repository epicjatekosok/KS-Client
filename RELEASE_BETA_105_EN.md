# KS Client — Beta 1.0.5

**Platform:** Windows · Electron + CEF · Public beta

## Account sign-in: security and recovery

**Why Google account selection previously stalled:** Google does not support authorization inside embedded desktop browsers, including Chromium Embedded Framework (CEF) and Electron BrowserWindow. Selecting a Gmail or YouTube account can succeed visually while Google's final authorization step is blocked or the game's popup cannot complete its callback. Repeatedly allowing more Google domains in the embedded browser is not a supported fix.

### What's improved

- **Google / Gmail / YouTube account sign-in:** KS Client now recognizes exact Google sign-in hosts and offers an explicit **Open Kirka.io in default browser** choice instead of leaving an unresponsive embedded Google credential popup.
- **Secure recovery:** The system browser opens only the fixed URL `https://kirka.io/`, after user confirmation. KS Client never forwards OAuth codes, Google credentials, session cookies or arbitrary third-party URLs into the default browser.
- **Other sign-in providers:** Existing trusted Electron and CEF native OAuth popup handling, opener relationships, secure redirect allowlists and persistent in-client sessions are preserved. Unknown or insecure destinations remain blocked.
- **Account assistance:** A new **Client Overview → Account sign-in assistance** section lets you reopen the browser-based sign-in option any time. Both engines display the same explanation.
- **Diagnostics:** CEF and Electron log provider-domain events without authentication tokens or URL parameters. Regression tests cover Google blocking, other provider popups, explicit user consent and malicious destinations.

### Important limitation

**Signing into Kirka.io in your default browser does NOT automatically sign you into KS Client.** The default browser and embedded game runtime use separate protected cookie profiles. A true in-client Google login requires the Kirka.io developers to provide or officially approve a desktop OAuth authorization-code flow (with PKCE and a registered callback/deep link or a loopback redirect). KS Client does not control Kirka's OAuth client or callback endpoints, and Beta 1.0.5 does not claim to bypass Google's rules.

If you need Google account sign-in today, use the official Kirka.io page in your regular browser. You can continue trying Kirka's other available sign-in options inside KS Client; provider-side restrictions can still apply.

## Unchanged

- All Beta 1.0.4 appearance, English release notes, setup-version, game, performance, Workshop and HUD features remain available.
- Electron and CEF are still bundled in the verified Windows Setup and Portable ZIP.
- In-place upgrades preserve KS Client game settings and browser profiles, but cannot merge different browser sessions.
- Automatic/manual updates still use public GitHub Releases with checked assets and SHA-256 verification.

## Downloads

Get the verified Beta 1.0.5 Setup EXE, Portable ZIP and source ZIP from [KS Client public Releases](https://github.com/epicjatekosok/KS-Client-Updates/releases/tag/v1.0.5-beta). See the checksums and signing status on that page.

KS Client is an unofficial third-party Kirka.io desktop client and is not affiliated with Kirka.io or Google.

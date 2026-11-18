# KS Client — Beta 1.0.7

**Platform:** Windows · Electron + CEF · Public beta

## Reliable automatic and manual updates

- **Startup check (Dawn-inspired):** A non-blocking update lookup begins when the native Electron or CEF window starts, rather than waiting for Kirka.io to finish loading. The game stays available if GitHub is slow or offline. The splash screen can show the lookup state.
- **Respect user settings:** Both engines share a small native preferences file for automatic check, background download, and Alpha/Beta/Stable channel. The existing in-game Settings remain the source of truth when the game loads. Manual *Check for updates* remains available even with automatic checks disabled.
- **New version and notes:** The Settings → Updates page displays the verified available version, release notes, and installer size. Update notices do not capture the mouse or cover game controls.
- **Download and install:** Optional background prefetch continues to use the trusted launcher; manual installation shows native download progress, checks exact installer filename and SHA-256, and asks for confirmation. The current settings, browser profiles and both engines are kept during in-place upgrades.
- **Timeout fix:** The CEF process wait and both Settings UI timeouts now outlive the launcher's bounded GitHub retry.
- **Fail closed:** No credentials in the update feed, no arbitrary download URLs, no silent installation, no replacing an installed game when download verification fails.

## Preserved

- All Beta 1.0.6 Kirka gameplay, account sign-in assistance and optional local session import, Electron/CEF engine switching, mouse controls, FPS/HUD, Workshop Experimental, Resource Swapper, game statistics, skins, lobby and friends features.
- Private **KS-Client** repository continues to contain the source and recovery snapshots; public **KS-Client-Updates** contains only installers/Portable ZIP and integrity/status metadata.
- A full offline Setup and Portable package with both verified browser engines.

## Limitations

Google OAuth sign-in inside embedded CEF/Electron is still restricted by Google. Beta 1.0.7 is an updater release, not a claim that direct Google account authentication now works.
Windows packages may warn in SmartScreen until a valid code-signing certificate and publisher reputation are available.

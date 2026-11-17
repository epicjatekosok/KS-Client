# KS Client — Beta 1.0.4

**Windows release:** Beta 1.0.4 (`v1.0.4-beta`)  
**Platforms:** Windows 10/11, with both Electron and CEF engines.

## What's fixed

### English-only patch notes and update descriptions
- All patch notes for this release, including the public GitHub release description and the text displayed by **Settings → Updates** when a new version is available, are in English.
- The **Client Overview → Version history** patch notes are shown in English regardless of the selected menu language. Other menu translations remain available.
- The release notes are supplied from an English-language source file, `RELEASE_BETA_104_EN.md`. No translated Hungarian release body is used for the Beta 1.0.4 GitHub releases.

### Loading screen: English text and no cut-off content
- The Electron startup window is taller so the new dark/amber loading card, logo, progress indicator, footer and version label all fit.
- Loading titles, labels and accessibility text are in English (including “LOADING KS CLIENT”).
- The CEF startup panel also uses English status text with a bounded drawing area to avoid clipping on scaled displays.
- Splash changes do not modify game rendering, input, pointer lock or authentication behavior.

### Installer always displays the version being installed
- Removed the hard-coded version label from the shared Windows Setup / Uninstall / Update window layout.
- The Windows installer reads the exact release version from the **embedded Electron package metadata** and checks that it matches the **CEF smoke-test metadata**.
- Setup window title, confirmation, Windows Installed Apps version and installer log filename now use that actual bundled version. A mismatched package is rejected before modifying installed files.
- The uninstaller identifies the version of the installed runtime, including during cleanup from its temporary executable copy.

## What's unchanged
- Existing profiles and settings are preserved during updates, including the 13 appearance themes, advanced visual effects, workshop and in-game features.
- Electron and CEF remain included. The secure GitHub update feed, SHA-256 checks, manual update and installer rollback continue to work as before.
- The Beta 1.0.3 and earlier releases remain available separately.

## Downloads
Download the Setup EXE or Portable ZIP from the public [KS Client Releases](https://github.com/epicjatekosok/KS-Client-Updates/releases/tag/v1.0.4-beta) page. A public source-code snapshot, `KS-Client-beta-1.0.4-Source.zip`, and its SHA-256 checksum are published alongside them. The snapshot contains tracked source files without Git history.

**Note:** This is an unofficial Kirka.io third-party client. Windows executables may be unsigned, and Microsoft SmartScreen or browser download protections may display warnings. Real Kirka account sign-in and gameplay require separate user testing.

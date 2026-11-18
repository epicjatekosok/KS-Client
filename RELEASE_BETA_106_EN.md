# KS Client — Beta 1.0.6 (candidate)

**Platform:** Windows · Electron + CEF · Beta

## Kirka session transfer for accounts using Google or another external provider

Beta 1.0.5 offered to open Kirka.io in the default browser, but did not bring the resulting account session into KS Client. Beta 1.0.6 adds an optional **Settings → General → Import Kirka.io session (advanced)** workflow on both engines.

Users who already signed in to their own account on https://kirka.io/ in a trusted browser may locally transfer their Kirka session token to the same-origin Kirka.io local storage within KS Client. The settings field masks the token and clears it immediately after submission. The token is not sent through native IPC, console logs, diagnostics, GitHub, or a KS configuration file. The currently stored Kirka session is not replaced without explicit confirmation. The client then reloads Kirka.io so the game can validate the session.

**Security warning:** A Kirka session token grants access to your account and must be treated like a password. Never send it to other people, support, Discord, or ChatGPT. Never paste it into an unfamiliar site. This is a manual bearer-token workaround, not a new Google OAuth integration. It may fail if Kirka changes its session storage or token validation, and the token can expire or be revoked. Sessions on Electron and CEF remain separate.

**Why not embed Google login?** Google's security policy prevents OAuth authorization in embedded Electron/CEF browser windows. The officially supported seamless native OAuth solution would require Kirka.io to approve a secure external-browser flow that returns to KS Client through a registered callback or similar first-party mechanism. We cannot independently register Kirka's own Google OAuth application.

## Preserved

- Both Electron and CEF, browser profiles and all installed KS settings.
- Existing non-Google sign-in provider popups and opener handling.
- Workshop, FPS/HUD, weapon customization, resource swapper, scripts, lobby, friends, inventory/market and other Beta 1.0.5 functionality.
- Existing GitHub manual/automatic updater and SHA-256 integrity validation.

## Source privacy

The private KS-Client repository may retain a source archive for recovery. Only the Portable ZIP, Setup EXE, and integrity/status metadata go to the public **KS-Client-Updates** release. Public source archive publishing is disabled for new releases.

## Test status

Code changes are prepared on a separate development branch. Passing automated CI is not the same as proof that a live account can log in: a real Kirka session import must still be tested on Windows by the account owner before publishing Beta 1.0.6.

The KS Client is an unofficial third-party Kirka.io desktop application.

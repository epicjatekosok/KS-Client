# KS Client Beta 1.0.16

- Sharing can export and restore a portable KS profile with local Workshop entries, manual plugins, settings and uploaded images, sound and font. Use the same file to transfer between Electron and CEF. Game sessions stay in the corresponding browser profile. Native preferences and external Swapper files stay on disk.
- Performance accepts a custom integer callback target from 1 to 1000 as well as the existing presets. Zero removes the KS cap. Presented FPS, driver behavior and power still require hardware measurements.
- CEF now captures PNGs directly from the browser surface and opens the actual Swapper/assets directory.
- Workshop can list supported asset paths observed in the current document. Friends and Market panels refresh from visible entries. Lobby presets skip hidden, unavailable and disabled standard form controls.
- Discord desktop Rich Presence is opt-in via the KS_DISCORD_APPLICATION_ID environment variable. It requires a registered application and a running desktop Discord.
- The Windows release verifies the historical installer before making it available to old Alpha updaters.

- Opt in to a hash-stable local replacement filename (.ks-anyhash), compare a visible weapon preview with actual texture uploads, or recolor a known native HTML hitmarker by ID.
- Friends can watch for one explicitly named friend's existing Spectate button for 60 seconds while the panel stays open.

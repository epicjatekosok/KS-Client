# KS Client Beta 1.0.22

- Low targets 720p and reduces client effects. Medium targets 1080p with smoothing. High targets 2160p with smoothing for maximum detail. Each setting can still be adjusted individually. Applying a profile keeps the selected FPS limit. Reload the game to apply a changed WebGL antialiasing setting.
- Fixed resolutions use a fitted game viewport and consult the game's measured WebGL drawing buffer. Width follows the window aspect ratio. Display reports the observed size when available. Higher resolutions require more GPU work. Native restores the normal desktop viewport.
- The custom crosshair moves two output pixels to the right. While the KS crosshair is displayed, the native dot, arms and outline are suppressed. Switching it off restores the original reticle, including the player's saved dot size.

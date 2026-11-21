# KS Client Beta 1.0.20

- With normal Chromium sync, the fixed limiter uses browser repaint callbacks during gameplay. At targets between one and two times the measured refresh rate, spare game steps run between repaints. Menu and unlimited-startup protection retain their demand-driven clocks.
- The KS browser counter shows a measured average calculated from delivered animation steps and elapsed time. Changing the frame policy starts a new measurement window. The Kirka native HUD remains game-owned.
- The custom crosshair appears only during a match, centered on the visible game canvas. The Settings preview remains available in the lobby.
- Disabled mouse freeze protection no longer registers a mousemove listener or creates a message channel.

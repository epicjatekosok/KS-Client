# KS Client Beta 1.0.15

- Electron and CEF share visible game-view transitions and HUD values. An empty HUD field stays unavailable.
- Settings can temporarily cap page animation callbacks at 30 per second. Closing Settings restores the selected gameplay cap. Frame Stability uses the gameplay cap and now includes the 99th percentile.
- The FPS counter and WebGL draw telemetry sleep when unused. Diagnostics reports draw calls per second when it observes the game canvas. These measurements do not establish presented GPU FPS.
- Workshop script previews end when their panel closes. Local asset swapping caches its enabled setting in both engines.
- Selecting Unlimited in the FPS list removes the page callback cap. The experimental Chromium unlock is an independent startup option. Both engines allow normal background scheduling even with this option enabled.
- Two optional Performance settings limit lobby callbacks to 60 and unfocused game callbacks to 30. Both start off. Active gameplay keeps the saved FPS target.
- The pacer sleeps between deadlines on fast browser clocks. Hidden diagnostics stop polling and the crosshair redraws when its appearance changes.
- Existing settings and Workshop profiles use their original storage keys. Installers and portable updates continue through the public Windows releases.

### Measuring displayed FPS on Windows

Capture the same lobby, match or Settings scene with PresentMon display tracking enabled. Record the KS browser process ID and swapchain from the CSV. From the private source checkout run the following command with your own capture values.

    python tools/analyze_presentmon.py capture.csv --pid 1234 --swapchain 0xABC

The output summarizes displayed intervals for that process and swapchain. The tool reads the capture locally. Compare like-for-like runs with the same resolution, display refresh rate and FPS setting. The live client counters describe page callbacks and browser ticks.

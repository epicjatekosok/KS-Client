# KS Client Beta 1.0.19

- Both engines avoid copying the animation callback queue each frame. Updating a HUD value no longer triggers a full scan of game menus and compatibility features. Inactive matrix cosmetics leave the native WebGL matrix call in place.
- CEF uses warning-level native logs during normal play. Use --ks-cef-verbose when detailed Chromium diagnostics are needed.
- For PCs fluctuating between 100 and 300 FPS, Graphics → Performance → Smoothness profile → Steady – 90 FPS provides a fixed 11.1 ms target while retaining your chosen resolution.
- In Display → Eye Comfort, Still menus removes KS animation and decorative transitions on supported Kirka menu controls. Readable descriptions gives KS explanations more line spacing and a contrasting background. Both settings are optional.

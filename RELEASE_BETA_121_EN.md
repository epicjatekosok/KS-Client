# KS Client Beta 1.0.21

- Windows Setup and Portable include Electron only. The launcher automatically selects Electron for existing users, including saved CEF preferences and legacy shortcuts. Setup removes the old bundled CEF runtime during an in-place upgrade. Browser profiles remain in the user data directory.
- The engine selector shows Electron and a disabled placeholder for the future KS engine.
- Display settings can request native WebGL edge smoothing on the Kirka game canvas at context creation. Enabled by default, reversible on reload. Linear, mipmapped game textures can also use up to 4× supported anisotropic filtering on the same setting. Support depends on the renderer and game pipeline. Frame Stability reports the actual context attribute. Existing resolution, FPS, and Eye Comfort preferences are retained.

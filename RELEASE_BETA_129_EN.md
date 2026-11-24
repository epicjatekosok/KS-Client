# KS Client Beta 1.0.29

- Graphics now offers an optional NVIDIA Max Frame Rate profile for the dedicated KSClientGame.exe runtime. Select an FPS value, choose Set NVIDIA profile and confirm. Apply Unlimited to restore inherited driver behavior. Restart the client after a change. Other GPU vendors retain the existing browser pacing controls.
- Weapon Studio can discover exact texture uploads on the game canvas, identify a selected weapon from Kirka's equipment UI and save its skin without typing the original URL. Discovery is opt-in. Historical default-texture fingerprints for eleven weapon types are accepted only after the actual game canvas uploads that exact asset. Source of the published filename mapping: https://www.youtube.com/watch?v=zqjw0a3BT5s . A different thumbnail, atlas, compressed texture or a previously uploaded texture can require reloading or manual mapping.
- The friend-list reader follows the open native tab across scrolling rows and explicitly labeled native previous/next pages, restores the original page and scroll position and distinguishes scanned rows from current presence. Other tabs, filtered-out entries and server-only friends are outside the scan.
- A calibrated live weapon pose supports all three rotation axes, scale and position for a named selected weapon. Unidentified weapon matrices are unsupported. A HUD selection and a shared texture alone do not prove first-person mesh ownership.

## Checking a live installation

1. On NVIDIA, compare unlimited, 60 and 180 in the same reproducible scene after restarting between profiles. Use the bundled Measure-KSClient.ps1 with PresentMon. Compare presentation intervals, GPU utilization and power from the same adapter. The driver readback confirms a saved setting, not measured presentation FPS or watts.
2. Enable discovery before opening the weapon selection. Confirm the detected weapon and observed image in the renderer status, bind a distinct local test image, then reload the scene. Export Live compatibility report from Weapon Studio and compare the per-texture upload replacement count with the actual model. Switch weapon, return to lobby and restore the original skin. Try a second weapon sharing the same asset.
3. Open Kirka's friends tab, then read the current list in Gameplay / Friends & Profiles. Compare names and stable IDs at both ends and check native presence changes. A scan describes only the selected tab.
4. Calibrate a matrix only for a verified first-person weapon. Bind a small rotation and compare the model before and after switching weapons. Clear bindings to restore the original transform.

Authenticated live-game compatibility and physical GPU measurements depend on the game build and hardware. No particular reduction in power, minimum FPS or universal weapon support is claimed.

# KS Client Beta 1.0.25

## Using the Workshop

Open the original game panel before opening the matching Workshop tab. Inventory keeps the last visible selection in memory for this document. Market history stays in the local browser profile and retains up to 400 changes of the minimum visible asking price per exact item name and currency. Empty lists mean the game did not expose supported rows. Unlabelled or ambiguous amounts are excluded from history. Missing presence information stays unknown. Only visible, same-origin profile and market links are followed. KirkaStats opens as its own website.

Weapon Studio accepts a local PNG, JPEG or WebP (up to 1 MiB and 2048 px per side), resized to at most 512 px and stored as WebP. Enter the exact original texture URL, a weapon name, and save the binding. Enable 3D cosmetics and reload the game. The renderer uses the URL on an actual image upload to the game canvas. Thumbnail similarity, a matching filename or a saved preset does not establish weapon identity. Packed atlases, worker-rendered textures, ImageBitmap and unidentifiable materials are unsupported. Test one weapon per binding and check the replacement counter. Disable and reload to restore originals.

Resource packs use folders such as textures, img, skins, ui, audio, media and fonts. Put the paths beneath the selected pack folder in the same layout as the game's assets. Choose Create from folder, then enable the pack and the main swapper. Alternatively import an exported KS pack JSON. Pack size is limited to 128 files / 12 MiB; up to 12 packs can be installed. The highest-priority exact path wins, then a matching .ks-anyhash build suffix, then loose-file lookup. Conflicts count shadowed paths within enabled packs. Observed paths count recognized paths since this client started; zero observations can also mean the asset has not been requested yet. Reload after changes. Deleting a pack deletes its managed copy.

## Plugin API

API 1 keeps the manual, opaque iframe preview and its existing message, tint and snapshot calls. API 2 runs JavaScript in a dedicated worker owned by an opaque sandbox with network requests disabled by content security policy. Select Worker API 2 when saving a new plugin. Start it manually; imported plugins are disabled initially. The local JSON format uses format "ks-plugin", api 2, name, version (three numeric components), code and a small settings object. Edit or export an existing entry from the Plugins tab.

- ks.settings contains a structured copy of the plugin's saved JSON settings.
- ks.panel(text) and ks.message(text) update one non-interactive local overlay, limited to 180 characters.
- await ks.snapshot() returns scene, settingsOpen, callbackFPS and callbackFrameMs. Unavailable performance samples may be null or zero. These are browser callback measurements.
- ks.on("settings", fn) receives a boolean; ks.on("scene", fn) receives the observed scene; ks.on("shortcut", fn) receives "Alt+Shift+P" for a real key press. Each registration returns an unsubscribe function.
- ks.send(name, text) posts a 140-character message to a named API 2 plugin if the recipient explicitly lists the sender in its settings.allowFrom array. The recipient can use ks.on("message", fn) to receive {from, text}. Up to eight messages wait in memory until its next manual start.
- Stop ends the worker and removes its overlay. Hiding the document, navigation, a worker error, exceeding 32 messages per second, an unresponsive worker, or reaching five minutes also ends the run. The last 20 worker errors are kept for the document lifetime. Only one plugin runs at a time. The worker watchdog does not impose an OS memory quota.

Example worker plugin:

```js
ks.on('settings', open => ks.panel(open ? 'Settings open' : ''));
ks.on('shortcut', async () => {
  const sample = await ks.snapshot();
  ks.panel(sample.scene + ' · ' + sample.callbackFPS + ' callbacks/s');
});
```

## Windows performance measurement

Warm the same scene at the same resolution, graphics preset, monitor refresh and power settings for 30 seconds. Close unrelated GPU applications. Record three 60-second runs at Unlimited, 60, 120, 180 and 240 FPS with Settings closed and open. Repeat a background/minimized run. Restart when switching the unlimited Chromium flags. Match each process and swapchain in the PresentMon capture; keep the same main game window, excluding overlays and other Electron apps. Use the tool folder in the installed or portable distribution.

```powershell
.\tools\Measure-KSClient.ps1 -Label match-180 -Seconds 60 -PresentMon C:\Tools\PresentMon.exe
```

The host CSV records total KS Electron CPU utilization across logical cores and summed process working sets (shared pages may be counted twice). With nvidia-smi available the GPU CSV records timestamp, GPU UUID, whole-device utilization and watts, in that order; unavailable sensors can report N/A. PresentMon 2.x can produce separate present intervals. Use tools/analyze_presentmon.py on one matching PID/swapchain for application FPS, displayed FPS, median, p95 and p99 frametime. Report per-run values and medians. Lower callback FPS alone does not demonstrate lower power. On NVIDIA, an independent driver comparison can be made with a per-program Max Frame Rate setting for runtime/Electron/electron.exe; record its value and return it to its previous setting after the comparison.

## Manual acceptance on a signed-in account

1. Enter a live match and compare default view, an exact weapon texture binding, another weapon and reset after reload. Confirm unchanged gameplay and crosshair.
2. Open real inventory, market, friends and a profile. Check displayed names, actual price units, minimum/changes and available native links against those original panels.
3. Import two packs replacing the same permitted file. Swap priority and reload; disable both and verify the original. Check font/audio and an asset with a changed hash.
4. Start a v2 plugin, press Alt+Shift+P, close Settings, stop it and test a legacy preview. Restart KS and verify no plugin auto-starts. Sign-in, profile import and updater should keep their prior behavior.

# KS Client Beta 1.0.18

- Selecting a fixed target schedules the game's main-thread animation callbacks on demand, independently of the monitor's refresh. The game can submit work above 144 Hz without the experimental Unlimited startup switches. The physical display still refreshes at its configured rate. A busy game or GPU can miss a target.
- A fixed target suppresses the two unlimited Chromium switches at the next engine start. Each engine remembers its fixed mode separately. Changing 120 to 180 takes effect immediately. If you previously launched unlocked, apply the fixed target and restart the engine once. Returning to Unlimited keeps your original unlock preference.
- The FPS HUD and graphs sample existing callbacks once per second. Frame Stability samples actual callback intervals passively. With Reduce rendering in Settings enabled, all Settings tabs keep a 30 callbacks/s ceiling and use an opaque background. With Protect menus with Unlimited active enabled, recognized game menus use a 60 ceiling while native unlock is active.
- These limits apply to the main-thread animation path. Browser presentation, worker rendering, driver queues and GPU board power need independent measurement.

## Compare on Windows

Use the same resolution, graphics, monitor refresh and scene for each run. Close other GPU workloads. In each engine separately, warm up for 20 seconds, then record 60 seconds in the lobby, Settings and a reproducible game scene. Compare Unlimited, 180 with normal Chromium startup after restart, and 60. Leave FPS HUD and graphics settings identical. Log GPU utilization and board power with HWiNFO sensor logging. Use PresentMon for application present intervals and displayed intervals on the same browser GPU process and swap chain. Kirka's own frame counter gives a third observation. Compare average watts and utilization as well as median and 95th percentile frame times. No hardware measurements for the RTX 5070 Ti are included in this release.

On an NVIDIA system, this command records a board-wide sample each second in the current directory. Press Ctrl+C after 60 seconds and use a distinct filename for each run.

```powershell
nvidia-smi --query-gpu=timestamp,name,utilization.gpu,power.draw --format=csv -l 1 -f ks-180-match.csv
```

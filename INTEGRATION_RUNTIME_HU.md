# KS Client – Kirka.io Game Integration Runtime (foundation work)

**Priority:** make existing client integration reliable before introducing new features. This branch does NOT add gameplay automation, extra HUD menus or new cosmetics.

## Findings in the previous 1.1.14 architecture

1. Electron preload dispatched four independent page-world scripts through asynchronous calls; the relative order was not guaranteed by the code. CEF similarly dispatched multiple early scripts separately.
2. The passive WebGL observer and the cosmetic hook separately wrapped HTMLCanvasElement.getContext. Rendering hooks were attached only on subsequent getContext calls; when a game context was created before the graphics module attached, the wrapper could miss it.
3. The Kirka DOM event layer left MutationObservers connected to old killfeeds/achievement containers after SPA transitions.
4. The CEF permission flags check could accept a combined permission request if its formatted value contained PointerLock, even if unrelated permissions were included.

## Runtime foundation changes

- **Single WebGL context registry.** One passive getContext hook handles WebGL/experimental-webgl/WebGL2, preserves the original method return and exceptions, publishes to registered consumers, and replays already observed contexts without calling getContext again. All integrations share the same reference instead of racing through their own hooks.
- **Consumer lifecycle.** WebGL cosmetics attaches through the shared onContext API; only uses its late-hook fallback if the registry was unavailable. It remains explicitly opt-in for modifying textures or matrices. Restoring cosmetics reinstates the original GL methods, rather than bound substitutes.
- **Deterministic early injection.** Electron preload requests one ordered bundle and evaluates it in the main-world context (Electron world 0). CEF evaluates the same ordered pieces as one JS task via OnContextCreated, with FrameLoadStart and FrameLoadEnd fallback. Existing sandbox, context isolation, origin checks, and trusted hosts remain in place.
- **Explicit late fallback.** Electron DOM-ready always tries the passive observer before post-load cosmetics if early installation was unavailable. It does not attempt to create a WebGL context merely to discover it.
- **DOM observer cleanup.** Visible game events detach old observers at every scene transition and when the game swaps its killfeed/achievement roots. The game integration core supplies transition notifications; a lightweight poll handles in-scene DOM updates.
- **CEF permission safety.** Accept a single trusted Kirka PointerLock permission only, not multi-flag prompts. Real CEF pointer-lock behavior still requires Windows/Kirka gameplay to verify.

## Existing features preserved

The 1.1.14 UI, Weapon Studio, local resources, Quick Join, Spectate, performance settings, overlays, profile and inventory integrations are not removed or expanded in this infrastructure refactor. Both the Electron and CefSharp paths receive the same shared JavaScript.

## Verification

Run source and browser tests in the repository's Windows GitHub Actions pipeline, including tests/test_runtime_integration.py. The new test checks replay after game context creation, no duplicate getContext calls, no cross-subscriber replays, GL method restoration, and observer cleanup when leaving a match.

**Important:** offline Chromium and Windows host smoke tests are not a substitute for a real Kirka.io match. Even a passing build cannot prove the CEF mouse cursor is hidden and controls the camera correctly, or that all WebGL skins work with game assets. Test those in both engines with an actual game session.

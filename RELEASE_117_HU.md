# KS Client alpha 1.1.17 – CEF egér, valódi Pointer Lock és szemkímélő beállítások

## Forrásalapú hibakeresés

A KS 1.1.16 CEF WinForms kliensében több egymást zavaró beavatkozás volt:

1. A CefSharp WinForms `ChromiumWebBrowser.ActivateBrowserOnCreation` alapértéke `false`. Ilyenkor a CEF beágyazott ablak `WS_EX_NOACTIVATE` stílust kap; az Electron BrowserWindow nem így kezeli a játék beviteli fókuszát.
2. A KS az aktív meccsen `Cursor.Hide()`, `SetCursor(IntPtr.Zero)`, `NativeCursor.SetFocus(...)` és `GetHost().SetFocus(true)` hívásokat is használt. A külön natív kurzoreltüntetés **nem** biztosít valódi relatív mozgást; a CEF UI-/WinForms-szálának ütközései fokozhatták a hibát.
3. A `game_extras.js` már `pointerdown` eseménynél saját `requestPointerLock()`-ot kezdeményezett, még mielőtt a Kirka saját click- vagy mouseup-kezelője futott volna. Az egérbefogási kérések versenyezhettek.
4. Az `Eye Comfort` és `Softness` beállítás `canvas{filter: ... !important}` CSS-t alkalmazott a teljes játék-vászonra is. Ez **nem** állítja át a Pointer Lockot, így nem bizonyított a hibával való okozati kapcsolat, viszont a GPU-kompozitálási út megváltoztatása miatt érdemes CEF-ben elkülöníteni.

A CEF/Chrome Pointer Lock nem egyszerűen kurzoreltüntetés. Külön kell tudni, hogy az oldali `requestPointerLock()` megtörtént, a `pointerlockchange` sikeresen lefutott, és a meccsben érkeznek-e valódi `movementX/movementY` események.

## Az 1.1.17 változtatásai

- **CEF Chrome-stílusú böngészőablak** az alapértelmezett CEF Alloy-stílus helyett: `CefSharpSettings.RuntimeStyle = CefRuntimeStyle.Chrome`. A dokumentált `--ks-cef-alloy` kapcsolóval a régi stílus továbbra is vizsgálható. Ez nem vált vissza Electronra; a kiválasztott motor CEF marad.
- **Aktív natív CEF böngészőablak**: `ActivateBrowserOnCreation=true` a natív HWND létrehozása előtt. A Chromiumra bízzuk a natív egér fókuszát és a kurzort.
- **A hibát fokozó kód kivezetése**: a C# már nem hív `Cursor.Hide/Show`, `SetCursor(NULL)` vagy Win32 `SetFocus`-t, és nem nyeli el a CEF `OnCursorChange` üzeneteit. A JavaScript `locked`/ `released` állapota csak diagnosztika, nem próbál mesterségesen egérbefogást utánozni.
- **A Kirka saját beviteli eseménye élvez elsőbbséget**: a KS nem foglalja le a `pointerdown` eseményt, és nem kér előre Pointer Lockot. A CEF-specifikus korai `cef_input_probe.js` csak *átláthatóan követi* az eredeti `requestPointerLock()` hívásokat, az eredeti függvény eredményét és hibáit változatlanul hagyja. A KS a valódi `click` legvégén, opcionálisan csak akkor kérhet befogást, ha a játék ugyanakkor nem próbálkozott vele. Electronban ez a CEF-specifikus javító út **nem fut**.
- **Szemkímélő izolálás**: CEF alatt a szemkímélő CSS szűrő nem vonatkozik a Kirka `#game` canvasra, a beállítások és az előnézet megmaradnak. Electronban a korábbi szűrő-beállítások változatlanul működnek.
- **Hibadiagnosztika**: külön naplózható `gesture`, `fallback`, `request-failed`, `locked`, `released`, `pointerlockerror` és `motion-ok` esemény. A CEF játékoldal konzoljában a `window.__KS_CEF_INPUT__?.getStatus()` és `window.__KS_GAME_EXTRAS__?.getStatus()` jelzik a natív hívások számát, a hibákat és a relatív mozgást.

## Hogyan teszteld a valódi CEF egérkezelést?

1. Indítsd a KS Client 1.1.17-et **CEF motorral**, majd lépj be egy Kirka.io-meccsbe.
2. Kattints egyet a játék közepére. Ha az egérbefogás sikeres, eltűnik a rendszerkurzor és a kamera az egér `movementX` / `movementY` alapján fordul.
3. Próbáld ki a **jobb/bal**, az **ESC** (feloldás), a következő kattintás (újrabefogás), és az **Alt+Tab** (ablakváltás) eseteket.
4. Ha a kurzor továbbra is látszik, nézd meg a `%LOCALAPPDATA%\KSClient\cef-1.1.17.log` fájlt. Ha van `gesture`, de nincs `locked`, a JS/CEF natív engedély vagy Chromium-stílus miatt nem jön létre a valódi befogás. Ha van `locked`, de nincs `motion-ok`, a relatív mozgás/fókusz problémája valószínű.
5. Kizárólag hibakereséshez indítható közvetlenül a CEF motor a `--ks-cef-alloy` paraméterrel. Ez összehasonlítja a Chromium Chrome-stílus és az előző Alloy-stílus viselkedését, de nem garantálja, hogy a régi mód működik.
6. Hasonlítsd össze a beállításoknál **Eye Comfort bekapcsolva és kikapcsolva**: a `#game` canvas a CEF-ben egyik esetben sem kapja meg a globális filtert; Electronban a beállítás továbbra is hat rá.

**A Windows/Chromium automatikus fordítás- és JavaScript-tesztek nem helyettesítik az élő Kirka-meccsben végzett egérirányítási tesztet.** A CEF/Chromium upstream támogatását is befolyásolja a verzió.

## Mit bizonyítanak a források?

- [CefSharp WinForms ChromiumWebBrowser aktiválás](https://cefsharp.github.io/api/113.1.x/html/Properties_T_CefSharp_WinForms_ChromiumWebBrowser.htm): `ActivateBrowserOnCreation` alapból `false`.
- [CefSharp WinForms Chrome/Alloy](https://cefsharp.github.io/api/130.1.x/html/P_CefSharp_CefSharpSettings_RuntimeStyle.htm): a WinForms alapból Alloy-stílusú, de Chrome-stílus is használható.
- [CefSharp CursorChange](https://cefsharp.github.io/api/130.1.x/html/M_CefSharp_Handler_DisplayHandler_OnCursorChange.htm): `true` esetén az alkalmazás átveszi a kurzorváltozás kezelését.
- [CEF régi Pointer Lock-hiba](https://github.com/cefsharp/CefSharp/issues/2660): az upstream korábban is ismert korlátozás; az 1.1.17 helyi javítása nem garantálja, hogy nincs más, CEF-ből eredő hiba.

A KS Client 1.1.16 összes többi integrációja, beállítása, meglévő funkciója és a kétmotoros launcher megmaradt.

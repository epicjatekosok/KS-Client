# KS Client Beta 1.0.31 – renderelés és mérés

## Kiindulópont és javítások

A kiinduló forrás az epicjatekosok/KS-Client main ágának 705db3836f3e3e3f5ab9b7ecca38c23312d4b9ba commitja (1.0.30). A Windows-csomag Electron 45.3.2-t használ, Chromium 156.0.8078.100-zal. A játék a szokásos látható BrowserWindow-ban fut. Az Electron setFrameRate metódusa offscreen felületekre vonatkozik.

| Terület | Az 1.0.30-ban talált ok | Változás az 1.0.31-ben |
|---|---|---|
| Indítás | Az előtöltő 50 000 JavaScript-karakteres küszöbe eldobta az ennél hosszabb korai csomagot. A DOM elkészülte után a játék már elmenthette az eredeti rAF-hivatkozást vagy létrehozhatta a WebGL-kontextust. | Az előtöltő a saját csomag teljes tartalmát átadja. A teszt a tényleges hat szkripttel ellenőrzi a belépett és a kijelentkezett útvonalat. |
| Fix FPS | Az időzítő és a postTask közvetlenül is hívhatta a játékot. Szinkron módban a limiter plusz lépéseket állíthatott elő két kijelzőfrissítés között. | Egy Chromium rAF-időbélyeghez legfeljebb egy callbackköteg tartozik. Az időzítő csak a következő rAF igénylését késlelteti. Az elkésett határidők kimaradnak. A megszakítás, a kötegen belüli törlés és az új célértékhez tartozó átlag külön tesztelt. |
| Magas fix cél | Az elmentett fix jelölő a kijelzőnél magasabb cél esetén is kikapcsolhatta az unlockot. | A kliens figyeli az ablak aktuális kijelzőjét. A Hz fölötti fix cél Chromium-unlockot kér a következő indításkor. Ugyanaz a korlátozó ilyenkor is csak valódi böngészőcallbacket ad tovább. |
| Minőség és teljesítmény | A High Performance nevű belső profil 2160p-t kért, az animációk és a képfelbontás össze voltak kötve. | A minőség és a teljesítmény külön állítható. A High Performance és Maximum FPS megőrzi a játék renderfelbontását. A 4K az Ultra képminőséghez tartozik. A régi egyedi értékek megmaradnak. |
| Menü és háttér | Beégetett 30/60-as korlátok, korlátozott jelenetválasztás, kikapcsolva is futó emlékeztető. | Önálló menü-, lobby- és háttércél. A KirkaStats nyitása és bezárása jelez a limiternek. A háttérkorlát a minimalizált ablakot is figyeli. A kliens a Chromium saját háttérütemezését is használja. |
| Mérés | A FrameTime mező egyes CSV-verziókban CPU-képkockakezdetek különbsége. Az elemző ezt Present-hívásként értelmezte. | Az alkalmazás prezentációs sebessége a MsBetweenPresents mezőből, a képernyőn megjelent képek ideje a DisplayedTime vagy MsBetweenDisplayChange mezőből származik, kiválasztott PID és swap chain szerint. |

## A renderelési út és a GPU-k

A Kirka játékkódja ütemezi a rajzolást. A WebGL vagy WebGL2 parancsokat az ANGLE a választott grafikus felületre fordítja. A Chromium cc és Viz részei kompozitorképkockákat állítanak elő és adnak tovább. Windowson a DWM, a prezentációs mód, a driver és a kijelző időzítése is befolyásolja a látható eredményt. A játékon belüli WebGPU használatára nincs igazolt mérés. A fejlesztés ezért a meglévő WebGL-kontextushoz kapcsolódik.

A GPU-választás alapja a Chromium saját adapterválasztása. Az aktív jelzőt, a PCI-azonosítót vagy modellnevet, a gyártót és a driververziót a Chromium szolgáltatja. A hibrid gépek energiatakarékos és nagy teljesítményű beállítása WebGL powerPreference kérés. A döntést a driver és a Windows felülbírálhatja. A kártyanév elérhetőségét a driver befolyásolja.

A **Browser Graphics → Check available backends** külön ideiglenes profilokban, a csomagolt Electron valódi példányaival tesztel. D3D11, D3D11on12, Vulkan, OpenGL és Windows WARP esetén egy zöld tesztpixel visszaolvasása és az egyező rendererazonosítás szükséges. A nem egyértelmű D3D11on12 és a más backendhez visszaeső mód kimarad a találatokból. Az ellenőrzés egyszeri művelet. Az aktív backend a Diagnostics alatt ellenőrizhető. A Windows-szoftverrenderelés külön kompatibilitási lehetőség, ha működik a WARP-próba. A hardveres gyorsítás letiltása továbbra is elérhető hibakereséshez.

Az NVIDIA GTX/RTX, AMD Radeon RX és iGPU, Intel HD/UHD/Iris/Arc családokra ugyanaz a képességalapú út vonatkozik. A családnév önmagában nem igazolja egy modell és driver működését. Az NVIDIA korábbi, felhasználó által jóváhagyható, alkalmazásspecifikus driverlimitje megmaradt. Ennek külön tartós hatása van: örökölt driverbeállításhoz válaszd a nulla célértéket és a Set NVIDIA profile gombot. AMD és Intel esetén a kliens a játékhurkot ütemezi. Látható, egyértelműen azonosított Kirka FPS-választónál külön gomb adja át a célértéket a játéknak.

## Unlimited, szinkron és mérőszámok

Az Unlimited kiválasztása kikapcsolja a mérkőzés KS-callbackkorlátját. A Chromium-indítási változáshoz teljes kliensújraindítás kell. A csomagolt Chromium forrásában a disable-frame-rate-limit a cc és a display scheduler begin-frame korlátozását kikapcsolja és magában foglalja a GPU VSync kikapcsolásának kérését. A normál szinkron visszaállításához válaszd a Native / normal sync módot, majd szükség esetén indítsd újra a klienst. A lobby, a háttér és a Settings külön korlátozható. A VSync, G-SYNC és FreeSync tényleges driver- vagy monitorállapota nem olvasható ki megbízhatóan innen.

| Mérőszám | Forrás |
|---|---|
| Game FPS | A Kirka látható és értelmezhető HTML HUD-ja, ha van ilyen |
| Browser Callback FPS | Natív Chromium-animációs callbackben átadott játékcallbackkötegek |
| Render FPS | Külön motoroldali vagy megbízható GPU-képkockajel kell. A WebGL draw hívások száma önmagában kevés. |
| Application Present FPS | ETW/PresentMon, az alkalmazás kiválasztott swap chainje |
| Displayed FPS | ETW/PresentMon által megfigyelt megjelenítési időközök ugyanazon a láncon |
| Monitor Refresh Rate | Az Electron által az aktuális kijelzőhöz jelentett névleges képfrissítés. A VRR pillanatnyi frekvenciája külön mennyiség. |

A **Frame Stability → Record match callback intervals** opció legfeljebb 4096 intervallumot őriz memóriában. Zárd be a menüt, játssz, majd nyisd meg újra a fület. A mérkőzés utolsó mintája külön jelenik meg az éppen menüben mért értékektől. Az 1% és 0,1% low a leglassabb intervallumok átlagának reciproka, a minimum mintaszám 100 és 1000. A hosszú intervallum küszöbe a medián másfélszerese. Ezek a statisztikák a játék által főszálon kért animációs ütemet jellemzik.

## Windowsos A/B mérés

1. Az 1.0.30-at és az 1.0.31-et azonos GPU-val, driverrel, képfelbontással, ablakmóddal, élsimítással, renderfelbontással és jelenettel hasonlítsd össze. Jegyezd fel a monitor Hz-ét, a driverlimitet, a VRR-t, a Windows HAGS beállítását és a játék saját limitjét. Első körben hagyd az ANGLE-t Automatic állásban.
2. Azonos bemelegítés után ismételd meg háromszor az egyes felvételeket. A mérés kezdete előtt hozd vissza a játékot az előtérbe. A GPU és CPU többletterhelés elkülönítéséhez hasonlítsd össze az azonos jelenetet kikapcsolt és bekapcsolt overlayjel, graphokkal, diagnosztikával és Workshop-kiegészítőkkel.
3. A gyenge integrált, régi dedikált, közép- és felső kategóriás, valamint hibrid gépen jegyezd fel a tényleges adaptert. Célok: Unlimited, 60, 120, 144, 180, 240 és 360 FPS. Kijelzőmátrix: ahol rendelkezésre áll, 60, 75, 120, 144, 165, 180, 200, 240, 280, 300, 360, 480 Hz és afölött. Monitorváltásnál a Monitor Refresh Rate cél kövesse az ablakot.
4. Forgatókönyvek: lobby, inventory, market, KirkaStats, Settings nyitva/bezárva, mérkőzés, folyamatos kattintás és kamerafordítás. Ismételd ablakosan, teljes képernyőn, Alt+Tab és minimalizálás/visszaállítás után. Egérnél külön beállítás az 1000/2000/4000/8000 Hz. Hosszabb futáskor használd például a 1800 másodperces felvételt.
5. A PresentMon konzolos eszközt add meg a scriptnek. A felvételhez a Windows kérhet ETW-jogosultságot. A CSV időközök képernyőoldaliak; fizikai kattintástól fényig mért késleltetéshez külön, erre alkalmas mérés szükséges.

```powershell
.\tools\Measure-KSClient.ps1 -Seconds 60 -Label beta131-match-180 -Scene match -WindowMode fullscreen -MouseHz 4000 -Resolution 2560x1440 -DisplayHz 180 -PresentMon 'C:\Tools\PresentMon.exe' -GpuEngineCounters -OutputDirectory .\captures
```

A script listázza a Windows grafikus adaptereit, rögzíti a kliensfolyamatok CPU- és memóriaadatait, valamint kérésre a WDDM GPU-motorok számlálóit. Az NVIDIA nvidia-smi táblázat időbélyeg, GPU UUID, kihasználtság (%), teljesítmény (W), hőmérséklet (°C) és foglalt memória (MiB) sorrendű. Ez teljes adapterre vonatkozik. Más gyártóknál külső szenzornapló, például HWiNFO CSV használható, ha az adott szenzor jelent adatot. Az egérfrekvencia és az ablakmód a kezelő által megadott címke.

```powershell
python .\tools\analyze_presentmon.py .\captures\recording-presents.csv
python .\tools\analyze_presentmon.py .\captures\recording-presents.csv --pid 1234 --swapchain 0x123
```

A fájlnevet és az azonosítókat a tényleges felvételből válaszd ki. Az első parancs felsorolja a lehetséges láncokat. A „null” ismeretlen adat. A CPU FrameTime mező nem helyettesíti a Present-hívások időközét. Az app-present és a megjelenített FPS átlaga azonos hosszú felvételből hasonlítható össze. A natív GPU-terhelés, fogyasztás, frametime és input latency változása fizikai A/B eredmény hiányában nyitott.

## Módosított fájlok

- `electron-app/overlay/frame_pacer.js`, `overlay.js`, `integration_bootstrap.js`, `kirka_stats.js` – ütemező, profilok, mérőfelület, WebGL-kontextus és a KirkaStats állapotváltása.
- `electron-app/main.cjs`, `graphics-host.cjs`, `preload.cjs` – natív indítás, próbaablakok, adapter- és monitordiagnosztika, helyreállítás és a korai integráció.
- `tools/Measure-KSClient.ps1`, `tools/analyze_presentmon.py` – Windows-mérés, külön kijelzett és prezentált képkockák.
- `ci/`, `.github/workflows/windows-build.yml`, `launcher/`, `installer/`, betöltőképernyő, csomagmetaadat, README, változáslista, kiadási jegyzet és verzióellenőrző tesztek – összehangolt 1.0.31, kompatibilis offline csomagolás. A nyilvános kiadáshoz a main ág kézzel indított folyamatában a publish opciót is ki kell választani.
- `tests/test_graphics_131.cjs`, `test_beta_114.cjs`, `test_menu_pacing_118.py`, `test_ui_122.py` és `ci/check_source.py` – korai csomag, adapterek, helyreállítás, limiter, profilok és mérőadatok regressziótesztjei. A régi CEF-re írt 115/116-os történeti forrástesztek az eltávolított CEF-könyvtárra hivatkoznak, a jelenlegi CI nem futtatja ezeket.

## Kutatási alap és további fejlesztés

| Megvizsgált kliens, commit | Eredmény |
|---|---|
| Redline d47d959 | src/main.ts, feltételes unlock és GPU VSync kapcsolók. A fő licenc GPL-3.0. |
| Helium c136d5d | src/util/switches.js, unlock, opcionális in-process GPU, blokklista figyelmen kívül hagyása, zero-copy és kísérleti V8 kapcsolók. GPL-3.0. |
| Dawn 6bb5877 | A Heliuméhoz hasonló kapcsolócsoport, külön feltételes unlock. GPL-3.0. |
| Celeste 3bd1b61 | src/main.js, háttérkorlátozások feloldása, IPC flooding protection kikapcsolása, V8 heapméret és folyamatprioritások. A settingsManager.js beállítja az unlockot, a felülírt adapterválasztást és a CustomFrameCap kérést. Az utóbbihoz a postinstall-patch.js külön, módosított Electron 44 binárist tölt le. A KS hivatalos Electron 45 csomagjában ennek egyszerű átmásolása hatástalan lenne. A package.json ISC licencet jelöl. |

A megvalósítás önálló. A Windows HAGS, a driver globális profilja és a Chromium védelmi mechanizmusai a rendszer fennhatóságában maradnak. A valódi, gyártófüggetlen present-limiterhez a megjelenítési lánc ütemezési pontja feletti vezérlés kell. Egy későbbi Chromium-alapú KS Engine a Viz begin-frame és a swap/presentation feedback pontokat együtt műszerezhetné. A Windows ETW-adatok élő megjelenítéséhez elég lehet egy külön helyi PresentMon-komponens. A mérőprogram önmagában nem szabályozza a GPU munkáját.

Elsődleges hivatkozások: [Electron 45.3.2](https://releases.electronjs.org/release/v45.3.2), [Electron webContents](https://www.electronjs.org/docs/latest/api/web-contents), [GPUInfo](https://www.electronjs.org/docs/latest/api/app), [Chromium 156 Viz kapcsolók](https://github.com/chromium/chromium/blob/156.0.8078.100/components/viz/common/switches.cc), [Chromium cc](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/how_cc_works.md), [ANGLE](https://github.com/google/angle), [DXGI Flip Model](https://learn.microsoft.com/en-us/windows/win32/direct3ddxgi/for-best-performance--use-dxgi-flip-model), [Windows VRR](https://learn.microsoft.com/en-us/windows/win32/direct3ddxgi/variable-refresh-rate-displays), [HAGS](https://devblogs.microsoft.com/directx/hardware-accelerated-gpu-scheduling/), [PresentMon CSV](https://github.com/GameTechDev/PresentMon/blob/main/README-ConsoleApplication.md).

## A 17 követelmény ellenőrzése

| Pont | Mit tartalmaz a tesztverzió, és meddig terjed az ellenőrzés? |
|---|---|
| 1. Renderelési út | A módosítás a játék főszálas animációs ütemezését, az Electron indítását és az állapotfüggő limiteket érinti. A Windows-mérés külön számolja az alkalmazás által prezentált és a megjelent képeket. |
| 2. Kutatás | A fenti összehasonlítás négy kliens megoldásait és licenceit, a forráslista a Chromium cc/Viz, ANGLE, DXGI, DWM, VRR, HAGS és PresentMon működését dokumentálja. Az eredeti játék WebGPU-útvonala nem igazolt. |
| 3. GPU-családok és hibrid gépek | Az adapterlista, aktív adapterjelzés és WebGL energiagazdálkodási kérés az illesztőprogram képességeit követi. Modellenkénti GTX/RTX, Radeon és Intel igazoláshoz fizikai gépek kellenek. |
| 4. Felismerés és backend | Automatikus backend vagy gépenként tesztelt D3D11, D3D11on12, Vulkan, OpenGL és WARP. A mentett, még nem ellenőrzött választás jelölve van. A CPU, RAM, kijelzők, driver és tényleges renderer külön olvasható. |
| 5. Többletterhelés | A HUD újrahasználja a már feldolgozott beállításokat. Az egérmozgás-számláló kizárólag egérzárban figyel. A WebGL diagnosztika bezáráskor lekapcsolja a rajzolási megfigyelést. A referenciaablak ugyanazt a jelenetet méri a limiter telepítése előtt és után. |
| 6. Unlimited | Az újraindításkor aktivált indítási politika és a mérkőzés callbackkorlátja külön működik. A Windows-próba normál és feloldott Electron-példányt indít. A Kirka saját limitje és a driverprofil a játékban továbbra is számít. |
| 7. Megjelenítés | A HUD, rAF, render, present, displayed és Hz mérőszámok forrását a fenti táblázat részletezi. A CI külön PID és swap chain szerint közli az ETW-mérést, ha van adat. 60–540 Hz között szimulált regresszióteszt is fut. |
| 8. Limiter | Az összes előírt fix cél, egyedi érték, kijelzőkövetés és Unlimited elérhető. A teszt vizsgálja a célváltást és az átlag törlését. A támogatott NVIDIA-profil felhasználói megerősítéssel írható. Az általános Electron-út főszálas korlátozó. |
| 9. Frame Stability és bemenet | Átlag, low értékek, medián, P95, P99, ingadozás, tüskék, külön mérkőzésminta. A natív eldobási adat a CSV-ben mérhető. A fizikai 1–8 kHz-es egér és a kattintástól megjelenésig mért késleltetés helyi vizsgálatot igényel. |
| 10. Szinkron | A Windows-próba normál és feloldott módban fut. A driver által ténylegesen alkalmazott G-SYNC, FreeSync, VRR, VSync és HAGS állapota csak ellenőrzött helyi konfigurációban értékelhető. |
| 11. Jelenetek | Mérkőzés, lobby, inventory/market, KirkaStats, Settings és háttér eltérő aktivitási szabályt kaphat. A teljes ablakos alapértelmezett háttérelmosást eltávolítottuk. Az opcionális Frosted felületet a beállítási limit már külön kezeli. |
| 12. Profilok | Nyolc teljesítményprofil és hat képminőségi profil érhető el. A magasabb teljesítményprofil megőrzi az egyéni renderfelbontást. |
| 13. Diagnosztika | Az Electron adatai mellett a megnyitott diagnosztika támogatott NVIDIA-telepítésnél adapterenként mutatja a kihasználtságot, wattot, hőmérsékletet és videomemóriát. Legfeljebb öt másodpercenként kérdez. A hiányzó szenzorérték Unavailable. A WDDM GPU-motorszámlálók a mérőeszközzel más gyártóknál is rögzíthetők. |
| 14. Helyreállítás | GPU- és kontextushiba esetén a következő indítás visszatérhet a korábban működő beállításra. A bejelentkezési képernyő szabályos bezárása nem számít hibás GPU-próbának. A fekete kép pixeltartalma alapján önmagában nem lehet megbízhatóan driverhibát megállapítani. |
| 15. Reprodukálható mérés | A Windows CI látható 640×360-as, minden rajzoláskor színt váltó jelenetet használ. A normál és feloldott referencia mellett a feloldott ág 60/120/144/180/240/360 és korlátlan célt mér. A PresentMon 2.3.1 binárist SHA-256 ellenőrzés után indítja. A napló közli a renderert, névleges Hz-et, rajzolási ütemet és az ETW-láncokat. Az alábbi fizikai határok miatt a helyi A/B protokoll is szükséges. |
| 16. Kompatibilitás | A kiadási ellenőrzések kiterjednek a meglévő Electron-menüre, Workshopra, crosshairre, login-útvonalakra, KirkaStatsra, frissítőre, telepítőre és hordozható csomagra. Az online fiók és az összes driverkombináció működése külön élő teszttel igazolható. |
| 17. Eredmények | A 54-es PR minden Windows-futása külön naplózza a teszteket. A tesztcsomag vázlat. Nyilvános kiadás csak külön jóváhagyással készülhet. |

A Windows CI referenciaablaka a szállított frame_pacer.js fájlt futtatja. A rajzolási ütem a tesztjelenet saját mérése. Az ETW-output a Windows asztali környezetét jellemzi. A valódi Kirka-meccs átlagos vagy 1% low FPS-nyeresége, az input lag és a megtakarított watt egyelőre ismeretlen. Az 1.0.30 és az 1.0.31 azonos hardveren végzett összehasonlításához a fenti Windowsos A/B eljárás használható.

A kiegészítő módosítások helye: tests/frame-output-windows.cjs, ci/Test-FrameOutput.ps1, .github/workflows/windows-build.yml, tests/test_beta_114.cjs, tests/test_graphics_131.cjs, tools/analyze_presentmon.py, electron-app/graphics-host.cjs, electron-app/main.cjs, electron-app/overlay/game_extras.js és electron-app/overlay/overlay.js.

### Helyi mérés megnyitása a Diagnostics lapon

A Measure-KSClient.ps1 alapból öt másodpercet ad a játékablakba visszaváltásra. Ez a `-StartDelay` paraméterrel változtatható. Azonosítsd a mérendő folyamatot és swap chaint a fenti listázó paranccsal. A példa fájlnevét és azonosítóit helyettesítsd a felvételed értékeivel.

```powershell
python .\tools\analyze_presentmon.py .\captures\recording-presents.csv --pid 1234 --swapchain 0x123 --output .\captures\match-180.json
```

A Diagnostics → Recorded PresentMon measurement mezőben nyisd meg a JSON-fájlt. A felület kiírja a felvétel nevét, PID-jét, swap chainjét, a prezentált és megjelent FPS-t, a kijelzési P99-et és az eldobott képkockákat. Ezek a kiválasztott felvételre vonatkoznak.

# KS Client alpha 1.1.15 – betöltés, játékvezérlés és biztonságos kiadás

## Mi új a 1.1.15-ben?

**KS-dizájnú betöltőanimáció:** a meglévő eredeti KS logót használja; sötét, aranyszínű animált körrel, fénylő betöltősávval és 1.1.15-es jelöléssel. Electronban saját, elkülönített, helyi HTML splash ablak; CEF-ben natív WinForms panel. Nem futtat külső szkripteket, nem kezeli az adatokat, és a játék első dokumentumbetöltése után eltűnik. Ha az oldal nem töltődik be, legfeljebb 18 másodperc után felengedi a felületet, hogy újra lehessen próbálkozni.

**Mélyebb WebGL-integráció:** kijavítottuk, hogy a frame_pacer.js régi, párhuzamos `__KS_RENDER_OBSERVER__` implementációja megelőzhette az új közös WebGL-regisztert. Egyetlen megfigyelő maradt, és megtartottuk a korábbi élsimítás-diagnosztikát (`getStats()`). A 1.1.14-es integrációs alapkód és a Workshop továbbra is működik.

**CEF egérbefogás:** a valódi Kirka-játékvászonra érkező, megbízható bal kattintás CEF alatt szükség esetén `requestPointerLock()` hívást indít. A böngésző csak a tényleges `pointerlockchange` siker után kapcsolja át a Windows natív kurzorát; a natív Chromium-ablakot is fókuszba hozza. Kilépés, hiba vagy ablakváltás esetén visszaállítja a kurzort. Az új `relativeMoves` számláló segít szétválasztani a nem sikerült befogást és a hiányzó egérmozgást. Nincs mesterséges kamera-mozgatás, nincs hamis hitelesített egéresemény és nincs általános Windows-kurzoreltüntetés.

**Telepítő és Windows/Chrome figyelmeztetések:** eltávolítottuk a base64-kódolt PowerShell-parancsos asztali parancsikon-létrehozást. A Windows-build most opcionálisan tud egy valódi, hiteles kiadói tanúsítvánnyal Authenticode-aláírást alkalmazni az első féltől származó EXE-fájlokra (launcher, eltávolító, CEF host, külön telepítő), és jelenti az aláírások valódi állapotát. A telepítő nem kapcsolja ki az antivírust, a SmartScreent és a Chrome védelmét, és nem használ hamis tanúsítványt.

## Hogyan tudsz megbízhatóbb Windows-kiadást készíteni?

1. Szerezz be érvényes, megbízható tanúsítványt egy hitelesített kiadó számára, vagy használd a Microsoft Artifact Signing szolgáltatását az identitásellenőrzés után.
2. Az ilyen tanúsítványból származó, megfelelő jogosultságokkal kezelt PFX-et és jelszót a GitHub Actions titkai közé tedd, `KS_SIGNING_PFX_BASE64` és `KS_SIGNING_PFX_PASSWORD` néven. A privát kulcsot soha ne küldd chatbe és ne commitold.
3. A következő Windows-build a saját EXE-ket aláírja, az aláírást ellenőrzi, és létrehozza a `SIGNING-STATUS.txt` jelentést. Ha a tanúsítvány hiányzik, a build nyíltan UNSIGNED/Notsigned állapotot jelez. Ez nem jelenti azt, hogy a program rosszindulatú.
4. Használj következetes kiadói nevet, a GitHubról töltsd le a hivatalos ZIP-et/EXE-t, és tedd közzé a SHA256 értékeket. Téves riasztás esetén a teljes, változatlan mintát és a fájl hash-ét a megfelelő gyártó hivatalos false-positive csatornáján jelentsd be. A tiszta, aláírt fájlnak idővel jó reputáció épülhet, de **sem az aláírás, sem a forráskód önmagában nem garantálja, hogy Chrome/Windows nem fog figyelmeztetni**.
5. A Microsoft Store a legbiztosabb módja a SmartScreen letöltési figyelmeztetések csökkentésének, de külön publikálási követelményekhez kötött.

Microsoft leírás: https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation

## Hogyan ellenőrizd a CEF egérjavítást?

Windows alatt indítsd a KS Client CEF motorját, lépj be valódi Kirka.io meccsbe, kattints a középen lévő játék-vászonra. A kurzornak el kell tűnnie és a kamerának relatív egérmozgásra fordulnia kell. Ezután nyomj ESC-t: a kurzornak újra meg kell jelennie. Végezd el Alt+Tab után is. A naplóban: `%LOCALAPPDATA%\KSClient\cef-1.1.15.log`, keresd a `Kirka pointer lock: gesture / locked / released / pointerlockerror / motion-ok` sorokat.

A játékoldal fejlesztői konzoljában `window.__KS_GAME_EXTRAS__?.getStatus()` mutatja a lockRequests, lockErrors és relativeMoves értékeket. A pontos live-teszt még szükséges: az automatikus Windows CEF indítási és Chromium JS UI teszt nem tud valódi Kirka-kameravezérlést igazolni.

## Kiadási fájlok

- `KS-Client-alpha-1.1.15-Portable.zip` — teljes hordozható kliens mindkét motorral.
- `KS-Client-alpha-1.1.15-Setup.exe` — külön offline telepítő EXE.
- `CI-TEST-RESULT.txt` és `SIGNING-STATUS.txt` — valós automatizált tesztek és aláírások ellenőrzése.

A korábbi KS Client funkciók és a beállítások megmaradnak.

# KS Client 1.1.12 – mélyebb Kirka.io-integráció (fejlesztői ág)

Ez a változtatás a meglévő 1.1.12-es kódhoz új, közös integrációs réteget ad, nem távolít el korábbi funkciót.

## Elkészült
- **Közös játék-integrációs mag:** felismeri a lobby, szerverkínálat, barátlista, profil, inventory, szobakészítés és meccs nézeteit. Modulként kezeli a be- és kikapcsolást; a játékfelület frissítésekor újra ellenőrzi a hiányzó DOM-elemeket.
- **Játékbeli HTML HUD:** a megjelenített kill-adatok és a megfigyelhető killfeed alapján új, elkülönített KS-statisztikaelemet helyez a már látható meccs-HUD mellé. Nem olvas hálózati csomagokat vagy privát játékállapotot. A headshot becslés a DOM-tól függ.
- **Lobbyba húzott meccslink:** HTTPS-es Kirka.io-lobby/szerverlinkkel; az Electron/CEF natív csatlakozási szabályai tovább ellenőrzik a címet.
- **Barát megfigyelése:** kizárólag akkor jelenik meg Spectate gomb, amikor a barátlista *maga* tartalmaz egy érvényes, közvetlen Kirka.io szobalinket. Nem talál ki vagy következtet ki privát szobalinkeket, és nem csatlakozik kattintás nélkül.
- **Pointer Lock-diagnosztika:** natív naplóba kerülnek a valódi lock/release/error események, mindkét motoron; CEF aktiválás és valódi kattintás esetén a Chromium böngészővezérlő fókuszt kap.
- **Korai, passzív WebGL-észlelés:** a getContext hívásokon keresztül képes a 2D/3D renderkörnyezet létrehozását diagnosztizálni. Nem írja felül a draw, textúra vagy shader műveleteket.
- **Meglévő funkciók megtartása:** a KS overlay, Workshop, kétmotoros váltás, FPS és telepítő változatlan marad. A két közös JS-modul azonos Electronban és CEF-ben.
- **CI:** JS-szintaxis, közös forrás-azonosság és böngészős tesztek. A PR csak a forrás- és Chromium-teszteket futtatja; a Windows motor- és telepítőtesztek manuálisan/merge után indulnak.

## Helyi diagnosztika
A Kirka.io oldalon, a DevTools konzolon: `window.__KS_INTEGRATION__?.getStatus()` és `window.__KS_RENDER_OBSERVER__?.getStatus()`.
CEF Pointer Lock hiba esetén: `%LOCALAPPDATA%\KSClient\cef-1.1.12.log`.
Electron esetén: `%LOCALAPPDATA%\KSClient\electron-1.1.12.log`.

## Fontos korlátok
- A dokumentált Kirka.io HUD-elemek, CSS-osztályok és URL-minták később változhatnak. Nem ellenőriztük élő Kirka.io-meccsben.
- Ez a lépés **nem valósít meg 3D WebGL fegyvertextúra-cserét**. A passzív rajzolási diagnosztika a későbbi opcionális kozmetikai integráció alapja, nem maga a csere.
- A CEF egérrögzítés az oldaltól, Chromium engedélykezelésétől és valódi játékbeli kattintástól függ. A fókuszjavítás **nem tekinthető igazolt teljes Pointer Lock-javításnak**.
- A Spectate gomb nem jelenik meg, ha a barátlista csak rövid azonosítót mutat. Az ilyen esethez külön, dokumentált és felhasználó által engedélyezett link-feloldás szükséges.
- A korai JavaScript-betöltés a CEF `FrameLoadStart` életciklusát használja, amely egyes böngészőverziókban már késő lehet egy korán létrehozott WebGL-kontextushoz. A passzív figyelés ilyenkor kevesebbet láthat.
- A hozzáadott egérdiagnosztika nem kezel szerveroldali állapotot és nem módosít bemenetet.

## Következő valódi Windows-tesztek
1. Indítsd a kliens mindkét motorját; az alap overlay és Workshop továbbra is működjön.
2. Nyiss meg valós Kirka.io-meccset, próbáld meg az egeret a játék vásznára kattintva befogni. Vizsgáld a lock/release/error naplóbejegyzéseket.
3. Ellenőrizd a HUD számait, a lobbyba behúzott szobalinket és a barátlista melletti gomb megjelenését.
4. Profilváltás és motorváltás után nézd meg az integráció állapotát.
5. Játék közben hasonlítsd össze az FPS-t és az egérmozgást az eredeti 1.1.12-vel.

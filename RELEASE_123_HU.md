# KS Client alpha 1.1.23 – Discord, egységes gombok, animációk és frissítési diagnózis

## 1. Electron Discord összeomlás javítása

A v1.1.22-ben a Kirka-lobby **KS Discord** gombja Electron alatt `ReferenceError: openKSDiscord is not defined` hibát dobott a főfolyamatban. Az ok az eltérő JavaScript-hatókör volt: a segédfüggvény a `createWindow()` belsejében élt, de a natív `receiveMessage()` azon kívül hívta. Az 1.1.23 ezt közös, modul-szintű, ellenőrzött `openKSDiscord()` függvénnyel javítja, amely a **https://discord.gg/cxP386yGjk** meghívót a Windows alapértelmezett böngészőjében nyitja meg, akkor is, ha az addig nem futott. Az IPC eseménykezelő most hibavédett, így egy váratlan kivétel nem jeleníti meg a főfolyamat összeomlási ablakát. A natív linkmegnyitási hibáról érthető visszajelzés jelenik meg.

## 2. Fogaskerék és KS Discord egységesítése

Mindkét gomb közös, bal felső gombsorba került, **azonos fekete háttérrel, narancssárga kerettel, mérettel, lekerekítéssel, árnyékkal és interaktív állapotokkal**. A gombsor nem takarja a Kirka jobb alsó menüelemeit. A KS Discord gyorsgomb csak a lobby nézetben látható, a beállításmenü fejlécében külön gomb marad.

## 3. Animált interakciók a teljes beállításmenüben

A menü megnyitása lágy beúszással történik; a kategóriaváltás, megjelenő kártyák és presetválasztás finoman áttűnik. A gombok, kapcsolók, grafikai presetek, csúszkák és egyedi legördülők rövid, egységes hover/press/selection animációkat kapnak. A **Reduced Motion**, az **UI Animations** kikapcsolása és a Windows mozgáscsökkentési beállításai teljesen letiltják ezeket a mozgásokat.

## 4. Frissítési hiba kivizsgálva

A kliens által ellenőrzött `epicjatekosok/KS-Client-Updates` nyilvános repository jelenleg **404** választ ad. Ezért nincs hitelesítés nélküli kiadási lista és EXE letöltés. A privát `KS-Client` kiadásai nem használhatók ilyen automatikus letöltésre. Az 1.1.23 világosabb hibaüzenetet és beállítási magyarázatot jelenít meg; a kézi **Open GitHub Releases (manual)** gomb megmarad. A SHA-256-tal ellenőrzött frissítő és az automatikus publikációs támogatás a nyilvános tároló létrehozása után működhet. A pontos egyszeri GitHub-beállítások: **PUBLIC_UPDATES_SETUP_HU.md**.

## 5. Tesztek és kiadás

Automatikus Node.js Discord-főfolyamat tesztek (sikeres megnyitás, aszinkron és szinkron hiba), kétmotoros Playwright gomb- és animációtesztek (az animációk kikapcsolásával is), korábbi funkcióregressziók, Windows Electron/CEF motorindítás és váltás, offline ZIP és Setup EXE sértetlenségi vizsgálat. A valódi Windows böngésző társításait és élő Kirka.io-meccseket a felhasználói Windows-rendszeren is tesztelni kell.


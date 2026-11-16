# KS Client alpha 1.1.16 – közös Game Runtime, mélyebb integráció és letöltési megbízhatóság

## Elvégzett fejlesztések

**Game Integration Runtime 2.0:** az 1.1.15-ös Electron/CEF modulok közé egyetlen Kirka.io-eredethez kötött, közös eseményközpont került. A kliens meccs/lobby/profil/barátlista/inventory/market/szerver nézeteket felismerhet a **valóban látható** Kirka HTML-jegyekből, követi a meccsváltásokat, a HUD kills/deaths/assists/headshot százalék elemeit és a megjelenő killfeed/achievement üzeneteket. A korábbi `integration_core.js` és `advanced_integration.js` az új közös állapotot használja; megmarad az eredeti tartalék működés, ha a runtime nem indul.

**Játékverzió- és kompatibilitási profil:** a runtime a megfigyelt HTML-szelektorokból képez egy *UI-képesség-ujjlenyomatot*, jelzi a hiányzó képernyőelemeket, valamint a WebGL és Pointer Lock rendelkezésre állását. **Ez nem a Kirka.io hivatalos verziószáma.** Nem állítja, hogy olyan belső játékállapotot ismer, amelyhez a kliensnek nincs hozzáférése.

**Mélyebb WebGL-renderelési integráció:** a meglévő egyetlen korai `getContext` regiszterhez csatlakozó, passzív `render_telemetry.js` méri a játék-vászon `drawArrays`, `drawElements`, instanced draw, `bindTexture`, `clear` és `uniformMatrix4fv` hívásait. Korlátozott, mintavételezett transzformációs ujjlenyomatokat tárol helyben, és visszaállíthatja az eredeti függvényeket. **Nem képes biztosan felismerni az aktuális játék valamennyi 3D fegyverét**, mert ehhez élő Kirka-játékmenetből ellenőrzött referenciaminták kellenek. Nem jelenít meg rejtett ellenfeleket, nem módosít hitboxot, célzást, mélységi tesztet vagy szerveradatot.

**Megbízhatóbb életciklus:** a meccs-váltáskor és a DOM-csomópontok cseréjekor a közös killfeed és achievement megfigyelők leállnak és újrakapcsolódnak, így nem halmozódnak fel. Az erőforrások állapota és a kompatibilitás a már meglévő **Game Integration** menüben követhető.

A **CEF Pointer Lock** és az 1.1.15 egérjavításai megmaradtak. Az egér valódi mozgását azonban csak Windows alatt, egy élő Kirka-meccsben lehet hitelesen tesztelni. Az előző verziók minden fontos funkciója és beállítása megmarad.

## A Chrome veszélyesnek jelzi vagy blokkolja a letöltést

Az 1.1.16 változat **közvetlenül a GitHub Releases oldaláról** kínálja a két önálló kiadási fájlt, így nem kell egy GitHub Actions artifacton belül egy második ZIP-be csomagolt EXE-t letölteni:

- `KS-Client-alpha-1.1.16-Portable.zip` – önálló hordozható Windows-kliens.
- `KS-Client-alpha-1.1.16-Setup.exe` – önálló offline Windows-telepítő.
- `SHA256SUMS.txt` és `RELEASE-MANIFEST.json` – pontos fájlhash-ek és a forrás-commit.
- `SIGNING-STATUS.txt` és `CI-TEST-RESULT.txt` – tényleges aláírás- és buildellenőrzések.

A GitHub Releases használata és a SHA256 **önmagában nem garantálja, hogy a Chrome vagy a Windows engedélyezi a letöltést**. Ez utóbbiak különböző okokból tilthatnak: valódi kártékony fájl, nem kívánt programként való besorolás, aláíratlan, szokatlan vagy kevés felhasználó által letöltött bináris.

A kiadásban már támogatott az eredeti fejlesztő által hitelesen igényelt **Authenticode-kódaláírás** a `KS_SIGNING_PFX_BASE64` és `KS_SIGNING_PFX_PASSWORD` GitHub Actions titkokkal. Ha nincs hiteles kiadói tanúsítvány, a jelentés **őszintén aláíratlannak** mutatja a fájlokat. Ne adj hozzá önaláírt vagy hamis megbízható tanúsítványt, és ne kapcsold ki a Chrome Safe Browsingot vagy a Windows Defendert.

### Ha a böngésző továbbra is blokkol

1. Ellenőrizd, hogy az éppen hivatalosan elkészült `v1.1.16-alpha` GitHub Release-t használod-e, és töltsd le a `SHA256SUMS.txt`-t. Ha a böngésző más URL-t blokkol, azt külön kell kivizsgálni.
2. Tisztázd a pontos Chrome-figyelmeztetést (veszélyes, gyanús, ritkán letöltött, nem biztonságos kapcsolat). Egy valódi rosszindulatú programra figyelmeztető eredmény esetén előbb a fájl elemzése szükséges.
3. Ellenőrizd egy megbízható víruskeresővel a saját kiadás EXE- és ZIP-fájljait; nyilvános malware-ellenőrzésnél gondolj a fájl esetleges nyilvánosságra kerülésére.
4. Ha a fájl tiszta és téves riasztásról van szó, az ellenőrzött kiadó fordulhat a Chrome/Google Safe Browsing megfelelő felülvizsgálati útvonalához és az érintett antivírusgyártó false-positive csatornájához.
5. Hosszú távú, nyilvános terjesztéshez jogszerű hiteles kiadói tanúsítvány és következetes kiadási hírnév vagy a Microsoft Store megfelelő kiadási folyamata szükséges.

Google Chrome magyarázat: https://support.google.com/chrome/answer/6261569

Microsoft SmartScreen kiadói tájékoztató: https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation

## Következő, még kézi vizsgálatot igénylő mély integrációs pontok

1. CEF valós pointerlock + kamera-visszajelzés, ESC és Alt+Tab.
2. Kirka.io valódi játékfrissítés utáni DOM-kompatibilitási minták; a kliens saját figyelői sose okozzanak FPS-veszteséget.
3. 3D fegyvermodell egyértelmű, sajátfegyverre korlátozott felismerése valós renderhívások alapján; jelenleg a 3D skincsere továbbra is kalibráció- és játékverziófüggő.
4. Hivatalos Kirka API vagy fejlesztői partnerség megléte esetén az engedélyezett játékesemények használata a látható HUD helyett. **Ezt nem lehet kliensoldali hookkal pótolni.**

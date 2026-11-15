# KS Client alpha 1.1.14 – mélyebb Kirka.io-integráció

A KS 1.1.13-ra épülő kétmotoros Windows-kiadás. A korábbi overlay, Workshop, motorváltás és beállítások megmaradnak.

## Fejlesztések
- Valódi, kikapcsolható WebGL texImage2D-képhook. Csak a játék által ténylegesen feltöltött, a felhasználó által megadott pontos Kirka /assets/ kép-URL esetén cserél. A HTTPS-helyettesítő képhez CORS-támogatás szükséges.
- Kézzel kalibrált 3D transzformáció a uniformMatrix4fv mátrixának pontos azonosítója alapján: méret és X/Y/Z eltolás. Nincs automatikus fegyverazonosítás, nincs célzás- vagy mélységmódosítás.
- Korábbi CEF V8-integráció az OnContextCreated életciklusban, FrameLoadStart/End tartalékkal, Electron preload-betöltéssel, natív CEF fókuszjavítással és Pointer Lock-naplózással.
- Eredeti Kirka Join és Spectate dialógus a Quick Join-hoz és a barátlistához. Ha a Spectate gomb nem érhető el, a kliens nem indít helyette Join-t.
- Eseménykezelő: látható HUD-kill/death/assist/headshot mezők, killfeed, achievement. Profil-, barátlista-, inventory-, szerver- és market-pillanatképek csak valóban látható elemekből.
- Workshop 3D Weapon Studio felület, read-only inventory/market megjelenítés és korlátozott, elkülönített JavaScript plugin API (ks.snapshot).
- Pontos Kirka /assets/ útvonalakhoz további texture, skin, UI, audio és font mappák a Resource Swapperben. Nincs JS-, HTML-, auth- vagy API-csere.
- Opcionális, alapból kikapcsolt fagyáscsökkentő frame-yield workaround, újratöltés után aktiválódik.

## Használat és korlátok
A Workshop > Weapon Studio új 3D beállításaihoz meg kell adni az eredeti Kirka textúra pontos HTTPS URL-jét, a helyettesítő HTTPS képet, és opcionálisan az egyéni 3D mátrixazonosítót. A mátrixazonosító nélkül a kliens nem találgatja, melyik rajzolt objektum a saját fegyver.

A Kirka nem feltétlenül HTMLImageElement objektumból tölti fel a textúrákat; más WebGL-feltöltési utakat a csere nem érint. A CORS, az eszköz és a játékváltozat korlátozhatja a működést. A renderdiagnosztika a WebGL kontextus, a megfigyelt mátrixok és az elvégzett csere számát mutatja.

A marketárak kizárólag a látható oldalelemekből származnak, nem hiteles account API-árfolyamok. A bővítmények nem kapnak nyers játék-DOM-, cookie-, Node.js- vagy fájlrendszer-hozzáférést.

## Kézi valós Kirka.io tesztek (CI-vel nem helyettesíthetők)
1. CEF Pointer Lock valós meccsben: kattintás, egér eltűnése, kamera mozgatása, ESC és alt-tab utáni visszatérés.
2. Electron ugyanilyen egérvezérlése, kétirányú motorváltás.
3. Kirka fegyvertextúra WebGL-cseréje CORS-kompatibilis képpel, visszaállítás újratöltéssel; kalibrált X/Y/Z teszt.
4. Join/Spectate csak a játék saját gombjaival, hibás link visszautasítása.
5. HUD-adatok és látható események, inventory/market megbízhatósága és teljesítmény tesztje.
6. Kikapcsolt és bekapcsolt opcionális 3D és frame-yield modulok FPS/stabilitás összehasonlítása.

Az automatikus Windows CI nem igazolja önmagában a Kirka.io élő egérbefogását, teljes 3D-skinkompatibilitását vagy a marketadatok pontosságát.

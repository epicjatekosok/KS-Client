# KS Client Beta 1.0.10 – teljesen önálló Windows-verzió

A **Beta 1.0.10** teljes, új telepítésre is alkalmas kiadás. **Nincs szükség Beta 1.0.9-re vagy más korábbi KS Clientre**. Két külön kész fájlt adunk ki:

- **KS-Client-beta-1.0.10-Setup.exe** – teljes, offline Windows-telepítő. Tartalmazza mindkét böngészőmotort (Electron és CEF), a CEF .NET 10 Desktop futtatókörnyezetét, a KS indítót, a beállításfelületet, Workshopot és a szükséges fájlokat. A telepítés nem tölti le a motorokat az internetről.
- **KS-Client-beta-1.0.10-Portable.zip** – önálló, kicsomagolható változat. Bontsd ki a teljes ZIP-et egy mappába, majd indítsd el a **KS-Client.exe** fájlt. Ne csak a ZIP-ből emeld ki az EXE-t: a runtime mappák is szükségesek.

A kliens a Kirka.io játékhoz internetkapcsolatot igényel, de **a kliens telepítője maga offline**.

## Meglévő telepítés

Ha már telepítve van egy KS Client, a Setup a felismert telepítést helyben tudja frissíteni. A beállítások, böngészőprofilok, Workshop-fájlok és a felhasználói adatok megtartása a cél; nem szükséges az 1.0.9 eltávolítása vagy a beállítások törlése. A korábbi Beta 1.0.9 és 1.0.9 R2 letölthető kiadásokat nem írjuk felül.

## Kiadás és ellenőrzés

A saját, külön **v1.0.10-beta** GitHub Release a nyilvános **epicjatekosok/KS-Client-Updates** tárolóban tartalmazza a két kész Windows-fájlt, a **SHA256SUMS.txt** ellenőrzőösszegeket, a **RELEASE-MANIFEST.json** jegyzéket és a tesztjelentéseket. A forráskód csak a privát **epicjatekosok/KS-Client** tárolóban marad.

Mindkét futtatókörnyezetnek át kell mennie a Windows indítási teszteken; a ZIP integritását, a telepítő ténylegesen beágyazott csomagját és az EXE-k aláírási állapotát külön ellenőrizzük. Ha nem áll rendelkezésre valódi Authenticode tanúsítvány, az EXE **aláíratlan** marad, ezért a Windows SmartScreen figyelmeztethet. Ezt nem kerüljük meg.

## Bejelentkezés

A Beta 1.0.10 tartalmazza az Electron és CEF Google/Firebase és Discord bejelentkezési navigációjának javításait. A Kirka saját e-mail/jelszavas belépési felületét a kliens nem helyettesíti tokenkéréssel és nem irányítja a KS Settings menüjébe. A Google beágyazott OAuth-korlátozásai miatt a **valódi Google-fiókos belépés nem garantálható** automatizált helyi tesztekből; élő fiókos teszt szükséges.

A korábbi KS Client-funkciók, a két motor közötti váltás, a HUD, FPS-jelzők, Workshop Experimental, kinézeti beállítások, egérkezelés és a GitHub-frissítő a teljes csomag részei.

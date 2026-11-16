# KS Client alpha 1.1.16 – mélyebb játék-integráció

Új közös, read-only Game Runtime 2.0, Kirka felület-kompatibilitási diagnosztika, WebGL-rajzolási ellenőrzések és a meglévő funkciókat megtartó kiadás. Sikeres Windows-tesztek után a Portable ZIP és az önálló Setup EXE közvetlenül megjelenik a GitHub Releases alatt, SHA256- és tényleges aláírásjelentéssel. Ez a Chrome/Windows veszélyességi jelzéseit önmagában nem tudja garantáltan megszüntetni. Részletek és tesztelési korlátok: RELEASE_116_HU.md.

# KS Client 1.1.15 – új betöltő és egérkezelés

Az eredeti KS logóval készült, sötét-arany animáció CEF-ben és Electronban is megjelenik. A CEF egérbefogásának új natív kezelése kizárólag a játék tényleges Pointer Lock állapotát követi, és egérmozgást is naplóz. További részletek, az aláírt Windows-kiadáshoz szükséges hiteles tanúsítvány és a kézi teszt: RELEASE_115_HU.md.

# KS Client 1.1.14 – telepítési és fejlesztési tudnivalók

Az 1.1.14 a korábbi változatokat megtartva bővíti a Kirka.io-integrációt. A GitHub Actions készít offline Portable ZIP-et és külön Setup EXE-t kizárólag sikeres Windows-ellenőrzések után. A 3D skincseréhez pontos eredeti játék-textúra URL és CORS-kompatibilis kép kell. A CEF egérbefogását csak valódi játékban lehet véglegesen ellenőrizni. Részletek: DEEP_INTEGRATION_114_HU.md.

# KS Client 1.1.13 – új kiadási jelölt

A korábbi 1.1.12-re épülő mélyebb játék-integráció. A Windowsos ZIP és külön telepítő EXE kizárólag akkor keletkezik, ha a GitHub Actions mindkét motort és az offline csomagot tesztelte. Az új modulokról és az éles játékbeli egérteszt korlátairól: `DEEP_INTEGRATION_HU.md`.

# KS Client - Windowsos fordítás és ellenőrzés

Ez a ZIP **fejlesztői forráscsomag**, nem a végleges telepítő. Az alapja a korábbi **alpha 1.1.12**. A régi, a felhasználó számítógépén futó CEF-fordítás helyett a GitHub Actions Windowson fordítja és ellenőrzi a motorokat.

## Indítás programozási ismeretek nélkül

1. Lépj be a [GitHubra](https://github.com/), és hozz létre egy **Private** (privát) repositoryt, például `ks-client`. Az első használathoz a **GitHub Desktop** telepítése a legegyszerűbb, mert a GitHub weboldala önmagában nem bontja ki a ZIP-et.
2. GitHub Desktopban klónozd a repositoryt a számítógépedre. Csomagold ki ezt a forrás-ZIP-et, és **a tartalmát** másold a klónozott repository gyökérmappájába. A rejtett `.github` mappa is kerüljön át.
3. GitHub Desktopban kattints a **Commit to main**, majd a **Push origin** gombra.
4. A GitHub-repository oldalán nyisd meg az **Actions** fület. Válaszd a **KS Client - Windows verified engines** munkafolyamatot, majd a **Run workflow** gombot. (Az első `main` push is indíthatja.)
5. Négy rész jelenik meg: **Source and UI checks**, **Build and smoke test Electron**, **Build and smoke test CEF**, **Package only after BOTH engine tests pass**.
6. Ha minden lépés zöld, a futás **Artifacts** részében megjelenik a `KS-Client-Offline-Windows-CI-PASSED`. Ebben lesz a kész, kétmotort tartalmazó offline telepítő és a portable csomag. Ha bármelyik ellenőrzés piros, **nem készül ilyen csomag**: a hibás lépés naplója mutatja az okot.

## Miben más, mint a régi rendszer?

- Az **Electron** a hivatalos, előre fordított Windowsos binárisból érkezik; a GitHubon közzétett SHA-256 listával ellenőrizve.
- A **CEF / CefSharp** a GitHub Windows-futtatóján fordul, a .NET 10 Windows Desktop futtatókörnyezetet is mellécsomagolja. Nem kell a felhasználó gépén SDK.
- Mindkét motor **külön indítási önellenőrzést** kap. Sikerük után a csomagoló újból lefuttatja az ellenőrzéseket.
- Az offline telepítő kibontását és a meglévő telepítésre történő fájlcserét Windowsos Go-teszt ellenőrzi. A telepítő ezután kerül lefordításra.
- Az eltávolító és a motorválasztó meglévő forrása megmarad; alapból a **CEF** a kiválasztott motor.

## Amit a zöld CI sem garantál

A valódi Kirka.io-belépést, játékbeli megjelenítést, monitor-Hz fölötti FPS-t, felhasználói telepítőablakot, telepített alkalmazások bejegyzését és az eltávolító grafikus folyamatát **külön, tiszta Windows-gépen manuálisan ellenőrizni kell**. Ha az automatikus teszt megbukik, nincs kész kiadás. A sikeres CI egy **telepítőjelöltet**, nem igazolt végleges, nyilvánosan terjeszthető kiadást jelent.

### Fontos

A Windows CI internetet használ a GitHub, NuGet és a Microsoft hivatalos letöltéseihez, és a GitHub Actions használata a fiókod számára rendelkezésre álló futtatási időt fogyaszthatja. A teljes futtatást ebben a ChatGPT-környezetben nem tudtam elindítani; a kész forráscsomagot és a helyben lehetséges teszteket ellenőriztem. A kétmotoros telepítő nem lett ezáltal automatikusan megjavítva a gépeden.


**Alpha 1.1.12:** A CEF-hez helyben telepített .NET 10 alap- és Windows Desktop Runtime tartozik. A telepítő csak mindkét Windowsos motorteszt sikeres futása után készül el.


**Alpha 1.1.12:** a motorváltás csak a másik motor sikeres indulásának visszaigazolása után zárja be a korábbit. Az Aktív böngészőmotor állapotát ismételten ellenőrzi. A kísérleti FPS-feloldás külön gombbal is kérhető; újraindítást igényel, a monitor Hz-e fölötti FPS nem garantált.


## Alpha 1.1.12 használat
A Client > General alatt a motorváltás most a natív ablak indulására vár, és csak sikeres indulás után zárja be az előző motort. Az új motor játékoldala hálózati hiba esetén később is betölthet. A hibaüzenetek és a naplók itt találhatók: %LOCALAPPDATA%\KSClient.

A Gameplay > Performance oldalon külön látszanak a böngésző FPS-feloldási indítási kapcsolói és a mért animációs hívások. A 60/144 Hz-es érték nem jelenti automatikusan, hogy a játék GPU-val renderelt FPS-e is ennyi. A valós Kirka.io FPS-feloldás nincs igazolva.

A Windows CI külön próbát indít mindkét motorral, CEF->Electron és Electron->CEF irányban. Ez valódi natív ablakpróba, de nem helyettesíti a saját gépen végzett Kirka.io-játékbeli tesztet.


## Alpha 1.1.12 motorváltás
A Client > General > Electron gomb most tartalék váltási útvonalat használ, ha a CefSharp JavaScript-híd nem válaszol. Egy helyben, natívan elfogott URL-es jelzés kezdeményezi a váltást a Kirka.io oldalról; a játékoldal nem navigál el. A CI a tényleges CEF JavaScript->C# üzenetküldést külön teszteli. Ha a váltás nem sikerül, ellenőrizd az indítási naplót a %LOCALAPPDATA%\\KSClient mappában; Ctrl+Alt+E közvetlen váltási lehetőség.


### Alpha 1.1.12
- Az egérbefogás most az Electron és CEF natív engedélykezelőjét is használja. A játék vásznára KATTINTVA kérhető Pointer Lock. ESC felszabadítja az egeret. F1: KS beállítások.
- Gameplay → Game Integration: opcionális billentyűkijelzés, HTML játékstatisztika, hitmarker-szín/maximum méret, ellenőrzött Kirka.io játéklink és képernyőkép.
- Screenshot: Képek/Pictures/KSClient. A CEF a képernyőn látható böngészőterületet fényképezi, takarás esetén más ablak is rákerülhet.
- A mély WebGL fegyvercsere, a külső JS-modok, Discord RPC és automatikus frissítés még nincsenek megvalósítva. A játékbeli HUD függ a Kirka.io HTML-kódjától.


### Alpha 1.1.12 – Workshop
A külön Workshop menüben fegyverszínek és helyi weapon/skin előnézetek, szobapresetek, kedvenc szobák, játékosjegyzetek, inventory-kedvencek és kézzel megadott piacárbecslések találhatók. A Resource Swapper a Dokumentumok/KSClient/Swapper/assets/{img,media,css} mappában lévő, a Kirka.io pontos /assets útvonalának megfelelő fájlokat cserélheti Electronban és CEF-ben. A JavaScript-bővítmények nem a játékban, hanem elkülönített, hálózattól és fióktól elválasztott sandbox-előnézetben futnak, és csak a korlátozott ks.message/ks.tint API-t használhatják. A WebGL 3D fegyvertextúrák cseréjét ez a verzió nem garantálja. A játék látható HTML-je verziónként változhat, a funkciókat élő meccsben ellenőrizni kell.

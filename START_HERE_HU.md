# KS Client - Windowsos fordítás és ellenőrzés

Ez a ZIP **fejlesztői forráscsomag**, nem a végleges telepítő. Az alapja a korábbi **alpha 1.1.8**. A régi, a felhasználó számítógépén futó CEF-fordítás helyett a GitHub Actions Windowson fordítja és ellenőrzi a motorokat.

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


**Alpha 1.1.8:** A CEF-hez helyben telepített .NET 10 alap- és Windows Desktop Runtime tartozik. A telepítő csak mindkét Windowsos motorteszt sikeres futása után készül el.


**Alpha 1.1.8:** a motorváltás csak a másik motor sikeres indulásának visszaigazolása után zárja be a korábbit. Az Aktív böngészőmotor állapotát ismételten ellenőrzi. A kísérleti FPS-feloldás külön gombbal is kérhető; újraindítást igényel, a monitor Hz-e fölötti FPS nem garantált.

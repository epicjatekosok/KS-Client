# KS Client Beta 1.0.3 – frissítő és új megjelenés

A Beta 1.0.3 a Beta 1.0.2 funkcióira épül. A Kirka.io játékbeli integráció, a Google-hitelesítési javítás, az egér, az FPS, a HUD, a Workshop, a motorváltás és a korábbi beállítások működéséhez nem nyúlunk.

## Frissítéskeresés

- A korábbi Electron-folyamat a GitHub lekérdezést 20 másodperc után megszakíthatta, így a kliens csak időtúllépést jelzett. Az ellenőrzés most hosszabb, de továbbra is korlátozott határidőt kap.
- A nyilvános `epicjatekosok/KS-Client-Updates` tárolóból kisebb kiadáslistát kérünk, átmeneti hálózati hibára egyszer ismétlünk.
- A HTTPS-ellenőrzés, GitHub-host-ellenőrzés, pontos kiadási fájlnév, méretkorlát és SHA-256 alapú telepítőhitelesítés változatlan marad.
- A hálózati probléma esetén a felület érthető hibaüzenetet ad és a GitHub Releases oldal kézi megnyitását is támogatja. Hálózati letiltást vagy tartós elérhetetlenséget egy kliensoldali javítás nem tud megszüntetni.

## 13 teljes menüszín-paletta

Amber, Ember, Ice, Forest, Violet, Midnight, Ocean, Crimson, Cyber, Rose, Sand, Monochrome és Copper. Az új palettaválasztó színmintákat mutat, és mind az öt KS Client felületszínt állítja: akcentus, háttér, panel, főszöveg, másodlagos szöveg.

**Extra visual effects** (kizárólag KS Settings): Solid/Frosted/Neon felület, háttérminta (None/Grid/Dots), kényelmes/kompakt/tágas menüsűrűség, állítható sarkok és ragyogás. A Custom mód, az egyéni színválasztás és a korábbi beállítások megmaradnak.

## Egységes megjelenés

- **Electron betöltőképernyő**: modern sötét-narancssárga kártya, eredeti logó, animált gyűrű, folyamatjelző.
- **CEF betöltőképernyő**: WinForms megfelelője az új menüstílusban. Nem hoz létre új böngészőt, nem változtatja a játék egérkezelését.
- **Setup, eltávolító, frissítő**: közös KS natív felület, borostyán akcentus, egységes fejléc, állapot- és haladásjelző. Az ellenőrzés, telepítés, rollback, adatmegőrzés és eltávolítás működése nem változik.

## Nyilvános forráskód

A bináris frissítéseket tartalmazó `KS-Client-Updates` nyilvános. A Beta 1.0.3 kiadásban a `KS-Client-beta-1.0.3-Source.zip` **nyilvános forráskód-pillanatképet** is tartalmaz: az aktuális commit fájljait, Git-előzmények, privát kulcsformátumok és helyi felhasználói profilok nélkül. Ehhez külön SHA-256 ellenőrzőfájl tartozik. Az archívum nem biztosít GitHub issue/PR vagy teljes történet hozzáférést.

A `KS-Client` forráskódtár láthatósága GitHub repository adminisztrációs művelet; a kiadási workflow nem kapcsolhatja át a jogosultságokat. A GitHub tulajdonosa a tároló **Settings → General → Danger Zone → Change repository visibility → Make public** menüben állíthatja át, miután a repository teljes commit-történetéből eltávolított minden véletlenül bekerült kulcsot vagy személyes adatot. A kiadásokban nem lehet titkos hitelesítési kulcs.

## Tesztelés

Kétmotoros szintaxis, Chromium-UI, színpaletta-váltás, megjelenési beállítások mentése, frissítő időzítése, Windows CEF/Electron indítás, motorváltás, telepítő és SHA-256. A GitHub CI sikeressége nem helyettesíti a külön Windowsos felhasználói tesztet.

**Verzió:** Beta 1.0.3 (tag: `v1.0.3-beta`). A korábbi 1.0.2/1.0.1/1.0.0 kiadások külön maradnak.

# KS Client alpha 1.1.19 – Automatikus frissítések

## Újdonságok

- **Updates** beállítások: kézi ellenőrzés, automatikus keresés, opcionális automatikus letöltés, Alpha/Stable csatorna.
- Az Electron és a CEF **ugyanazt a natív Go frissítéskezelőt** használja, a játékoldal nem állíthat be tetszőleges letöltési URL-t.
- A Windowsos KS Client launcher letölti a későbbi kiadások teljes Setup.exe fájlját, ellenőrzi a GitHub Release megadott SHA-256 azonosítóját és az EXE szerkezetét.
- A felhasználó kérésére a frissítő külön segédfolyamatban indul, megvárja a játék bezáródását, majd elindítja a meglévő offline telepítőt.
- A már telepített és a ZIP-ből kibontott változat a **saját helyén** frissül. A meglévő profilokat, beállításokat, Workshop-adatokat, Resource Swapper fájlokat és motorválasztást nem törli.
- A jelenlegi frissítés **soha nem települ automatikusan jóváhagyás nélkül**. Az automatikus letöltés külön kapcsolható ki.
- A meglévő CEF/Electron funkciókat, HUD-ot, FPS-, szemkímélő és összes játékbeállítást megőriztük.

## Honnan érkeznek a későbbi frissítések?

A projekt forráskódja a privát `epicjatekosok/KS-Client` GitHub repositoryban marad. A nyilvános, bejelentkezés nélkül frissülő Windows kliensekhez **külön nyilvános repositoryt kell létrehozni** `epicjatekosok/KS-Client-Updates` néven. Az ottani GitHub Releases oldalon kizárólag a Windows ZIP/EXE és a SHA256/kiadási adatfájlok jelennek meg, forráskód nélkül.

A privát forrás-repository Actions secrets részében a `KS_PUBLIC_RELEASE_TOKEN` nevű, kizárólag a külön nyilvános kiadási repositoryra Contents read/write jogú fine-grained hozzáférést kell felvenni. Ezután a sikeres Windows build a privát kiadás mellett a nyilvános kiadásba is feltölti ugyanazokat az ellenőrzött fájlokat. Amíg ez a két GitHub-beállítás nincs meg, **a kliensben az automatikus ellenőrzés elérhetetlen tárolót jelez, és nem tölthet le frissítést.**

Az 1.1.19 a frissítő első kiadása: ha később megjelenik az 1.1.20, azt tudja a kliensből keresni és telepíteni.

## Ellenőrzési korlátok

A GitHub Windows CI ellenőrzi a fordítást, az Electron és CEF indulását, a natív motorváltást, a telepítőt, valamint a frissítőparancs helyi JSON-válaszát. Az élő Kirka.io-meccsben végzett teszt, a hálózati letöltés és az újraindítással járó végfelhasználói frissítés külön kézi próbát igényel.

Az SHA-256 integritási ellenőrzés **nem azonos digitális kiadói aláírással**. A nyilvános terjesztéshez továbbra is valódi Authenticode tanúsítvány javasolt.
## GitHub Actions tárhelyre vonatkozó megjegyzés

Az 1.1.19 Windows-kiadás a forrásellenőrzés után **egyetlen Windows-feladaton** fordítja és ellenőrzi mindkét motort. A ZIP és EXE közvetlenül a GitHub Releases oldalra kerül, nem igényel nagy, köztes GitHub Actions Artifacts-tárhelyet. Ez nem hagyja ki az Electron, CEF, bridge, motorváltás, telepítő, SHA-256 és aláírásellenőrzési lépéseket.

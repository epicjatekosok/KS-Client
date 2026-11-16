# KS Client alpha 1.1.21 – beállítások, frissítés és diagnosztika

## Javítások

1. **Eltűnő beállításmenü (Electron és CEF):** a diagnosztikai modul korábban nem létező CPU-/memóriaértékeken `toFixed()` műveletet végzett, így a menü kirajzolása JavaScript-hibával megszakadhatott. Az 1.1.21 a hiányos adatokat kötőjellel jeleníti meg, és akkor is nyitva tartja a beállításpanelt, ha egy másik menüelem hibát jelez. A fogaskerék és az F1 billentyű nem függ a natív statisztikák elérhetőségétől.
2. **Advanced Diagnostics:** Electronban a valódi alkalmazás- és alfolyamatmérők CPU-, memória- és folyamatinformációit használjuk. CEF-ben külön Windowsos adatgyűjtő méri a gazdafolyamatot és a közvetlenül hozzá tartozó CefSharp-alfolyamatokat. Az első CPU-minta lehet 0, a hiányzó mérés `—`. Nem állítjuk, hogy ezek a Kirka.io tényleges GPU FPS-értékei.
3. **Alapértelmezett motor:** új profilban **Electron**. Ha a felhasználó kifejezetten CEF-et választott és ezt a kliens korábban elmentette, a választás változatlan marad. A motorváltás továbbra is működik.
4. **Hitmarker és Colored Killfeed:** a nem működő kapcsolók és a hozzájuk tartozó szín-, méret- és képbeállítások kikerültek a Game Integration menüből. Az elavult HTML/CSS-effektek is kikerültek. A keystrokes, statisztikák, Quick Join és képernyőkép funkciók megmaradnak. Az új verzió csak ezeket az eltávolított opciókat törli a korábbi mentett profilból.
5. **Frissítéskeresés:** rövidebb, megbízható időkorlátok, vég nélküli keresés esetén hibaüzenet, valamint **Open GitHub Releases (manual)** gomb a kézi letöltéshez. A teljesen automatikus letöltés csak akkor működhet, ha a hivatalos nyilvános kiadási tárhely valóban elérhető.

## A GitHub-frissítések külön feltétele

A jelenlegi `epicjatekosok/KS-Client` forrás-repository privát, a kliens pedig **nem tartalmazhat beégetett hozzáférési tokent**. A felhasználók számára automatikusan letölthető kiadásokhoz a tulajdonosnak külön nyilvános GitHub-repositoryt kell létrehoznia `epicjatekosok/KS-Client-Updates` néven, és a privát `KS-Client` GitHub Actions Secrets alatt beállítania a `KS_PUBLIC_RELEASE_TOKEN` titkot (Contents: read/write jogosultság **csak** a nyilvános kiadási repositoryra). Ezután új kiadáskor a CI képes ellenőrzött ZIP, EXE, SHA256 és kiadási metaadatokat közzétenni. A GitHub tokent nem szabad a kliensbe, a repositoryba vagy a chatbe másolni.

Amíg ez nincs beállítva, a beépített automatikus frissítés nem tud valódi csomagot letölteni – ez kiadási hozzáférési korlát, nem hálózati optimalizációs hiba. A kézi GitHub Releases gomb működik a privát repositoryhoz hozzáféréssel rendelkező, bejelentkezett felhasználóknak.

## Kiadási ellenőrzések

Windowsos Electron/CEF indítás, CEF híd, motorváltás, forrás- és böngészőtesztek, frissítőtesztek, offline ZIP és Setup.exe kicsomagolási és frissítési tesztek. Az élő Kirka.io egérbefogás és valós játékbeli diagnosztika továbbra is manuális tesztet igényel.

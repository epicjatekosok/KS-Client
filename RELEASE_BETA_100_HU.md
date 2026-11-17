# KS Client Beta 1.0.0 – Új kiadási csatorna, egységes HUD és automatikus frissítések

A KS Client ezzel a kiadással kilép az Alpha-verziósorozatból. Az új kiadás: **KS Client Beta 1.0.0**.

## Vizuális egységesítés

- Az FPS-számláló ugyanazt a fekete, lekerekített, narancssárga szegélyű KS-stílust használja, mint a bal felső fogaskerék és KS Discord-gomb. Alapértelmezésben továbbra is kikapcsolva marad.
- A játékbeli Keystrokes overlay és a HTML-ből olvasható statisztikák ugyanilyen sötét-narancssárga kártyás megjelenést kaptak, a játék inputját nem fedik el.
- A szemkímélési/pihenőemlékeztető is egységes lett. A beállításmenü jobb felső X gombja is azonos megjelenést és hover/focus állapotot használ.
- A **Workshop** főmenüpont és a saját aloldalai feltűnő **EXPERIMENTAL · BETA** címkét kapnak: ezek tesztelés alatt álló funkciók.

## Frissítések – működő publikus kiadási tárhely

Az 1.1.23-ban beállított **epicjatekosok/KS-Client-Updates** repository nyilvános, és GitHub Releases formában már ténylegesen szolgál ki ellenőrzött telepítőket. A Beta 1.0.0 kiadás készíti el a `v1.0.0-beta` GitHub Release-t, `KS-Client-beta-1.0.0-Portable.zip` és `KS-Client-beta-1.0.0-Setup.exe` fájlokkal, SHA-256 ellenőrző összegekkel és kiadási jegyzetekkel. A `KS-Client` teljes forráskódja továbbra is privát.

Új profilokban a Beta frissítési csatorna van beállítva: automatikus ellenőrzés és ellenőrzött háttérletöltés aktív. A **telepítéshez továbbra is felhasználói jóváhagyás kell** (nem zárjuk be a meccset váratlanul). A felhasználó kézzel is használhatja a **Check for updates** és **Install update & restart** gombokat. Az **Open GitHub Releases (manual)** már a nyilvános, bejelentkezés nélküli kiadási oldalra nyit.

A régi Alpha 1.1.23 frissítője még nem ismeri a Beta végződést. Ezért kiadunk egy egyszeri, külön Alpha-kompatibilitási hidat `v1.1.24-alpha` taggel, amely a **már ellenőrzött Beta 1.0.0 EXE-telepítőjét** szolgálja ki, változatlan SHA-256 lenyomattal. Így a régi kliens a meglévő automatikus/frissítéskeresési mechanizmussal is eljuthat a Beta kiadásig. A híd nem egy külön fejlesztési verzió, és az új Beta-kliens soha nem tekinti újabb Beta-frissítésnek. Ez a megoldás a korábbi felhasználók migrációját szolgálja.

## Tesztelés

A Windows build forrás-, Chromium UI-, Electron-, CEF-, motorváltó-, verzióválasztó-, SHA-256-, offline ZIP-, telepítő- és kiadásellenőrzéseket végez. A nyilvános GitHub API-hoz névtelenül hozzáférő frissítést külön ellenőrzi. A tényleges Kirka.io játékbeli teszt és a felhasználói Windows-gépen történő átállás továbbra is manuálisan ellenőrizendő.

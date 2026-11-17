# KS Client – Alpha → Beta frissítési kompatibilitás

Ez **nem egy új Alpha-fejlesztési kiadás**. Az Alpha 1.1.23 és korábbi kliensek frissítője még kizárólag `-alpha` taggel ellátott kiadásokat tud felismerni, ezért a Beta 1.0.0 automatikus megtalálásához szükséges egy átmeneti kompatibilitási híd.

A `KS-Client-alpha-1.1.24-Setup.exe` **bitre azonos** a `v1.0.0-beta` kiadás ellenőrzött, `KS-Client-beta-1.0.0-Setup.exe` fájljával. A két feltöltés SHA-256 összege azonos. A telepítő valódi verziója **KS Client Beta 1.0.0**, nem Alpha 1.1.24.

A híd a meglévő beállításokat, a két motort és a Workshop-fájlokat megőrzi. A Beta kliens ezt a hidat az alacsonyabb Alpha-csatorna miatt már nem ajánlja fel frissítésként.

A normál, közvetlenül letölthető Beta-kiadás: https://github.com/epicjatekosok/KS-Client-Updates/releases/tag/v1.0.0-beta

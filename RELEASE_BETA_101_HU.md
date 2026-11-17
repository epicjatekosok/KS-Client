# KS Client Beta 1.0.1 – Kirka bejelentkezési ablakok és testreszabás

A Beta 1.0.1 a Beta 1.0.0 alapjaira épül; a CEF és Electron motor, a Workshop, az FPS/HUD, a beállítások és az automatikus frissítés továbbra is megmarad.

## Kirka-fiókba való belépés

- **Electron:** a korábbi összes-felugróablakot-tiltó szabály helyett a Kirka által indított, ellenőrzött HTTPS OAuth-hitelesítési ablakok megnyílhatnak.
- **CEF:** a hitelesítési szolgáltatók saját popup-navigációja és visszairányításai többé nem esnek a játékoldalakra vonatkozó tiltás alá.
- A bejelentkezési ablakok a játék böngészőprofilját használják; az `window.opener` kommunikáció és a munkamenet-cookie-k kezelését nem tiltjuk.
- A helyi fájlokhoz, a Node.js-hez, illetve az ellenőrizetlen külső oldalakhoz továbbra sem adunk hozzáférést. A Discord gomb változatlanul a jóváhagyott meghívólinket nyitja.

**Szolgáltatói korlátozás:** a Google egyes OAuth-bejelentkezéseket szabályzata alapján megtagadhat beágyazott böngészőkben (`disallowed_useragent`). A KS Client nem hamisít böngészőazonosítót és nem kerüli meg a szolgáltató védelmét. Az éles Google-, Facebook- és más szolgáltatói folyamatok Windows-alapú felhasználói tesztje szükséges; a javítás a kliens saját popup-tiltását oldja fel.

## Témák és testreszabás

- A témapresettek, egyéni akcentus, háttér, panel, fő- és másodlagos szövegszín kihatnak a KS Settings és HUD eddig rögzített színű elemeire is.
- Az egyéni akcentus kiválasztásakor automatikusan a Custom téma lép életbe.
- Javított betűtípus-/betűméret-alkalmazás és olvasható szövegkontraszt; hibás hex színek elutasítása.
- A változatlan profilok eredeti sötét-narancssárga Beta kinézete megmarad. A mentett beállítások és helyi erőforrások nem törlődnek.

## Kiadás és frissítés

Verzió: **Beta 1.0.1**, GitHub tag: `v1.0.1-beta`. A különálló Portable ZIP és Setup EXE továbbra is a nyilvános **epicjatekosok/KS-Client-Updates** kiadási tárolóba kerül, SHA-256 ellenőrzéssel. A Beta 1.0.0 és a régi Alpha → Beta átállási híd változatlanul elérhető marad.

A CI-szintű forrás- és Windows build ellenőrzés nem helyettesíti az élő Kirka.io bejelentkezési tesztet.

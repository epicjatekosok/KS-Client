# KS Client Beta 1.0.2 – Google sign-in handoff

## Mi javult?

A Beta 1.0.1 már megnyitotta a Google-belépést, de a Google-fiók kiválasztása után a játék nem mindig kapta meg a hitelesítés eredményét.

A Beta 1.0.2 célzottan javítja a böngészőn belüli OAuth-adatátadást:

- **Electron**: a Google-fiókválasztóból induló, ellenőrzött HTTPS bejelentkezési alablakok is működhetnek; a korábbi teljes tiltás megszűnt. A natív `window.opener` kapcsolat és a játék böngészőprofilja megmarad.
- **Google/Firebase átirányítások**: a megszokott Google-hitelesítési és Firebase callback domainek engedélyezettek. A Kirka saját `*.kirka.io` aldomainjeire történő hitelesítési visszalépés is kezelhető.
- **Tárolóhoz való hozzáférés**: az Electron a hitelesítési folyamat szükséges `storage-access` / `top-level-storage-access` kéréseit csak a Kirka vagy jóváhagyott bejelentkezési ablak és az ellenőrzött HTTPS-eredet esetén engedélyezi.
- **CEF**: a provider popup kezdeti `about:blank` navigációja és a Google/Firebase visszairányítások célzott kezelést kapnak.
- **Diagnosztika**: az elutasított vagy hibás OAuth-navigációk címtartományát és útvonalát rögzíthetjük, de nem írjuk naplóba a hitelesítési URL query paramétereit, tokeneket vagy email-címeket.

## Biztonság

A Node.js hozzáférés, a sandbox, a `webSecurity`, a játékhoz tartozó URL-korlátozások, és az előző kiadásokban készült funkciók változatlanul védettek. A bejelentkezéshez nem gyűjtünk Google-jelszót, nem cserélünk ki OAuth-tokeneket natív kóddal, és nem hamisítjuk meg a böngészőazonosítót.

## Tesztelés és ismert korlát

Új automatikus teszt ellenőrzi a fiókválasztó utáni második popupot, a Firebase/Kirka visszairányítást, a nem biztonságos címek tiltását, valamint a tárolóengedélyek korlátozását. Ez **szimulált folyamat**, nem éles Google-fiókba történő bejelentkezés.

A Google és a Kirka szerveroldali szabályait a kliens nem tudja megváltoztatni; emiatt éles Google- és Kirka-fiókos Windows-teszt továbbra is szükséges a siker garantálásához.

## Kiadás

Verzió: **Beta 1.0.2** (`v1.0.2-beta`). A Windows Portable ZIP és Setup EXE külön, ellenőrzött kiadásként jelenik meg a nyilvános `epicjatekosok/KS-Client-Updates` tárolóban. A korábbi Beta 1.0.0 és Beta 1.0.1 letöltések változatlanul megmaradnak. Az automatikus és a manuális frissítő új verzióként ismeri fel az 1.0.2-t.

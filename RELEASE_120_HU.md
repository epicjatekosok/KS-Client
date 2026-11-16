# KS Client alpha 1.1.20 – modernebb beállítások és Discord-közösség

## Újdonságok

1. **Újratervezett beállításmenü:** nyugodtabb sötét felületek, visszafogott arany kiemelések, egységesebb betűméretek, jobb tagolás és konzisztens kártyák/kapcsolók. A menü a kisebb ablakokhoz is alkalmazkodik, és a billentyűzetes fókusz jobban látható.
2. **Gyors keresés:** a Settings bal oldali sávjában kategóriák, almenük és gyakori beállításnevek alapján kereshetsz. A találatra kattintva a megfelelő meglévő lap nyílik meg. Az összes eredeti menüpont és kapcsoló továbbra is elérhető.
3. **Kevésbé feltűnő verziójelzés:** az alsó bal sarokban a korábbi, erős színű doboz helyett apró, áttetsző `KS · 1.1.20` felirat látható, 7 px bal és 5 px alsó margóval. A korábbi HUD-ki/be beállítás változatlan.
4. **KS Client Discord:** a Kirka.io oldalán lévő, Discordnak azonosított gomb kattintása a `https://discord.gg/cxP386yGjk` meghívót nyitja az alapértelmezett külső böngészőben. Az eredeti Kirka.io játékablakot nem navigálja el. A natív CEF/Electron híd csak a rögzített, felhasználó által megadott URL-t nyithatja, tetszőleges JS URL-t nem.
5. **Megőrzött funkciók:** FPS-beállítások, Game Integration, Workshop, skin és Resource Swapper lehetőségek, profilok, Eye Comfort, CEF/Electron motorváltás és az 1.1.19-es frissítéskezelő változatlanul elérhető.

## Kiadás

A GitHub Actions a forrás-, böngészős UI-, Electron-, CEF-, motorváltási, offline telepítő- és ellenőrző teszteket követően készítheti el az egyben letölthető Portable ZIP-et és a külön Setup.exe fájlt. A publikálás ugyanazt a privát GitHub Releases kiadást és az előző verzióban bevezetett opcionális nyilvános frissítési tárhelyet használja.

**Tesztelési korlát:** a böngészős automatikus tesztek nem helyettesítik a Kirka.io élő meccsében és éles oldalszerkezetén végzett manuális ellenőrzést; különösen a Discord-gomb változó HTML-kódja és az egérbefogás vizsgálandó.

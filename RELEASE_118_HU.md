# KS Client alpha 1.1.18 – beállítások, FPS és HUD javítás

## Változások

1. A beállítások gyorsgombja kizárólag egy **⚙ fogaskerék** a **bal felső sarokban**, a Settings felirat nélkül. A teljes beállításpanel és az F1 gyorsbillentyű továbbra is működik.
2. Az FPS-számláló új felhasználói profilban **kikapcsolt**. Bekapcsolva az alapértelmezett bal felső pozícióban **a fogaskerék alatt** jelenik meg. A már elmentett FPS- és pozícióbeállítások változatlanok, a további elhelyezési opciók megmaradtak.
3. Electronban (és CEF-ben is) a fogaskerék **mindig megmarad** fegyverválasztás és meccsindítás után. A játékoldal HTML-törzsének újraépítésekor a meglévő beállításfelületet visszahelyezzük, újra-inicializálás nélkül. Pointer Lock alatt is látható, az ESC feloldja a kurzort a kattintáshoz.
4. A **„Kirka HUD data not exposed as HTML”** szöveg a KS Client korábbi játékstatisztikai helyőrzője, nem a Kirka.io hibája. Ha a Kirka nem ad HTML-ben statisztikát, az opcionális HUD-panel eltűnik; ha ad kill, death, assist vagy headshot adatot, a panel továbbra is mutatja.
5. Az Electron és CEF ugyanazokat a felület- és statisztikai javításokat használja. Más meglévő funkciót nem távolítottunk el.

## Kiadás és ellenőrzések

A GitHub Actions a két Windows-motor sikeres valódi indítási, bridge- és átváltási ellenőrzése után készíti el a teljes **Portable.zip** csomagot és a különálló **Setup.exe** telepítőt. A telepítő a teljes ZIP-et beágyazza, külön ZIP nélkül is telepít.

Az automatizált szimulált böngészőteszt nem igazolja a Windows alatti élő Kirka.io-meccset, ezért éles játékban mindkét motorral kézi ellenőrzés szükséges. Az aláírási és böngészős SmartScreen-jelzések státusza külön fájlban található.
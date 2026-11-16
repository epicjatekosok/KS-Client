# KS Client alpha 1.1.22 – Teljes gamer-stílusú menü és CEF stabilitás

Az új kiadás a felhasználó által küldött fekete-narancssárga gamer beállításképernyő vizuális mintájára készült. Nagyméretű KS-logós Settings fejléc, vonalas ikonos oldalsáv, narancssárga nyílformájú aktív menüpont, grafikai presetkártyák, összetartozó opciókat tartalmazó sötét kártyák, kapcsolók, legördülő listák, geometriai háttér és működő Reset / Cancel / Apply sáv.

Grafika: Performance, Frame Stability, Browser Graphics, Browser GPU Info. Kijelző: Display, Eye Comfort, Crosshair. Játékmenet: Game Integration, Lobby, Friends & Profiles. Workshop: Weapon Studio, Resource Swapper, Plugins, Inventory & Market. Vezérlés: Browser Controls. Felület: Appearance, Interface, Resources, CSS Editor. Haladó: General, Updates, Sharing, Diagnostics.

A Low, Medium és High grafikai kártyák a korábban is létező Low, Balanced és High Performance profilokat kapcsolják; nem állítanak be nem támogatott Kirka grafikai értékeket. A Cancel a KS Client beállításait a menü megnyitásakor mentett állapotba állítja vissza; a Workshop külön mentett adatai azonnal mentődnek.

A Discord-meghívó fix címe: https://discord.gg/cxP386yGjk . A KS Discord saját gombjai, a Kirka Discord-linkek és a natív Electron/CEF böngésző-navigáció/popup figyelés a Windows alapértelmezett HTTPS-böngészőjében nyitják meg az oldalt, szükség esetén új böngészőablakkal. A kliens státuszt mutat a Windows linkkezelő indításáról.

A képen látható CefSharp.IFrame disposed kivételt úgy javítottuk, hogy a késleltetett WinForms hívások már nem tartalmaznak IFrame hivatkozást: az URL-t időben kimásoljuk egy szövegváltozóba. A CEF-eseménykezelőket IsValid ellenőrzés és ObjectDisposedException-védelem egészíti ki.

A ZIP és EXE kiadás csak a teljes automatikus tesztsor sikeres lefutása után kerül publikálásra. Az élő Kirka.io játékbeli viselkedés külön tesztelendő. A teljesen automatikus frissítéshez a külön nyilvános KS-Client-Updates binary-only kiadási tárhely továbbra is szükséges; az nem helyettesíthető privát GitHub-token beégetésével.

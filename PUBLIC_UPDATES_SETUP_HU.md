# Frissítési tárhely állapota – KS Client Beta 1.0.0

**A nyilvános frissítési tárhely már működik.** A `https://github.com/epicjatekosok/KS-Client-Updates` repository publikus, és az Alpha 1.1.23 ellenőrzött ZIP/EXE kiadása bejelentkezés nélkül elérhető. A privát `KS-Client` repositoryban beállított `KS_PUBLIC_RELEASE_TOKEN` titokkal a GitHub Actions sikeresen publikálta a nyilvános kiadást. A Beta 1.0.0 kiadásnál ugyanezt az eljárást használjuk, és az Alpha-klienssel kompatibilis egyszeri frissítési hidat is ellenőrizzük.

**A lenti pontok ezentúl új tárhely létrehozásához vagy a lejáró token cseréjéhez szükséges útmutatóként szolgálnak.** Nem kell újra létrehozni a működő repositoryt.

---

# KS Client – nyilvános automatikus frissítés beállítása

**Miért nem működik a jelenlegi Check for updates?** A kliens a `https://api.github.com/repos/epicjatekosok/KS-Client-Updates/releases` nyilvános API-t olvassa. A `epicjatekosok/KS-Client-Updates` tároló jelenleg 404-et ad, vagy nem nyilvános. Eközben a valódi binárisok a **privát** `epicjatekosok/KS-Client` GitHub Releases felületén vannak. A GitHub nem engedi azonosítás nélkül letölteni a privát kiadási fájlokat, a kliensbe pedig **nem biztonságos privát hozzáférési tokent építeni**.

## Egyszeri beállítás a GitHub webfelületén

1. Nyisd meg a **https://github.com/new** oldalt. Tulajdonos: `epicjatekosok`; repository name: **KS-Client-Updates**; láthatóság: **Public**. Jelöld be az „Add a README file” opciót, hogy legyen `main` ága. Csak kiadási telepítőfájlokat és rövid ismertetőt tegyél ide; a privát forráskód maradjon a KS-Client tárolóban.
2. GitHub → Settings (profilod) → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token. Repository access: **Only select repositories** → `KS-Client-Updates`. Repository permissions: **Contents = Read and write** (Metadata read az alapérték). Adj rövid lejáratot, és azután újítsd meg időben.
3. Privát **epicjatekosok/KS-Client** → Settings → Secrets and variables → Actions → **New repository secret**. Név: `KS_PUBLIC_RELEASE_TOKEN`. Érték: a korábbi lépésben készített token. **A tokent soha ne oszd meg chatben és ne commitold forráskódba.**
4. Privát **KS-Client** → Actions → **Build Windows Client** (Windows build workflow) → **Run workflow** a `main` ágon. Ez újra ellenőrzi az alkalmazást és publikálja a verziózott Portable ZIP-et, Setup EXE-t, SHA256SUMS fájlt, integritási metaadatokat a privát forrástároló Releases oldala mellett a külön **nyilvános** tárolóban is.
5. Ellenőrizd inkognitóablakból: `https://github.com/epicjatekosok/KS-Client-Updates/releases/tag/v1.1.23-alpha`. A `https://api.github.com/repos/epicjatekosok/KS-Client-Updates/releases?per_page=40` címnek bejelentkezés nélkül JSON-t kell adnia. Ellenőrizd, hogy az `KS-Client-alpha-1.1.23-Setup.exe` állapota `uploaded`, van `sha256:` digestje, és a bináris letölthető.
6. A kliens **Check for updates** funkciója ezután már eléri az új, nyilvános kiadásokat. A kliens csak az aktuálisnál **újabb**, ellenőrzött verziót ajánlja fel; az 1.1.23 futtatása esetén a következő 1.1.24 vagy frissebb kiadásnál fog új letöltést jelezni.

## Miért nem tudtam ezt pusztán klienskóddal megoldani?

A privát GitHub-forrás nem nyilvánosan letölthető. Egy **új nyilvános repository létrehozása** és egy GitHub Actions titok beállítása a tulajdonos adminisztrációs művelete; a jelenlegi GitHub-kapcsolat nem biztosít számomra repository-létrehozó vagy titokbeállító jogosultságot. Ezek nélkül a kliens nem tud anonim binárisokat letölteni. A 1.1.23 ettől függetlenül használható a kézi Releases letöltési gombbal.

## Kiadási biztonság

A frissítő kizárólag a rögzített nyilvános GitHub-tároló HTTPS-címét fogadja el, összeveti a verziót, az eszköz pontos fájlnevét, méretét, GitHub által közölt SHA-256 digestjét és a helyben kiszámolt hash-értéket, majd a felhasználó jóváhagyásával telepít. A GitHub-címeket és fájlneveket a Kirka.io oldala nem módosíthatja. A kézi link a privát forrástárolóhoz visz, amelyhez bejelentkezés és jogosultság kell.


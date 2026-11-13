# KS Client – Windows CI javítás (CEF helyi .NET futtatókörnyezet)

Alap: az eredeti, GitHubra feltöltött `KS-Client-Windows-CI-Source` csomag (KS Client alpha 1.1.6 forrása). **Nem új kiadás és nem kész Setup EXE.**

## Javított fájlok

- `ci/Build-CEF.ps1`: a Windows Desktop runtime mellett a teljes alap .NET Runtime-ot is a `runtime/CEF/dotnet` mappába telepíti. Ellenőrzi a `dotnet.exe`, a hostfxr és a két shared runtime meglétét. A .NET 10-es apphostot úgy publikálja, hogy közvetlenül indítva is a csomagban lévő `dotnet` mappát keresse, ne a felhasználó gépén levő .NET telepítést.
- `ci/Test-Engines.ps1`: ellenőrzi a teljes helyi futtatókörnyezet lényeges részeit a CEF indítási tesztje előtt.
- `ci/check_source.py`: a CI forrásellenőrzésében teszteli, hogy a helyi .NET host és a relatív futtatókörnyezet kereséséhez szükséges lépések ne maradjanak ki a jövőben.

Az Electron kódja, a CEF kezelőfelülete, az alkalmazás beállításai és az offline telepítő forráskódja nem változott.

## Feltöltés a meglévő privát GitHub repositoryba

1. GitHub Desktop → **Repository → Show in Explorer**.
2. Bontsd ki ezt a ZIP-et; a **benne lévő fájlokat és mappákat** másold a helyi `KS-Client` repository főmappájába, és engedélyezd a felülírást. A `.github` mappa a repository gyökerében legyen.
3. GitHub Desktopban ellenőrizd a módosításokat, majd Summary: `Fix CEF bundled .NET runtime` → **Commit to main** → **Push origin**.
4. GitHub → **Actions** → `KS Client - Windows verified engines`. A push elindíthatja az új tesztet. **Csak akkor** töltsd le a `KS-Client-Offline-Windows-CI-PASSED` csomagot, ha minden ellenőrzés zöld.

## Mi van ellenőrizve?

A régi és új ZIP forrásfájljainak összehasonlítása, JavaScript-szintaxis, Python forrásellenőrzés, YAML beolvashatósága és Windowsos Go keresztfordítás (ha a kiadási környezet ezt lehetővé teszi). **Nem** történt valós Windows CEF/Electron indítás, grafikus telepítési teszt vagy Kirka.io-játékteszt. A GitHub Actions még új futtatást igényel.

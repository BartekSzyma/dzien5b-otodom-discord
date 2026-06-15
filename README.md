# Mieszkania otodom -> Discord (Dzien5b)

Lokalna aplikacja: formularz pobiera 10 najnowszych ofert mieszkan z otodom.pl dla
wybranego miasta, zapisuje je do SQLite (bez duplikatow), wysyla nowe oferty na kanal
Discord danego miasta (kanaly tworzone automatycznie) i pokazuje wykresy na dashboardzie.

## 1. Wymagania

- Node.js v22 lub nowszy (sprawdz: `node --version`).
- System Windows z `curl.exe` (jest w Windows 10/11 domyslnie).

## 2. Instalacja

W katalogu projektu:

    npm install

(`better-sqlite3` instaluje sie z gotowego prebuildu - bez kompilatora. Gdyby prebuild
zawiodl, patrz FAQ na koncu.)

## 3. Utworzenie wlasnego serwera Discord

1. Otworz Discord (aplikacja lub przegladarka), zaloguj sie.
2. Po lewej, na dole listy serwerow, kliknij "+" (Dodaj serwer).
3. Wybierz "Stworz wlasny" -> "Tylko dla mnie i znajomych".
4. Nadaj nazwe (np. "Oferty mieszkan") i kliknij "Stworz".

Tworzenie serwera jest w 100% darmowe (nie wymaga zadnego planu platnego). Limit:
konto bez Nitro moze nalezec do maksymalnie 100 serwerow - to wspolny limit dla serwerow,
ktore tworzysz, i tych, do ktorych dolaczasz (tworzac serwer, jestes jego czlonkiem, wiec
liczy sie do tej puli). Z Discord Nitro limit rosnie do 200. Do tego projektu wystarczy
jeden serwer. Osobny limit dotyczy botow: niezweryfikowany bot moze byc maksymalnie na
100 serwerach (weryfikacja wymagana dopiero powyzej). Przy hobbystycznym uzyciu na wlasnym
serwerze zaden z tych limitow nie jest problemem.

## 4. Utworzenie aplikacji i bota

1. Wejdz na https://discord.com/developers/applications i zaloguj sie.
2. "New Application", nadaj nazwe, zaakceptuj warunki, "Create".
3. W menu po lewej wybierz "Bot".
4. Kliknij "Reset Token" -> "Yes, do it", potem "Copy" - to jest Twoj `DISCORD_TOKEN`.
   Trzymaj go w sekrecie (jak haslo). Jesli wyciekl - zresetuj ponownie.

## 5. Zaproszenie bota na serwer z uprawnieniami

1. W menu po lewej: "OAuth2" -> "URL Generator".
2. W "Scopes" zaznacz: `bot`.
3. W "Bot Permissions" zaznacz: "Manage Channels", "Send Messages", "View Channels".
4. Skopiuj wygenerowany URL na dole, wklej w przegladarce, wybierz swoj serwer,
   "Autoryzuj" i przejdz captcha.

## 6. Pobranie ID serwera (GUILD_ID)

1. W Discord: Ustawienia uzytkownika -> "Zaawansowane" -> wlacz "Tryb dewelopera".
2. Kliknij prawym na ikonie swojego serwera -> "Kopiuj ID serwera".
   To jest `DISCORD_GUILD_ID`.

## 7. Konfiguracja .env

Skopiuj `.env.example` do `.env`:

    Copy-Item .env.example .env

Wypelnij wartosci w `.env`:

    DISCORD_TOKEN=twoj-token-z-kroku-4
    DISCORD_GUILD_ID=id-serwera-z-kroku-6
    PORT=3000

Plik `.env` jest w `.gitignore` - nie trafi do repozytorium.

## 8. Uruchomienie

    npm start

Otworz http://localhost:3000.

## 9. Uzycie

1. Wpisz miasto (np. "Wroclaw"), wybierz wojewodztwo z listy, kliknij
   "Pobierz 10 najnowszych".
2. Po kilku sekundach: oferty trafiaja do bazy, nowe leca na Discord (kanal o nazwie
   miasta powstaje automatycznie przy pierwszych ofertach), a dashboard sie odswieza.
3. Drugie pobranie tego samego miasta wysle tylko oferty, ktorych jeszcze nie bylo.

## 10. Ograniczenia i FAQ

- Wzorzec URL otodom dziala dla miast na prawach powiatu (Wroclaw, Krakow, Warszawa,
  Lodz, Poznan, Gdansk itd.). Dla mniejszych miejscowosci lista moze byc pusta.
- Discord jest darmowy. Bot dziala lokalnie na Twoim serwerze.
- Reset bazy: zatrzymaj serwer i skasuj `data/app.db`.
- "Discord nieskonfigurowany": brak `DISCORD_TOKEN` w `.env`. Pobieranie i baza dzialaja,
  tylko wysylka jest pominieta.
- Blad instalacji `better-sqlite3`: zainstaluj "Visual Studio Build Tools" (C++) i
  uruchom `npm install` ponownie, albo uzyj Node w wersji z dostepnym prebuildem.

## 11. Testy

    npm test

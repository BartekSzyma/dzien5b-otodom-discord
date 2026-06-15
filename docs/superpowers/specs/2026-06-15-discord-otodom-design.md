# Rozbudowa: scraper otodom -> SQLite -> Discord (Dzien5b)

Data: 2026-06-15
Status: po recenzji zewnetrznej (Codex + Kimi), do przegladu uzytkownika

## 1. Cel i kontekst

Rozbudowa aplikacji z folderu `Start` (statyczny dashboard mieszkan z otodom.pl)
do lokalnej aplikacji webowej, ktora:

1. przez formularz HTML pobiera 10 najnowszych ofert dla wybranego miasta z otodom.pl,
2. zapisuje je do bazy SQLite (zrodlo prawdy, z deduplikacja),
3. nowe oferty wysyla na serwer Discord, na kanal danego miasta (kanaly tworzone
   dynamicznie wraz z nowymi miastami),
4. prezentuje dane z SQLite na dashboardzie (wykresy, wiele miast).

To swiadoma zmiana charakteru projektu: pierwotne ograniczenie "jeden statyczny plik,
bez serwera, bez internetu" zostaje **porzucone**, bo formularz piszacy do SQLite i
wolajacy Discord z sekretnym tokenem wymaga backendu. Token Discorda zyje wylacznie
po stronie serwera.

## 2. Stos technologiczny

- Node.js v22 (zainstalowany: v22.12).
- `express` v4 - serwer HTTP, serwuje strone i API.
- `better-sqlite3` v11 - synchroniczny dostep do SQLite (na Windows zwykle z prebuildu,
  bez kompilacji).
- `discord.js` v14 - bot Discord (tworzenie kanalow, wysylka wiadomosci).
- `dotenv` v16 - wczytanie `.env`.
- Scraping: systemowy `curl.exe` + blok `__NEXT_DATA__` (przeniesione z istniejacego
  `tools/fetch-otodom.mjs`, ktore przechodzi ochrone DataDome).

Konkretne wersje sa przypiete w `package.json` (zakresy `^`), by uniknac niezgodnosci
API (np. discord.js v13 vs v14 maja rozne API tworzenia kanalow).

## 3. Struktura plikow

```
Dzien5b/
  server/
    app.mjs          # Express: serwuje public/ + endpointy API
    otodom.mjs       # fetchListings(miasto, wojewodztwo, n) -> tablica ofert
    db.mjs           # better-sqlite3: schemat, upsert z dedup, odczyty
    discord.mjs      # bot: ensureChannel(miasto), postListing(kanal, oferta)
    wojewodztwa.js   # 16 wojewodztw (do dropdowna i walidacji)
    slug.js          # transliteracja PL -> ASCII, slug miasta i nazwy kanalu
  public/
    index.html       # formularz + sekcja dashboardu
    app.js           # logika frontu: submit formularza, fetch danych, wykresy
    render.js        # rysowanie wykresow (przeniesione ze Start/src/render.js)
    format.js        # formatowanie liczb (ze Start/src/format.js)
    stats.js         # mediany itp. (ze Start/src/stats.js)
    styles.css       # styl (ze Start/src/styles.css + formularz)
  data/
    .gitkeep         # katalog wersjonowany, baza nie
    app.db           # baza SQLite (gitignore)
  .env               # DISCORD_TOKEN, DISCORD_GUILD_ID (gitignore)
  .env.example       # szablon bez sekretow
  package.json
  README.md          # instrukcja krok po kroku (deliverable koncowy)
```

Pliki przenoszone ze `Start` (`format.js`, `stats.js`, `styles.css`) trafiaja do
`public/` i sa ladowane bezposrednio przez przegladarke jako moduly ES
(`<script type="module">`), bez kroku budowania. Sa juz modulami ES (`export function`),
wiec nie wymagaja konwersji - krok implementacji jedynie uruchamia ich skopiowane testy.

**Uwaga:** `Start/src/render.js` to puste zaslepki (`renderSummary() {}` itd.) - dashboard
w `Start` nie zostal dokonczony. Dlatego `public/render.js` jest **implementowany od zera**
(wykresy SVG: summary, dzielnice, scatter) zgodnie z opisem w sek. 7 designu pierwotnego
dashboardu. Zmienia sie tez **wiring danych** (z wbudowanej stalej `DATA` na `fetch` z API).
Wykresy weryfikujemy wizualnie (brak testow DOM).

## 4. Przeplyw danych

```
Formularz (miasto + wojewodztwo)
  --POST /api/fetch {city, wojewodztwo}-->
    walidacja wejscia (city niepuste, sensowna dlugosc; wojewodztwo z listy 16)
    blokada in-flight per slug miasta (rownolegly fetch tego samego miasta -> 409)
    otodom.fetchListings: zbuduj URL ze wzorca, pobierz liste 10 najnowszych,
      dla kazdej pobierz strone szczegolow -> tablica ofert
      (status fetcha: ok | empty | blocked | parse_failed - patrz sek. 11)
    db.upsertListings: w JEDNEJ transakcji INSERT OR IGNORE po id;
      "nowe" = wiersze faktycznie wstawione, zwracane po commit
    jesli sa nowe oferty:
      discord.ensureChannel(miasto) -> channel_id (tworzy kanal jesli brak)
      discord.postListing dla kazdej nowej oferty (discord.js sam kolejkuje rate-limit)
    odpowiedz JSON: { status, fetched, new, channel, discordOk, message }
  zwolnienie blokady in-flight (takze przy bledzie)

Dashboard
  --GET /api/cities--> lista miast w bazie (do filtra)
  --GET /api/listings?city=...--> oferty z SQLite -> wykresy
```

Pobranie 10 ofert = 1 strona listy + 10 stron szczegolow + grzeczne przerwy ~500 ms,
czyli kilka sekund. Front pokazuje spinner i blokuje przycisk na czas zadania.
Blokada in-flight per miasto zapobiega podwojnej wysylce na Discord przy szybkim
dwukliku lub rownoleglych zadaniach.

## 5. Budowanie URL otodom

Wzorzec:
`https://www.otodom.pl/pl/wyniki/sprzedaz/mieszkanie/{wojewodztwo}/{miasto}/{miasto}/{miasto}?by=LATEST&direction=DESC`

- `miasto` i `wojewodztwo` sa slugifikowane: male litery, polskie znaki -> ASCII
  (np. `Wroclaw` -> `wroclaw`, `Lodz` -> `lodz`, `dolnoslaskie` -> `dolnoslaskie`).
- Wojewodztwo pochodzi z dropdowna (16 stalych wartosci), wiec nie zgadujemy.
- Wzorzec zaklada **miasto na prawach powiatu** (czlon miasta powtorzony 3x), co pokrywa
  duze miasta (Wroclaw, Krakow, Warszawa, Lodz, Poznan, Gdansk itd.). Dla mniejszych
  miejscowosci wzorzec moze nie trafic - wtedy lista ofert bedzie pusta i front pokaze
  "0 ofert" (przypadek brzegowy `empty`, nie blad). To ograniczenie jest jawnie opisane
  w README i zasygnalizowane przy formularzu.

## 6. Schemat SQLite i deduplikacja

```sql
CREATE TABLE IF NOT EXISTS cities (
  id                 INTEGER PRIMARY KEY,
  name               TEXT NOT NULL,           -- nazwa wpisana w formularzu
  slug               TEXT NOT NULL UNIQUE,    -- slug miasta (klucz logiczny)
  wojewodztwo        TEXT NOT NULL,
  discord_channel_id TEXT,                    -- NULL dopoki kanal nie powstal
  created_at         TEXT NOT NULL            -- ISO 8601 (np. 2026-06-15T12:00:00Z)
);

CREATE TABLE IF NOT EXISTS listings (
  id               TEXT PRIMARY KEY,          -- ID oferty z otodom (dedup); TEXT dla bezpieczenstwa
  city_id          INTEGER NOT NULL REFERENCES cities(id),
  tytul            TEXT,
  dzielnica        TEXT,
  cena             REAL,
  cena_m2          REAL,
  powierzchnia     REAL,
  pokoje           INTEGER,
  pietro           INTEGER,
  pieter_w_budynku INTEGER,
  rok_budowy       INTEGER,
  lat              REAL,
  lng              REAL,
  liczba_zdjec     INTEGER,
  link             TEXT,
  created_at       TEXT NOT NULL              -- ISO 8601; moment pierwszego znalezienia
);

CREATE INDEX IF NOT EXISTS idx_listings_city_id_created
  ON listings(city_id, created_at DESC);
```

### Semantyka deduplikacji: "pierwsze znalezienie" (decyzja zatwierdzona)

`INSERT OR IGNORE INTO listings ...` wewnatrz jednej transakcji. Liczba realnie
wstawionych wierszy wyznacza zbior "nowych" ofert tego uruchomienia; tylko one
(i tylko raz) trafiaja na Discord.

Jest to **zamierzone**: aplikacja pelni role alertu o *nowych* ofertach. Istniejaca
oferta nie jest aktualizowana - pozniejsza zmiana ceny czy tytulu nie tworzy duplikatu
ani nowego alertu. Baza jest historia pierwszego znalezienia, nie biezacym snapshotem
rynku. Sledzenie aktualizacji (updated_at + upsert) jest swiadomie poza zakresem (YAGNI).

`id` jest typu `TEXT`, by deduplikacja byla odporna na ewentualne nienumeryczne lub
bardzo duze identyfikatory otodom (obecne ID sa liczbowe, ale TEXT nic nie kosztuje).
Miasto jest tworzone (jesli brak) na podstawie `slug`; `discord_channel_id` uzupelniany
leniwie przy pierwszej wysylce. Katalog `data/` jest tworzony przy starcie serwera,
jesli nie istnieje (inaczej SQLite nie zalozy pliku).

## 7. Discord

- Bot loguje sie raz przy starcie serwera (`discord.js` v14, intent `Guilds`).
  Do wysylki wiadomosci przez REST i tworzenia kanalow intent `Guilds` + uprawnienia
  wystarczaja; intent `GuildMessages` (odbieranie zdarzen) nie jest potrzebny.
- Wymagane uprawnienia bota na serwerze: **Manage Channels** + **Send Messages**
  + **View Channels**.
- `ensureChannel(city)`:
  - jesli `cities.discord_channel_id` ustawione i kanal istnieje -> uzyj,
  - jesli ustawione, ale Discord zwraca `Unknown Channel` (10003, kanal skasowano
    recznie) -> utworz ponownie i zaktualizuj `discord_channel_id`,
  - jesli brak -> utworz kanal tekstowy i zapisz `channel_id` do bazy.
- Nazwa kanalu: slug miasta znormalizowany pod reguly Discord (male litery, cyfry,
  myslniki; spacje -> myslniki; 2-100 znakow; fallback gdy <2 znaki, np. prefiks
  `miasto-`). Np. `Nowa Huta` -> `nowa-huta`.
- Kanal tworzymy **dopiero gdy sa nowe oferty do wyslania** (brak pustych kanalow).
- Kazda nowa oferta = jedna wiadomosc typu embed: tytul (link do otodom), dzielnica,
  cena, cena/m2, metraz, liczba pokoi. discord.js automatycznie kolejkuje wysylki
  zgodnie z limitami API (10 wiadomosci po kolei nie przekroczy limitu).
- Token i `DISCORD_GUILD_ID` z `.env`.

## 8. API serwera (Express)

| Metoda | Sciezka | Wejscie | Wyjscie |
|---|---|---|---|
| GET | `/` | - | `public/index.html` (formularz + dashboard) |
| POST | `/api/fetch` | `{ city, wojewodztwo }` | `{ status, fetched, new, channel, discordOk, message }` |
| GET | `/api/cities` | - | `[{ slug, name, wojewodztwo }]` (puste -> `[]`) |
| GET | `/api/listings` | `?city=<slug>` (opcjonalnie) | `[oferta...]`, sort `created_at DESC`, puste -> `[]` |

Schemat odpowiedzi `/api/fetch` (jednolity, pole `message` zawsze obecne):

Odpowiedzi dzielimy na dwie kategorie:

- **Sciezka sukcesu (HTTP 200)** - pelny ksztalt: `status` (`ok` | `empty` | `blocked` |
  `parse_failed` | `discord_unconfigured`), `fetched`, `new`, `channel`, `discordOk`, `message`.
  - `fetched` - liczba ofert pobranych z otodom.
  - `new` - liczba nowych ofert zapisanych w tym uruchomieniu.
  - `channel` - **nazwa** kanalu Discord (slug miasta) albo `null`.
  - `discordOk` - czy wysylka na Discord sie powiodla (`true`/`false`).
  - `message` - czytelny komunikat dla uzytkownika (zawsze obecny).
- **Sciezka bledu HTTP** - skrocony ksztalt `{ status, message }`:
  - HTTP 400 `status: bad_request` - bledne wejscie (puste/za dlugie miasto, wojewodztwo
    spoza listy 16).
  - HTTP 409 `status: busy` - trwa juz fetch tego samego miasta (blokada in-flight).
  - HTTP 500 `status: error` - nieoczekiwany blad serwera.

Walidacja wejscia: `city` niepuste, dlugosc <= 60, po normalizacji niepusty slug;
`wojewodztwo` musi nalezec do listy 16.

Statyczne pliki z `public/` serwowane przez `express.static`.

## 9. Frontend i kontrakt danych dashboardu

- **Formularz** (gora strony): pole tekstowe "Miasto", `<select>` z 16 wojewodztwami,
  przycisk "Pobierz 10 najnowszych". Krotka adnotacja: "dziala dla miast na prawach
  powiatu". Submit -> `POST /api/fetch`, spinner, blokada przycisku, po odpowiedzi
  komunikat z `message` (np. "Pobrano 10, nowych 3, kanal #wroclaw" albo blad).
  Po sukcesie odswiezenie danych dashboardu.
- **Dashboard**: istniejace wykresy (ceny wg dzielnicy, cena vs powierzchnia) i
  mini-pasek podsumowania, zasilane z `GET /api/listings`. Filtr miasta z
  `GET /api/cities`.

### Kontrakt pol: otodom -> kolumna DB -> pole API -> render.js

Warstwa API mapuje kolumny `snake_case` na nazwy pol oczekiwane przez istniejacy
`render.js` (takie same jak w `Start/src/data.js`), by logika wykresow dzialala
bez zmian:

| otodom | kolumna DB | pole API / render.js | typ |
|---|---|---|---|
| id | `id` | `id` | string |
| Tytul | `tytul` | `tytul` | string |
| Dzielnica | `dzielnica` | `dzielnica` | string |
| Cena | `cena` | `cena` | number |
| Cena za m2 | `cena_m2` | `cenaM2` | number |
| Powierzchnia | `powierzchnia` | `powierzchnia` | number |
| Liczba pokoi | `pokoje` | `pokoje` | number |
| Pietro | `pietro` | `pietro` | number\|null |
| Liczba pieter | `pieter_w_budynku` | `pieterWBudynku` | number |
| Rok budowy | `rok_budowy` | `rokBudowy` | number\|null |
| Szerokosc geo | `lat` | `lat` | number |
| Dlugosc geo | `lng` | `lng` | number |
| Liczba zdjec | `liczba_zdjec` | `liczbaZdjec` | number |
| Link | `link` | `link` | string |

Oferty bez `dzielnica` sa grupowane na wykresie dzielnic jako "brak dzielnicy"
(spojnie z dotychczasowym zachowaniem dashboardu dla brakow danych).

## 10. Konfiguracja i sekrety

- `.env` (gitignore): `DISCORD_TOKEN`, `DISCORD_GUILD_ID`, opcjonalnie `PORT` (domyslnie 3000).
- `.env.example`: te same klucze bez wartosci, z `PORT=3000` jako domyslna.
- `.gitignore`: `node_modules/`, `data/app.db`, `.env`.
- Brak `.env`/tokena: serwer startuje, dashboard i pobieranie do SQLite dzialaja,
  a `/api/fetch` zwraca `status: discord_unconfigured` z czytelnym `message`
  zamiast sie wywalic.

## 11. Obsluga bledow i przypadki brzegowe

Statusy fetcha rozrozniane jednoznacznie (nie mylimy braku wynikow z blokada):

- `ok` - sa oferty, `__NEXT_DATA__` poprawne.
- `empty` - `__NEXT_DATA__` poprawne, ale lista ofert pusta (np. maly miejscowosc /
  zly wzorzec URL). Komunikat "0 ofert", baza nietknieta, bez crasha.
- `blocked` - brak bloku `__NEXT_DATA__` / strona captcha (DataDome zwraca 200), blad
  curl/sieci (timeout, brak polaczenia), albo lista miala oferty, ale zadnej strony
  szczegolow nie udalo sie pobrac (prawdopodobna blokada na stronach ofert). NIE
  traktujemy jako sukces ani jako pusty wynik.
- `parse_failed` - `__NEXT_DATA__` jest, ale struktura inna niz oczekiwana.
- Brak tokena/`.env` -> `discord_unconfigured`; pobieranie + SQLite dzialaja.
- Miasto bez nowych ofert (wszystko juz w bazie) -> `new: 0`, kanal nie powstaje.
- Discord niedostepny mimo tokena -> oferty zapisane w SQLite; `discordOk: false`.
- Wojewodztwo spoza listy / puste miasto -> HTTP 400.
- Rownolegly fetch tego samego miasta -> HTTP 409 (`busy`).
- Blad pobrania pojedynczej strony szczegolow -> pominiecie tej oferty (log),
  pozostale przetwarzane; batch sie nie wywala.

## 12. Testy i weryfikacja

- Testy jednostkowe (Node test runner, jak w `Start`): slugifikacja miasta/wojewodztwa,
  budowanie URL, normalizacja nazwy kanalu (w tym fallback <2 znaki), dedup w
  `db.upsertListings` (drugie wstawienie tych samych ofert daje 0 nowych),
  mapowanie oferty otodom -> rekord DB -> pole API.
- Weryfikacja reczna: start serwera, formularz dla realnego miasta, sprawdzenie:
  oferty w SQLite, kanal i wiadomosci na Discordzie, wykresy na dashboardzie,
  drugie pobranie tego samego miasta = 0 nowych i brak duplikatow na Discordzie.

## 13. Deliverable koncowy: instrukcja krok po kroku (README.md)

Pelny przewodnik prowadzacy uzytkownika przez cala rozbudowe:

1. Wymagania (Node v22+), `npm install`.
2. Utworzenie wlasnego serwera Discord (krok po kroku).
3. Utworzenie aplikacji i bota w Discord Developer Portal, pobranie tokena.
4. Zaproszenie bota na serwer z uprawnieniami Manage Channels + Send Messages
   + View Channels (generator URL OAuth2 ze scope `bot` i odpowiednimi permissions).
5. Wlaczenie trybu dewelopera w Discord i skopiowanie `DISCORD_GUILD_ID` (ID serwera).
6. Utworzenie `.env` z `DISCORD_TOKEN` i `DISCORD_GUILD_ID` (na bazie `.env.example`).
7. Uruchomienie serwera (`npm start`) i otwarcie `http://localhost:3000`.
8. Uzycie formularza, weryfikacja kanalow i wiadomosci na Discordzie.
9. Ograniczenia i FAQ: dziala dla miast na prawach powiatu; Discord jest darmowy;
   limit 100 serwerow dotyczy tylko niezweryfikowanych botow (przy lokalnym uzyciu
   na wlasnym serwerze nie jest problemem); jak zresetowac baze (skasowac `data/app.db`).

## 14. Poza zakresem (YAGNI)

- Harmonogram / automatyczne cykliczne pobieranie (na razie reczne przez formularz).
- Sledzenie aktualizacji ofert (updated_at/upsert) - patrz sek. 6.
- Uwierzytelnianie uzytkownikow aplikacji.
- Edycja/usuwanie ofert z poziomu UI.
- Migracje schematu (reczny reset bazy opisany w README).
- Hosting w chmurze (aplikacja lokalna).
- Powiadomienia inne niz Discord.

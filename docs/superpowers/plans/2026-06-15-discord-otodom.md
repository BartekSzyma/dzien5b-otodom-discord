# Scraper otodom -> SQLite -> Discord (Dzien5b) - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lokalna aplikacja webowa, ktora przez formularz HTML pobiera 10 najnowszych ofert mieszkan z otodom.pl dla wybranego miasta, zapisuje je do SQLite z deduplikacja, wysyla nowe oferty na kanal Discord danego miasta (kanaly tworzone dynamicznie), a na dashboardzie rysuje wykresy z bazy.

**Architecture:** Express serwuje statyczny front (`public/`) i API. Pobieranie: `curl.exe` + blok `__NEXT_DATA__`. Persystencja: `better-sqlite3` (zrodlo prawdy, dedup `INSERT OR IGNORE`). Discord: `discord.js` v14, bot logowany raz przy starcie, leniwe tworzenie kanalu per miasto. Front: formularz + wykresy SVG czytajace z `/api/listings`.

**Tech Stack:** Node v22, Express v4, better-sqlite3 v11, discord.js v14, dotenv v16, Node test runner (`node:test`).

**Spec:** `docs/superpowers/specs/2026-06-15-discord-otodom-design.md`

**Konwencje:**
- Wszystkie polecenia uruchamiane z katalogu `C:\Programowanie\ALX vibecoding\Dzien5b`.
- Testy: `node --test`. Pojedynczy plik: `node --test test/<plik>.test.mjs`.
- Kazdy commit konczy sie trailerem `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` (pokazany w kazdym kroku commit).
- Tylko krotki dywiz `-` (zakaz dlugich myslnikow) w kodzie, komentarzach i commitach.
- Jeden ksztalt obiektu oferty w calej aplikacji: nazwy pol dashboardu (`cena`, `cenaM2`, `powierzchnia`, `pokoje`, `dzielnica`, `pietro`, `pieterWBudynku`, `rokBudowy`, `lat`, `lng`, `liczbaZdjec`, `link`, `tytul`, `id` jako string). SQLite to jedyna granica `snake_case`.

---

## File Structure

```
Dzien5b/
  server/
    slug.js          # transliteracja PL->ASCII, slug miasta, nazwa kanalu Discord
    wojewodztwa.js   # lista 16 wojewodztw (label + slug)
    otodom.mjs       # buildUrl, mapItem, extractNextData, fetchListings
    db.mjs           # better-sqlite3: init, upsertListings (dedup), getCities, getListings
    discord.mjs      # getClient, initDiscordAtStartup, ensureChannel, postListings
    app-factory.mjs  # createApp({db, fetchListings, ensureChannel, postListings, discordConfigured})
    app.mjs          # wiring realnych zaleznosci + listen
  public/
    index.html       # formularz + dashboard
    app.js           # front: submit, fetch danych, wykresy
    render.js        # rysowanie wykresow SVG (implementacja od zera)
    stats.js         # skopiowane ze Start (mediany, statsByDistrict, summary)
    format.js        # skopiowane ze Start (formatInt, formatPLN, formatM2)
    styles.css       # skopiowane ze Start + style formularza
  test/
    slug.test.mjs
    wojewodztwa.test.mjs
    otodom.test.mjs
    db.test.mjs
    api.test.mjs
  data/
    .gitkeep
  docs/superpowers/{specs,plans}/...
  .env.example
  .gitignore
  package.json
  README.md
```

---

## Task 0: Scaffold projektu

**Files:**
- Create: `package.json`, `.gitignore`, `.env.example`, `data/.gitkeep`
- Copy: `Start/src/stats.js` -> `public/stats.js`, `Start/src/format.js` -> `public/format.js`, `Start/src/styles.css` -> `public/styles.css`
- Copy tests: `Start/test/stats.test.mjs` -> `test/stats.test.mjs`, `Start/test/format.test.mjs` -> `test/format.test.mjs` (popraw sciezki importow na `../public/...`)

- [ ] **Step 1: Inicjalizacja repo i katalogow**

Run (PowerShell, w `C:\Programowanie\ALX vibecoding\Dzien5b`):
```powershell
git init
New-Item -ItemType Directory -Force server, public, test, data | Out-Null
if (-not (Test-Path data\.gitkeep)) { New-Item -ItemType File data\.gitkeep | Out-Null }
```

- [ ] **Step 2: package.json**

Create `package.json`:
```json
{
  "name": "dzien5b-otodom-discord",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "start": "node server/app.mjs",
    "test": "node --test"
  },
  "dependencies": {
    "better-sqlite3": "^11.8.1",
    "discord.js": "^14.16.3",
    "dotenv": "^16.4.7",
    "express": "^4.21.2"
  }
}
```

- [ ] **Step 3: .gitignore i .env.example**

Create `.gitignore`:
```
node_modules/
data/app.db
data/app.db-wal
data/app.db-shm
.env
```

Create `.env.example`:
```
DISCORD_TOKEN=
DISCORD_GUILD_ID=
PORT=3000
```

- [ ] **Step 4: Skopiuj pliki wielokrotnego uzytku ze Start**

Run:
```powershell
Copy-Item ..\Start\src\stats.js  public\stats.js  -Force
Copy-Item ..\Start\src\format.js public\format.js -Force
Copy-Item ..\Start\src\styles.css public\styles.css -Force
Copy-Item ..\Start\test\stats.test.mjs  test\stats.test.mjs  -Force
Copy-Item ..\Start\test\format.test.mjs test\format.test.mjs -Force
```

- [ ] **Step 5: Popraw sciezki importow w skopiowanych testach**

W `test/stats.test.mjs` zamien wszystkie `from "../src/stats.js"` na `from "../public/stats.js"`.
W `test/format.test.mjs` zamien `from "../src/format.js"` na `from "../public/format.js"`.

- [ ] **Step 6: Instalacja zaleznosci**

Run:
```powershell
npm install
```
Expected: katalog `node_modules/` powstaje; `better-sqlite3` instaluje sie z prebuildu (bez bledu kompilacji). Jesli prebuild zawiedzie, patrz README sek. FAQ.

- [ ] **Step 7: Testy bazowe (skopiowane) przechodza**

Run:
```powershell
node --test test/stats.test.mjs test/format.test.mjs
```
Expected: PASS (testy median/applyFilters/statsByDistrict/summary i format).

- [ ] **Step 8: Commit**

```powershell
git add -A
git commit -m "chore: scaffold Dzien5b (deps, dirs, reuse stats/format/styles)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 1: slug.js - transliteracja i nazwy

**Files:**
- Create: `server/slug.js`
- Test: `test/slug.test.mjs`

- [ ] **Step 1: Test (failing)**

Create `test/slug.test.mjs`:
```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, channelName } from "../server/slug.js";

test("slugify - male litery i polskie znaki na ASCII", () => {
  assert.equal(slugify("Wrocław"), "wroclaw");
  assert.equal(slugify("Łódź"), "lodz");
  assert.equal(slugify("Gdańsk"), "gdansk");
});

test("slugify - spacje i wielokrotne myslniki", () => {
  assert.equal(slugify("Nowa Huta"), "nowa-huta");
  assert.equal(slugify("  Bielsko   Biala  "), "bielsko-biala");
});

test("slugify - usuwa niedozwolone znaki", () => {
  assert.equal(slugify("Kraków!@#"), "krakow");
});

test("channelName - poprawny slug zostaje", () => {
  assert.equal(channelName("Wrocław"), "wroclaw");
});

test("channelName - fallback gdy krotszy niz 2 znaki", () => {
  assert.equal(channelName("A"), "miasto-a");
});

test("channelName - przycina do 100 znakow", () => {
  const long = "a".repeat(150);
  assert.equal(channelName(long).length, 100);
});
```

- [ ] **Step 2: Uruchom (FAIL)**

Run: `node --test test/slug.test.mjs`
Expected: FAIL ("Cannot find module ../server/slug.js").

- [ ] **Step 3: Implementacja**

Create `server/slug.js`:
```javascript
// Transliteracja polskich znakow do ASCII + slugifikacja.
const PL = {
  ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
  Ą: "a", Ć: "c", Ę: "e", Ł: "l", Ń: "n", Ó: "o", Ś: "s", Ź: "z", Ż: "z",
};

export function slugify(input) {
  const ascii = String(input ?? "")
    .split("")
    .map((ch) => PL[ch] ?? ch)
    .join("")
    .toLowerCase();
  return ascii
    .replace(/[^a-z0-9]+/g, "-") // niedozwolone -> myslnik
    .replace(/-+/g, "-")          // zwijanie myslnikow
    .replace(/^-|-$/g, "");       // bez myslnikow na brzegach
}

// Nazwa kanalu Discord: slug, 2-100 znakow; fallback dla bardzo krotkich.
export function channelName(input) {
  let s = slugify(input);
  if (s.length < 2) s = "miasto-" + (s || "x");
  if (s.length > 100) s = s.slice(0, 100).replace(/-+$/, ""); // bez koncowych myslnikow po przycieciu
  return s;
}
```

- [ ] **Step 4: Uruchom (PASS)**

Run: `node --test test/slug.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/slug.js test/slug.test.mjs
git commit -m "feat: slug i nazwa kanalu Discord (transliteracja PL)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: wojewodztwa.js - lista 16

**Files:**
- Create: `server/wojewodztwa.js`
- Test: `test/wojewodztwa.test.mjs`

- [ ] **Step 1: Test (failing)**

Create `test/wojewodztwa.test.mjs`:
```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { WOJEWODZTWA, isValidWojewodztwo } from "../server/wojewodztwa.js";

test("WOJEWODZTWA - jest 16 pozycji", () => {
  assert.equal(WOJEWODZTWA.length, 16);
});

test("WOJEWODZTWA - kazdy ma label i slug", () => {
  for (const w of WOJEWODZTWA) {
    assert.equal(typeof w.label, "string");
    assert.match(w.slug, /^[a-z-]+$/);
  }
});

test("isValidWojewodztwo - akceptuje znany slug", () => {
  assert.equal(isValidWojewodztwo("dolnoslaskie"), true);
});

test("isValidWojewodztwo - odrzuca nieznany", () => {
  assert.equal(isValidWojewodztwo("atlantyda"), false);
});
```

- [ ] **Step 2: Uruchom (FAIL)**

Run: `node --test test/wojewodztwa.test.mjs`
Expected: FAIL (brak modulu).

- [ ] **Step 3: Implementacja**

Create `server/wojewodztwa.js`:
```javascript
// 16 wojewodztw RP: label = czytelna nazwa PL (dropdown), slug = wartosc do URL otodom.
export const WOJEWODZTWA = [
  { label: "dolnośląskie", slug: "dolnoslaskie" },
  { label: "kujawsko-pomorskie", slug: "kujawsko--pomorskie" },
  { label: "lubelskie", slug: "lubelskie" },
  { label: "lubuskie", slug: "lubuskie" },
  { label: "łódzkie", slug: "lodzkie" },
  { label: "małopolskie", slug: "malopolskie" },
  { label: "mazowieckie", slug: "mazowieckie" },
  { label: "opolskie", slug: "opolskie" },
  { label: "podkarpackie", slug: "podkarpackie" },
  { label: "podlaskie", slug: "podlaskie" },
  { label: "pomorskie", slug: "pomorskie" },
  { label: "śląskie", slug: "slaskie" },
  { label: "świętokrzyskie", slug: "swietokrzyskie" },
  { label: "warmińsko-mazurskie", slug: "warminsko--mazurskie" },
  { label: "wielkopolskie", slug: "wielkopolskie" },
  { label: "zachodniopomorskie", slug: "zachodniopomorskie" },
];

const SLUGS = new Set(WOJEWODZTWA.map((w) => w.slug));
export function isValidWojewodztwo(slug) {
  return SLUGS.has(slug);
}
```

Uwaga: otodom uzywa podwojnego myslnika dla wojewodztw dwuczlonowych (np.
`kujawsko--pomorskie`). To celowe i zgodne z ich URL.

- [ ] **Step 4: Uruchom (PASS)**

Run: `node --test test/wojewodztwa.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/wojewodztwa.js test/wojewodztwa.test.mjs
git commit -m "feat: lista 16 wojewodztw z walidacja" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: otodom.mjs - budowanie URL, mapowanie, status

**Files:**
- Create: `server/otodom.mjs`
- Test: `test/otodom.test.mjs`

Czesc czysta (buildUrl, extractNextData, mapItem) jest testowana jednostkowo.
Sama sieciowa funkcja `fetchListings` jest cienkim wrapperem (weryfikacja reczna).

- [ ] **Step 1: Test (failing)**

Create `test/otodom.test.mjs`:
```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildUrl, extractNextData, mapItem } from "../server/otodom.mjs";

test("buildUrl - wzorzec miasta na prawach powiatu", () => {
  assert.equal(
    buildUrl("wroclaw", "dolnoslaskie"),
    "https://www.otodom.pl/pl/wyniki/sprzedaz/mieszkanie/dolnoslaskie/wroclaw/wroclaw/wroclaw?by=LATEST&direction=DESC"
  );
});

test("extractNextData - brak bloku => blocked", () => {
  const r = extractNextData("<html>captcha</html>");
  assert.equal(r.status, "blocked");
});

test("extractNextData - zly JSON => parse_failed", () => {
  const html = '<script id="__NEXT_DATA__" type="application/json">{nie-json}</script>';
  const r = extractNextData(html);
  assert.equal(r.status, "parse_failed");
});

test("extractNextData - poprawny blok => ok + data", () => {
  const html = '<script id="__NEXT_DATA__" type="application/json">{"a":1}</script>';
  const r = extractNextData(html);
  assert.equal(r.status, "ok");
  assert.deepEqual(r.data, { a: 1 });
});

test("mapItem - mapuje pola listy i szczegolow na ksztalt dashboardu", () => {
  const it = {
    id: 123456,
    title: "Mieszkanie 3 pokoje",
    totalPrice: { value: 884500 },
    pricePerSquareMeter: { value: 14500 },
    areaInSquareMeters: 61.09,
    totalPossibleImages: 12,
    slug: "oferta-abc",
    location: {
      reverseGeocoding: {
        locations: [{ locationLevel: "district", name: "Krzyki" }],
      },
    },
  };
  const detail = {
    props: { pageProps: { ad: {
      characteristics: [
        { key: "rooms_num", value: "3" },
        { key: "floor_no", value: "floor_2" },
        { key: "building_floors_num", value: "5" },
        { key: "build_year", value: "2019" },
      ],
      location: { coordinates: { latitude: 51.07, longitude: 17.02 } },
      url: "https://www.otodom.pl/pl/oferta/oferta-abc",
    } } },
  };
  const o = mapItem(it, detail);
  assert.equal(o.id, "123456");
  assert.equal(o.tytul, "Mieszkanie 3 pokoje");
  assert.equal(o.dzielnica, "Krzyki");
  assert.equal(o.cena, 884500);
  assert.equal(o.cenaM2, 14500);
  assert.equal(o.powierzchnia, 61.09);
  assert.equal(o.pokoje, 3);
  assert.equal(o.pietro, 2);
  assert.equal(o.pieterWBudynku, 5);
  assert.equal(o.rokBudowy, 2019);
  assert.equal(o.lat, 51.07);
  assert.equal(o.lng, 17.02);
  assert.equal(o.liczbaZdjec, 12);
  assert.equal(o.link, "https://www.otodom.pl/pl/oferta/oferta-abc");
});

test("mapItem - puste pietro/rok jako null", () => {
  const it = { id: 7, title: "x", totalPrice: {}, pricePerSquareMeter: {}, location: {} };
  const detail = { props: { pageProps: { ad: { characteristics: [], location: {} } } } };
  const o = mapItem(it, detail);
  assert.equal(o.pietro, null);
  assert.equal(o.rokBudowy, null);
});
```

- [ ] **Step 2: Uruchom (FAIL)**

Run: `node --test test/otodom.test.mjs`
Expected: FAIL (brak modulu).

- [ ] **Step 3: Implementacja**

Create `server/otodom.mjs`:
```javascript
// Pobiera N najnowszych ofert z otodom.pl i zwraca tablice obiektow w ksztalcie
// dashboardu. Dane z bloku __NEXT_DATA__ (Next.js). Pola szczegolowe (rok, pietra,
// wspolrzedne) pochodza ze strony szczegolow kazdej oferty.
import { execFileSync } from "node:child_process";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export function buildUrl(citySlug, wojSlug) {
  return (
    "https://www.otodom.pl/pl/wyniki/sprzedaz/mieszkanie/" +
    `${wojSlug}/${citySlug}/${citySlug}/${citySlug}` +
    "?by=LATEST&direction=DESC"
  );
}

// Systemowy curl.exe przechodzi ochrone DataDome (HTTP 200), inaczej niz prosty klient.
// --max-time 30: nie wisimy w nieskonczonosc; -L: podazaj za przekierowaniami.
function fetchHtml(url) {
  return execFileSync(
    "curl.exe",
    ["-s", "-L", "--max-time", "30", "--compressed", "-A", UA,
     "-H", "Accept-Language: pl-PL,pl;q=0.9,en;q=0.8", url],
    { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 }
  ).toString("utf8");
}

// Zwraca { status: "ok"|"blocked"|"parse_failed", data? }.
export function extractNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return { status: "blocked" }; // brak bloku = captcha/blokada DataDome
  try {
    return { status: "ok", data: JSON.parse(m[1]) };
  } catch {
    return { status: "parse_failed" };
  }
}

const toNum = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isNaN(n) ? null : n;
};

// "floor_8" -> 8, "ground_floor" -> 0, inne -> null.
function floorNum(v) {
  if (!v) return null;
  if (v === "ground_floor") return 0;
  const m = /^floor_(\d+)$/.exec(v);
  return m ? Number(m[1]) : null;
}

function district(it) {
  const locs = it?.location?.reverseGeocoding?.locations || [];
  const byLevel = {};
  for (const l of locs) byLevel[l.locationLevel] = l.name;
  return byLevel.residential || byLevel.district || byLevel.city_or_village || "";
}

export function mapItem(it, detail) {
  const ad = detail?.props?.pageProps?.ad || {};
  const ch = {};
  for (const c of ad.characteristics || []) ch[c.key] = c.value;
  const coords = ad?.location?.coordinates || {};
  return {
    id: String(it.id),
    tytul: String(it.title ?? ""),
    dzielnica: district(it),
    cena: toNum(it.totalPrice?.value),
    cenaM2: toNum(it.pricePerSquareMeter?.value),
    powierzchnia: toNum(it.areaInSquareMeters),
    pokoje: toNum(ch.rooms_num),
    pietro: floorNum(ch.floor_no),
    pieterWBudynku: toNum(ch.building_floors_num),
    rokBudowy: toNum(ch.build_year),
    lat: toNum(coords.latitude),
    lng: toNum(coords.longitude),
    liczbaZdjec: toNum(it.totalPossibleImages),
    link: ad.url || `https://www.otodom.pl/pl/oferta/${it.slug}`,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Zwraca { status, items }. status: ok|empty|blocked|parse_failed.
export async function fetchListings(citySlug, wojSlug, count = 10) {
  let listHtml;
  try {
    listHtml = fetchHtml(buildUrl(citySlug, wojSlug));
  } catch (e) {
    console.error("[otodom] blad pobrania listy:", e.message);
    return { status: "blocked", items: [] }; // curl padl / timeout / brak sieci
  }
  const listRes = extractNextData(listHtml);
  if (listRes.status !== "ok") return { status: listRes.status, items: [] };

  const items = listRes.data?.props?.pageProps?.data?.searchAds?.items;
  if (!Array.isArray(items)) return { status: "parse_failed", items: [] };
  if (items.length === 0) return { status: "empty", items: [] };

  const top = items.slice(0, count);
  const out = [];
  for (let i = 0; i < top.length; i++) {
    const it = top[i];
    try {
      const detail = extractNextData(fetchHtml(`https://www.otodom.pl/pl/oferta/${it.slug}`));
      if (detail.status !== "ok") {
        console.error(`[otodom] pomijam oferte ${it.id}: szczegoly status=${detail.status}`);
        continue;
      }
      out.push(mapItem(it, detail.data));
    } catch (e) {
      console.error(`[otodom] pomijam oferte ${it.id}: ${e.message}`);
    }
    if (i < top.length - 1) await sleep(500); // grzeczna przerwa
  }
  // Lista miala oferty, ale zadnej nie udalo sie zmapowac (np. blokada na stronach
  // szczegolow) - to NIE jest pusty wynik, tylko prawdopodobna blokada.
  if (out.length === 0) return { status: "blocked", items: [] };
  return { status: "ok", items: out };
}
```

- [ ] **Step 4: Uruchom (PASS)**

Run: `node --test test/otodom.test.mjs`
Expected: PASS (czesc czysta; `fetchListings` nie jest wolane w tescie).

- [ ] **Step 5: Commit**

```powershell
git add server/otodom.mjs test/otodom.test.mjs
git commit -m "feat: scraper otodom jako modul (URL, status, mapowanie)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: db.mjs - SQLite, dedup, odczyty

**Files:**
- Create: `server/db.mjs`
- Test: `test/db.test.mjs`

- [ ] **Step 1: Test (failing)**

Create `test/db.test.mjs`:
```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../server/db.mjs";

function sample(id, dzielnica = "Krzyki") {
  return {
    id: String(id), tytul: "t" + id, dzielnica,
    cena: 800000, cenaM2: 14000, powierzchnia: 55, pokoje: 3,
    pietro: 2, pieterWBudynku: 5, rokBudowy: 2019,
    lat: 51, lng: 17, liczbaZdjec: 10, link: "http://x/" + id,
  };
}

test("upsertListings - pierwsze wstawienie zwraca wszystkie jako nowe", () => {
  const db = openDb(":memory:");
  const city = db.ensureCity({ name: "Wrocław", slug: "wroclaw", wojewodztwo: "dolnoslaskie" });
  const neu = db.upsertListings(city.id, [sample(1), sample(2)]);
  assert.equal(neu.length, 2);
});

test("upsertListings - drugie wstawienie tych samych daje 0 nowych (dedup)", () => {
  const db = openDb(":memory:");
  const city = db.ensureCity({ name: "Wrocław", slug: "wroclaw", wojewodztwo: "dolnoslaskie" });
  db.upsertListings(city.id, [sample(1), sample(2)]);
  const neu = db.upsertListings(city.id, [sample(1), sample(2), sample(3)]);
  assert.equal(neu.length, 1);
  assert.equal(neu[0].id, "3");
});

test("ensureCity - drugie wywolanie zwraca to samo miasto", () => {
  const db = openDb(":memory:");
  const a = db.ensureCity({ name: "Wrocław", slug: "wroclaw", wojewodztwo: "dolnoslaskie" });
  const b = db.ensureCity({ name: "Wrocław", slug: "wroclaw", wojewodztwo: "dolnoslaskie" });
  assert.equal(a.id, b.id);
});

test("getListings - zwraca ksztalt dashboardu (cenaM2), sort i filtr miasta", () => {
  const db = openDb(":memory:");
  const wro = db.ensureCity({ name: "Wrocław", slug: "wroclaw", wojewodztwo: "dolnoslaskie" });
  const kra = db.ensureCity({ name: "Kraków", slug: "krakow", wojewodztwo: "malopolskie" });
  db.upsertListings(wro.id, [sample(1)]);
  db.upsertListings(kra.id, [sample(2, "Stare Miasto")]);
  const all = db.getListings();
  assert.equal(all.length, 2);
  assert.equal(typeof all[0].cenaM2, "number"); // mapowane z cena_m2
  const onlyWro = db.getListings("wroclaw");
  assert.equal(onlyWro.length, 1);
  assert.equal(onlyWro[0].id, "1");
});

test("getCities - lista miast w bazie", () => {
  const db = openDb(":memory:");
  db.ensureCity({ name: "Wrocław", slug: "wroclaw", wojewodztwo: "dolnoslaskie" });
  const cities = db.getCities();
  assert.equal(cities.length, 1);
  assert.equal(cities[0].slug, "wroclaw");
  assert.equal(cities[0].name, "Wrocław");
});

test("channel id - zapis i odczyt", () => {
  const db = openDb(":memory:");
  const city = db.ensureCity({ name: "Wrocław", slug: "wroclaw", wojewodztwo: "dolnoslaskie" });
  assert.equal(city.discord_channel_id, null);
  db.setChannelId(city.id, "999");
  assert.equal(db.getCityBySlug("wroclaw").discord_channel_id, "999");
});
```

- [ ] **Step 2: Uruchom (FAIL)**

Run: `node --test test/db.test.mjs`
Expected: FAIL (brak modulu).

- [ ] **Step 3: Implementacja**

Create `server/db.mjs`:
```javascript
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS cities (
  id                 INTEGER PRIMARY KEY,
  name               TEXT NOT NULL,
  slug               TEXT NOT NULL UNIQUE,
  wojewodztwo        TEXT NOT NULL,
  discord_channel_id TEXT,
  created_at         TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS listings (
  id               TEXT PRIMARY KEY,
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
  created_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_listings_city_id_created
  ON listings(city_id, created_at DESC);
`;

const nowIso = () => new Date().toISOString();

// wiersz DB (snake_case) -> ksztalt dashboardu
function toApi(r) {
  return {
    id: r.id, tytul: r.tytul, dzielnica: r.dzielnica,
    cena: r.cena, cenaM2: r.cena_m2, powierzchnia: r.powierzchnia,
    pokoje: r.pokoje, pietro: r.pietro, pieterWBudynku: r.pieter_w_budynku,
    rokBudowy: r.rok_budowy, lat: r.lat, lng: r.lng,
    liczbaZdjec: r.liczba_zdjec, link: r.link,
  };
}

export function openDb(path = "data/app.db") {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);

  const insertCity = db.prepare(
    "INSERT OR IGNORE INTO cities (name, slug, wojewodztwo, created_at) VALUES (?, ?, ?, ?)"
  );
  const selCityBySlug = db.prepare("SELECT * FROM cities WHERE slug = ?");
  const insertListing = db.prepare(`
    INSERT OR IGNORE INTO listings
      (id, city_id, tytul, dzielnica, cena, cena_m2, powierzchnia, pokoje, pietro,
       pieter_w_budynku, rok_budowy, lat, lng, liczba_zdjec, link, created_at)
    VALUES
      (@id, @city_id, @tytul, @dzielnica, @cena, @cena_m2, @powierzchnia, @pokoje, @pietro,
       @pieter_w_budynku, @rok_budowy, @lat, @lng, @liczba_zdjec, @link, @created_at)
  `);

  function ensureCity({ name, slug, wojewodztwo }) {
    insertCity.run(name, slug, wojewodztwo, nowIso());
    return selCityBySlug.get(slug);
  }
  function getCityBySlug(slug) {
    return selCityBySlug.get(slug);
  }
  function setChannelId(cityId, channelId) {
    db.prepare("UPDATE cities SET discord_channel_id = ? WHERE id = ?").run(channelId, cityId);
  }

  // Wstawia w transakcji, zwraca tylko NOWE oferty (ksztalt dashboardu).
  const upsertTx = db.transaction((cityId, offers) => {
    const fresh = [];
    for (const o of offers) {
      const info = insertListing.run({
        id: String(o.id), city_id: cityId,
        tytul: o.tytul, dzielnica: o.dzielnica,
        cena: o.cena, cena_m2: o.cenaM2, powierzchnia: o.powierzchnia,
        pokoje: o.pokoje, pietro: o.pietro, pieter_w_budynku: o.pieterWBudynku,
        rok_budowy: o.rokBudowy, lat: o.lat, lng: o.lng,
        liczba_zdjec: o.liczbaZdjec, link: o.link, created_at: nowIso(),
      });
      if (info.changes === 1) fresh.push(o);
    }
    return fresh;
  });
  function upsertListings(cityId, offers) {
    return upsertTx(cityId, offers);
  }

  function getCities() {
    return db
      .prepare("SELECT slug, name, wojewodztwo FROM cities ORDER BY name")
      .all();
  }
  function getListings(citySlug) {
    if (citySlug) {
      return db
        .prepare(`SELECT l.* FROM listings l JOIN cities c ON c.id = l.city_id
                  WHERE c.slug = ? ORDER BY l.created_at DESC`)
        .all(citySlug)
        .map(toApi);
    }
    return db.prepare("SELECT * FROM listings ORDER BY created_at DESC").all().map(toApi);
  }

  return {
    raw: db,
    ensureCity, getCityBySlug, setChannelId,
    upsertListings, getCities, getListings,
  };
}
```

- [ ] **Step 4: Uruchom (PASS)**

Run: `node --test test/db.test.mjs`
Expected: PASS (6 testow: dedup, ensureCity, getListings, getCities, channel id).

- [ ] **Step 5: Commit**

```powershell
git add server/db.mjs test/db.test.mjs
git commit -m "feat: warstwa SQLite (dedup, miasta, odczyty, mapowanie)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: discord.mjs - bot, kanaly, wysylka

**Files:**
- Create: `server/discord.mjs`

Logika sieciowa (discord.js) - weryfikacja reczna w Task 10. Brak testow jednostkowych
(zalezy od zywego API); testowalna czesc (nazwa kanalu) jest w `slug.js`.

- [ ] **Step 1: Implementacja**

Create `server/discord.mjs`:
```javascript
import { Client, GatewayIntentBits, ChannelType, EmbedBuilder } from "discord.js";
import { channelName } from "./slug.js";
import { formatPLN, formatInt, formatM2 } from "../public/format.js";

let clientPromise = null;

// Logowanie raz; brak tokena => null (Discord nieskonfigurowany).
export function getClient() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) return null;
  if (!clientPromise) {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    clientPromise = client.login(token).then(() => client);
  }
  return clientPromise;
}

// Wywolywane raz przy starcie serwera: jesli token jest, loguj bota od razu,
// by wczesnie wykryc zly token/guild id (a nie dopiero po scrapingu).
export async function initDiscordAtStartup() {
  const p = getClient();
  if (!p) { console.log("Discord nieskonfigurowany (brak DISCORD_TOKEN) - dziala tylko baza."); return; }
  try {
    const client = await p;
    await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
    console.log(`Discord: bot zalogowany jako ${client.user.tag}.`);
  } catch (e) {
    console.error("Discord: logowanie/guild nieudane - sprawdz DISCORD_TOKEN i DISCORD_GUILD_ID. " + e.message);
  }
}

async function createChannel(guild, city) {
  const ch = await guild.channels.create({
    name: channelName(city.name || city.slug),
    type: ChannelType.GuildText,
    reason: `Kanal ofert dla miasta ${city.name}`,
  });
  return ch;
}

// Zwraca kanal tekstowy dla miasta; tworzy gdy brak lub gdy stary zostal skasowany.
export async function ensureChannel(db, city) {
  const client = await getClient();
  if (!client) throw new Error("DISCORD_UNCONFIGURED");
  const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);

  if (city.discord_channel_id) {
    try {
      const existing = await guild.channels.fetch(city.discord_channel_id);
      if (existing) return existing; // fetch moze zwrocic null gdy kanal nie istnieje
    } catch (e) {
      if (e?.code !== 10003) throw e; // 10003 = Unknown Channel (skasowany recznie)
    }
  }
  const ch = await createChannel(guild, city); // brak/skasowany kanal -> tworzymy nowy
  db.setChannelId(city.id, ch.id);
  return ch;
}

function offerEmbed(o) {
  const linie = [
    `Dzielnica: ${o.dzielnica || "brak danych"}`,
    `Cena: ${formatPLN(o.cena)}`,
    `Cena/m2: ${formatInt(o.cenaM2)} zl/m2`,
    `Metraz: ${formatM2(o.powierzchnia)}`,
    `Pokoje: ${o.pokoje ?? "brak danych"}`,
  ].join("\n");
  return new EmbedBuilder()
    .setTitle(o.tytul || "Oferta")
    .setURL(o.link)
    .setDescription(linie)
    .setColor(0xff2d95);
}

// Wysyla oferty na kanal. discord.js sam kolejkuje zgodnie z rate-limitami.
export async function postListings(channel, offers) {
  for (const o of offers) {
    await channel.send({ embeds: [offerEmbed(o)] });
  }
}
```

- [ ] **Step 2: Kontrola skladni**

Run:
```powershell
node --check server/discord.mjs
```
Expected: brak wyjscia (skladnia OK). Pelna weryfikacja w Task 10.

- [ ] **Step 3: Commit**

```powershell
git add server/discord.mjs
git commit -m "feat: integracja Discord (kanaly dynamiczne, embedy ofert)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Serwer Express (createApp) + testy API

**Files:**
- Create: `server/app-factory.mjs`, `server/app.mjs`, `test/api.test.mjs`

`createApp` przyjmuje zaleznosci (db, scraper, Discord) przez wstrzykniecie, dzieki
czemu API da sie testowac z atrapami, bez sieci i bez Discorda. `app.mjs` tylko
podlacza realne zaleznosci i robi `listen`.

- [ ] **Step 1: Fabryka aplikacji**

Create `server/app-factory.mjs`:
```javascript
import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { slugify } from "./slug.js";
import { WOJEWODZTWA, isValidWojewodztwo } from "./wojewodztwa.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Zaleznosci wstrzykiwane: db, fetchListings, ensureChannel, postListings, discordConfigured().
export function createApp({ db, fetchListings, ensureChannel, postListings, discordConfigured }) {
  const app = express();
  app.use(express.json());
  app.use(express.static(join(__dirname, "..", "public")));

  const inFlight = new Set(); // blokada per slug miasta (anty-duplikat na Discord)

  app.get("/api/wojewodztwa", (_req, res) => res.json(WOJEWODZTWA));
  app.get("/api/cities", (_req, res) => res.json(db.getCities()));
  app.get("/api/listings", (req, res) => {
    const city = req.query.city ? slugify(String(req.query.city)) : undefined;
    res.json(db.getListings(city));
  });

  app.post("/api/fetch", async (req, res) => {
    const rawCity = String(req.body?.city ?? "").trim();
    const woj = String(req.body?.wojewodztwo ?? "").trim();
    const citySlug = slugify(rawCity);

    if (!rawCity || rawCity.length > 60 || !citySlug) {
      return res.status(400).json({ status: "bad_request", message: "Podaj poprawna nazwe miasta." });
    }
    if (!isValidWojewodztwo(woj)) {
      return res.status(400).json({ status: "bad_request", message: "Wybierz wojewodztwo z listy." });
    }
    if (inFlight.has(citySlug)) {
      return res.status(409).json({ status: "busy", message: "Pobieranie dla tego miasta juz trwa." });
    }

    inFlight.add(citySlug);
    try {
      const { status, items } = await fetchListings(citySlug, woj, 10);
      if (status === "blocked") {
        return res.json({ status, fetched: 0, new: 0, channel: null, discordOk: false,
          message: "Otodom zablokowal zapytanie (DataDome) lub blad sieci. Sprobuj pozniej." });
      }
      if (status === "parse_failed") {
        return res.json({ status, fetched: 0, new: 0, channel: null, discordOk: false,
          message: "Nie udalo sie odczytac danych z otodom." });
      }
      if (status === "empty" || items.length === 0) {
        return res.json({ status: "empty", fetched: 0, new: 0, channel: null, discordOk: false,
          message: "Brak ofert dla tego miasta (sprawdz pisownie; dziala dla miast na prawach powiatu)." });
      }

      const city = db.ensureCity({ name: rawCity, slug: citySlug, wojewodztwo: woj });
      const fresh = db.upsertListings(city.id, items);

      // Discord nieskonfigurowany: zapis do bazy OK, wysylka pominieta (niezaleznie od liczby nowych).
      if (!discordConfigured()) {
        return res.json({ status: "discord_unconfigured", fetched: items.length, new: fresh.length,
          channel: null, discordOk: false,
          message: `Pobrano ${items.length}, nowych ${fresh.length}. Discord nieskonfigurowany - oferty w bazie.` });
      }
      if (fresh.length === 0) {
        return res.json({ status: "ok", fetched: items.length, new: 0, channel: null, discordOk: true,
          message: `Pobrano ${items.length}, nowych 0.` });
      }
      try {
        const cityRow = db.getCityBySlug(citySlug);
        const ch = await ensureChannel(db, cityRow);
        await postListings(ch, fresh);
        return res.json({ status: "ok", fetched: items.length, new: fresh.length, channel: ch.name,
          discordOk: true, message: `Pobrano ${items.length}, nowych ${fresh.length}, kanal #${ch.name}.` });
      } catch (e) {
        return res.json({ status: "ok", fetched: items.length, new: fresh.length, channel: null,
          discordOk: false,
          message: `Pobrano ${items.length}, nowych ${fresh.length}. Zapisano w bazie, ale wysylka na Discord sie nie udala.` });
      }
    } catch (e) {
      return res.status(500).json({ status: "error", message: "Blad serwera: " + e.message });
    } finally {
      inFlight.delete(citySlug);
    }
  });

  return app;
}
```

- [ ] **Step 2: Plik startowy app.mjs**

Create `server/app.mjs`:
```javascript
import "dotenv/config";
import { createApp } from "./app-factory.mjs";
import { openDb } from "./db.mjs";
import { fetchListings } from "./otodom.mjs";
import { ensureChannel, postListings, initDiscordAtStartup } from "./discord.mjs";

const PORT = process.env.PORT || 3000;
const db = openDb("data/app.db");

const app = createApp({
  db, fetchListings, ensureChannel, postListings,
  discordConfigured: () => !!process.env.DISCORD_TOKEN,
});

await initDiscordAtStartup(); // loguj bota przy starcie (jesli token jest)
app.listen(PORT, () => console.log(`Serwer dziala: http://localhost:${PORT}`));
```

- [ ] **Step 3: Testy API (z atrapami)**

Create `test/api.test.mjs`:
```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app-factory.mjs";
import { openDb } from "../server/db.mjs";

function sample(id) {
  return { id: String(id), tytul: "t" + id, dzielnica: "Krzyki",
    cena: 800000, cenaM2: 14000, powierzchnia: 55, pokoje: 3,
    pietro: 2, pieterWBudynku: 5, rokBudowy: 2019, lat: 51, lng: 17,
    liczbaZdjec: 10, link: "http://x/" + id };
}

// Buduje aplikacje z atrapami na losowym porcie. Zwraca { base, db, calls, close }.
function boot(opts = {}) {
  const calls = { post: 0, ensure: 0 };
  const db = openDb(":memory:");
  const app = createApp({
    db,
    fetchListings: opts.fetchListings || (async () => ({ status: "ok", items: [sample(1), sample(2)] })),
    ensureChannel: async (_db, city) => { calls.ensure++; return { name: city.slug, id: "chan-" + city.slug }; },
    postListings: async (_ch, offers) => { calls.post += offers.length; },
    discordConfigured: () => opts.discordConfigured ?? true,
  });
  const server = app.listen(0);
  const { port } = server.address();
  return { base: `http://127.0.0.1:${port}`, db, calls, close: () => server.close() };
}

const post = (base, body) => fetch(base + "/api/fetch", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

test("POST /api/fetch - puste miasto => 400 bad_request", async () => {
  const a = boot();
  const r = await post(a.base, { city: "", wojewodztwo: "dolnoslaskie" });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).status, "bad_request");
  a.close();
});

test("POST /api/fetch - zle wojewodztwo => 400", async () => {
  const a = boot();
  const r = await post(a.base, { city: "Wroclaw", wojewodztwo: "atlantyda" });
  assert.equal(r.status, 400);
  a.close();
});

test("POST /api/fetch - empty => status empty, new 0", async () => {
  const a = boot({ fetchListings: async () => ({ status: "empty", items: [] }) });
  const r = await post(a.base, { city: "Pcim", wojewodztwo: "malopolskie" });
  const j = await r.json();
  assert.equal(j.status, "empty");
  assert.equal(j.new, 0);
  a.close();
});

test("POST /api/fetch - nowe oferty + Discord on => wysylka i kanal", async () => {
  const a = boot({ discordConfigured: true });
  const j = await (await post(a.base, { city: "Wroclaw", wojewodztwo: "dolnoslaskie" })).json();
  assert.equal(j.status, "ok");
  assert.equal(j.new, 2);
  assert.equal(j.discordOk, true);
  assert.equal(j.channel, "wroclaw");
  assert.equal(a.calls.post, 2);
  a.close();
});

test("POST /api/fetch - Discord off => discord_unconfigured, brak wysylki, oferty w bazie", async () => {
  const a = boot({ discordConfigured: false });
  const j = await (await post(a.base, { city: "Wroclaw", wojewodztwo: "dolnoslaskie" })).json();
  assert.equal(j.status, "discord_unconfigured");
  assert.equal(j.new, 2);
  assert.equal(a.calls.post, 0);
  const listings = await (await fetch(a.base + "/api/listings?city=wroclaw")).json();
  assert.equal(listings.length, 2);
  a.close();
});

test("POST /api/fetch - drugie pobranie => 0 nowych (dedup)", async () => {
  const a = boot();
  await post(a.base, { city: "Wroclaw", wojewodztwo: "dolnoslaskie" });
  const j = await (await post(a.base, { city: "Wroclaw", wojewodztwo: "dolnoslaskie" })).json();
  assert.equal(j.new, 0);
  a.close();
});

test("POST /api/fetch - rownolegly fetch tego samego miasta => 409 busy", async () => {
  let release;
  const gate = new Promise((r) => (release = r));
  const a = boot({ fetchListings: async () => { await gate; return { status: "ok", items: [sample(1)] }; } });
  const p1 = post(a.base, { city: "Wroclaw", wojewodztwo: "dolnoslaskie" });
  await new Promise((r) => setTimeout(r, 50)); // p1 wszedl w handler i czeka na gate
  const r2 = await post(a.base, { city: "Wroclaw", wojewodztwo: "dolnoslaskie" });
  assert.equal(r2.status, 409);
  release();
  await p1;
  a.close();
});

test("GET /api/cities - pusta baza => []", async () => {
  const a = boot();
  const cities = await (await fetch(a.base + "/api/cities")).json();
  assert.deepEqual(cities, []);
  a.close();
});
```

- [ ] **Step 4: Kontrola skladni i testy API**

Run:
```powershell
node --check server/app-factory.mjs
node --check server/app.mjs
node --test test/api.test.mjs
```
Expected: kontrola bez wyjscia; testy API PASS (walidacja, empty, Discord on/off, dedup, 409, cities).

- [ ] **Step 5: Smoke test startu (bez Discord)**

Run (uruchom, sprawdz log, zatrzymaj Ctrl+C):
```powershell
node server/app.mjs
```
Expected: `Discord nieskonfigurowany...` (gdy brak .env) i `Serwer dziala: http://localhost:3000`.
W innym oknie:
```powershell
curl.exe -s http://localhost:3000/api/cities
```
Expected: `[]`. Zatrzymaj serwer.

- [ ] **Step 6: Commit**

```powershell
git add server/app-factory.mjs server/app.mjs test/api.test.mjs
git commit -m "feat: serwer Express (createApp z wstrzykiwaniem) + testy API" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: render.js - wykresy SVG

**Files:**
- Create: `public/render.js` (Start ma tylko puste zaslepki - implementujemy od zera)

Eksportuje `renderSummary`, `renderDistricts`, `renderScatter`. Czyste DOM/SVG,
bez zaleznosci. Brak testow jednostkowych (DOM); weryfikacja wizualna w Task 10.

- [ ] **Step 1: Implementacja**

Create `public/render.js`:
```javascript
import { formatPLN, formatInt, formatM2 } from "./format.js";
import { summary, statsByDistrict } from "./stats.js";

const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
const empty = (msg) => `<div class="empty">${msg}</div>`;
// Escapowanie danych z otodom przed wstawieniem do innerHTML (ochrona przed XSS).
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function renderSummary(offers) {
  const s = summary(offers);
  const box = document.getElementById("summary");
  const kpi = (val, lab) => `<div class="kpi"><div class="val">${val}</div><div class="lab">${lab}</div></div>`;
  box.innerHTML =
    kpi(formatInt(s.count), "ofert") +
    kpi(formatPLN(s.medianCena), "mediana ceny") +
    kpi(s.medianCenaM2 == null ? "-" : formatInt(s.medianCenaM2) + " zł/m²", "mediana ceny/m²") +
    kpi(formatM2(s.medianPowierzchnia), "mediana metrażu");
}

export function renderDistricts(offers, metric = "cenaM2") {
  const host = document.getElementById("chart-districts");
  const rows = statsByDistrict(offers, metric);
  if (rows.length === 0) { host.innerHTML = empty("Brak ofert dla wybranych filtrów"); return; }

  const W = 720, rowH = 30, pad = 160, max = Math.max(...rows.map((r) => r.value));
  const H = rows.length * rowH + 20;
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}` });
  rows.forEach((r, i) => {
    const y = i * rowH + 10;
    const w = max > 0 ? (W - pad - 20) * (r.value / max) : 0;
    const label = el("text", { x: 0, y: y + 16, fill: "#a89fd6", "font-size": "13" });
    label.textContent = r.dzielnica || "brak dzielnicy";
    svg.appendChild(label);
    const bar = el("rect", { x: pad, y, width: w, height: rowH - 10, rx: 6, fill: "url(#grad)", class: "bar" });
    bar.addEventListener("mousemove", (e) => showTip(e,
      `<b>${esc(r.dzielnica || "brak dzielnicy")}</b><br>mediana: ${formatInt(r.value)}<br>ofert: ${r.count}<br>zakres: ${formatInt(r.min)} - ${formatInt(r.max)}`));
    bar.addEventListener("mouseleave", hideTip);
    svg.appendChild(bar);
    const val = el("text", { x: pad + w + 6, y: y + 16, fill: "#f3f0ff", "font-size": "12", "font-weight": "700" });
    val.textContent = formatInt(r.value);
    svg.appendChild(val);
  });
  const defs = el("defs");
  const grad = el("linearGradient", { id: "grad", x1: "0", x2: "1", y1: "0", y2: "0" });
  grad.appendChild(el("stop", { offset: "0", "stop-color": "#7a2dff" }));
  grad.appendChild(el("stop", { offset: "1", "stop-color": "#ff2d95" }));
  defs.appendChild(grad); svg.appendChild(defs);
  host.replaceChildren(svg);
}

const ROOM_COLORS = { "1": "#00e5ff", "2": "#b6ff00", "3": "#ff2d95", "4+": "#7a2dff" };
const bucket = (p) => (p >= 4 ? "4+" : String(p));

export function renderScatter(offers) {
  const host = document.getElementById("chart-scatter");
  const pts = offers.filter((o) => typeof o.powierzchnia === "number" && typeof o.cena === "number");
  if (pts.length === 0) { host.innerHTML = empty("Brak ofert dla wybranych filtrów"); return; }

  const W = 720, H = 420, m = 50;
  const xs = pts.map((o) => o.powierzchnia), ys = pts.map((o) => o.cena);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const sx = (v) => m + (W - 2 * m) * ((v - xMin) / (xMax - xMin || 1));
  const sy = (v) => H - m - (H - 2 * m) * ((v - yMin) / (yMax - yMin || 1));

  const svg = el("svg", { viewBox: `0 0 ${W} ${H}` });
  svg.appendChild(el("line", { x1: m, y1: H - m, x2: W - m, y2: H - m, stroke: "#3a3260" }));
  svg.appendChild(el("line", { x1: m, y1: m, x2: m, y2: H - m, stroke: "#3a3260" }));
  for (const o of pts) {
    const c = el("circle", { cx: sx(o.powierzchnia), cy: sy(o.cena), r: 6,
      fill: ROOM_COLORS[bucket(o.pokoje)] || "#888", class: "dot" });
    c.addEventListener("click", () => window.open(o.link, "_blank"));
    c.addEventListener("mousemove", (e) => showTip(e,
      `<b>${esc(o.tytul)}</b><br>${esc(o.dzielnica || "brak dzielnicy")}<br>${formatPLN(o.cena)} &middot; ${formatM2(o.powierzchnia)} &middot; ${o.pokoje} pok.`));
    c.addEventListener("mouseleave", hideTip);
    svg.appendChild(c);
  }
  host.replaceChildren(svg);
  const legend = document.createElement("div");
  legend.className = "legend";
  legend.innerHTML = Object.entries(ROOM_COLORS)
    .map(([k, v]) => `<span><i style="background:${v}"></i>${k} pok.</span>`).join("");
  host.appendChild(legend);
}

function showTip(e, html) {
  const t = document.getElementById("tooltip");
  t.innerHTML = html; t.hidden = false;
  t.style.left = e.clientX + 14 + "px"; t.style.top = e.clientY + 14 + "px";
}
function hideTip() { document.getElementById("tooltip").hidden = true; }
```

- [ ] **Step 2: Kontrola skladni**

Run:
```powershell
node --check public/render.js
```
Expected: brak wyjscia.

- [ ] **Step 3: Commit**

```powershell
git add public/render.js
git commit -m "feat: wykresy SVG (summary, dzielnice, scatter)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Frontend - index.html + app.js + style formularza

**Files:**
- Create: `public/index.html`, `public/app.js`
- Modify: `public/styles.css` (dopisz style formularza na koncu)

- [ ] **Step 1: index.html**

Create `public/index.html`:
```html
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mieszkania - otodom -> Discord</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<header class="hero">
  <h1>Mieszkania <span>otodom</span></h1>
  <p>Pobierz najnowsze oferty i wyslij je na Discord</p>
</header>

<section class="fetch-form">
  <form id="fetch-form">
    <label>Miasto <input id="city" name="city" type="text" placeholder="np. Wroclaw" maxlength="60" required></label>
    <label>Wojewodztwo <select id="woj" name="wojewodztwo" required></select></label>
    <button id="fetch-btn" type="submit">Pobierz 10 najnowszych</button>
  </form>
  <p class="hint">Dziala dla miast na prawach powiatu (Wroclaw, Krakow, Warszawa, ...).</p>
  <p id="fetch-msg" class="fetch-msg" hidden></p>
</section>

<section class="filters-row">
  <label>Pokaz miasto <select id="city-filter"><option value="">wszystkie</option></select></label>
</section>

<section id="summary" class="summary"></section>

<main class="charts">
  <section class="card">
    <div class="card-head">
      <h2>Ceny wg dzielnicy</h2>
      <button id="metric-toggle" type="button">Pokaz cene calkowita</button>
    </div>
    <div id="chart-districts" class="chart"></div>
  </section>
  <section class="card">
    <div class="card-head"><h2>Cena vs powierzchnia</h2></div>
    <div id="chart-scatter" class="chart"></div>
  </section>
</main>

<div id="tooltip" class="tooltip" hidden></div>
<script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: app.js**

Create `public/app.js`:
```javascript
import { renderSummary, renderDistricts, renderScatter } from "./render.js";

let metric = "cenaM2";

// Escapowanie wartosci uzytkownika/otodom przed wstawieniem do innerHTML.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function loadWojewodztwa() {
  const list = await (await fetch("/api/wojewodztwa")).json();
  const sel = document.getElementById("woj");
  sel.innerHTML = list.map((w) => `<option value="${esc(w.slug)}">${esc(w.label)}</option>`).join("");
}

async function loadCities() {
  const cities = await (await fetch("/api/cities")).json();
  const sel = document.getElementById("city-filter");
  const current = sel.value;
  sel.innerHTML = '<option value="">wszystkie</option>' +
    cities.map((c) => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join("");
  sel.value = current;
}

async function loadListings() {
  const city = document.getElementById("city-filter").value;
  const url = city ? `/api/listings?city=${encodeURIComponent(city)}` : "/api/listings";
  const offers = await (await fetch(url)).json();
  renderSummary(offers);
  renderDistricts(offers, metric);
  renderScatter(offers);
}

document.getElementById("fetch-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("fetch-btn");
  const msg = document.getElementById("fetch-msg");
  const city = document.getElementById("city").value.trim();
  const wojewodztwo = document.getElementById("woj").value;
  btn.disabled = true; btn.textContent = "Pobieram...";
  msg.hidden = false; msg.textContent = "Pobieranie ofert (kilka sekund)...";
  try {
    const r = await fetch("/api/fetch", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, wojewodztwo }),
    });
    const data = await r.json();
    msg.textContent = data.message;
    await loadCities();
    await loadListings();
  } catch (err) {
    msg.textContent = "Blad polaczenia: " + err.message;
  } finally {
    btn.disabled = false; btn.textContent = "Pobierz 10 najnowszych";
  }
});

document.getElementById("city-filter").addEventListener("change", loadListings);
document.getElementById("metric-toggle").addEventListener("click", (e) => {
  metric = metric === "cenaM2" ? "cena" : "cenaM2";
  e.target.textContent = metric === "cenaM2" ? "Pokaz cene calkowita" : "Pokaz cene za m2";
  loadListings();
});

await loadWojewodztwa();
await loadCities();
await loadListings();
```

- [ ] **Step 3: Dopisz style formularza do styles.css**

Append na koncu `public/styles.css`:
```css
.fetch-form { background: var(--bg-card); border-radius: var(--radius); padding: 20px; margin-bottom: 20px; box-shadow: 0 0 24px rgba(0,229,255,.15); }
.fetch-form form { display: flex; flex-wrap: wrap; gap: 16px; align-items: end; }
.fetch-form label { display: flex; flex-direction: column; gap: 6px; font-size: .8rem; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; }
.fetch-form input, .fetch-form select, .filters-row select {
  background: var(--bg); color: var(--text); border: 2px solid var(--accent2);
  border-radius: 10px; padding: 10px 12px; font-size: 1rem; min-width: 200px;
}
#fetch-btn {
  background: linear-gradient(90deg, var(--accent3), var(--accent4)); color: #0d0b1f;
  border: none; border-radius: 999px; padding: 12px 20px; font-weight: 800; cursor: pointer; font-size: .95rem;
}
#fetch-btn:disabled { opacity: .6; cursor: progress; }
.fetch-form .hint { color: var(--muted); font-size: .8rem; margin: 12px 0 0; }
.fetch-msg { margin: 10px 0 0; font-weight: 700; color: var(--accent3); }
.filters-row { margin-bottom: 20px; }
.filters-row label { display: flex; flex-direction: column; gap: 6px; font-size: .8rem; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; }
```

- [ ] **Step 4: Smoke test frontu**

Run:
```powershell
node server/app.mjs
```
Otworz `http://localhost:3000` w przegladarce. Expected: strona laduje sie bez bledow
w konsoli; formularz ma dropdown z 16 wojewodztwami; wykresy pokazuja "Brak ofert"
(pusta baza). Zatrzymaj serwer.

- [ ] **Step 5: Commit**

```powershell
git add public/index.html public/app.js public/styles.css
git commit -m "feat: front - formularz pobierania + dashboard na API" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: README.md - instrukcja krok po kroku (deliverable koncowy)

**Files:**
- Create: `README.md`

- [ ] **Step 1: Napisz README**

Create `README.md` z pelna instrukcja. Tresc:

```markdown
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

Serwery Discord sa darmowe. Twoje konto moze nalezec do maksymalnie 100 serwerow.
Osobny limit dotyczy botow: niezweryfikowany bot moze byc maksymalnie na 100 serwerach
(weryfikacja wymagana dopiero powyzej). Przy hobbystycznym uzyciu na wlasnym serwerze
zaden z tych limitow nie jest problemem.

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
```

- [ ] **Step 2: Commit**

```powershell
git add README.md
git commit -m "docs: instrukcja krok po kroku (Discord, .env, uruchomienie)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Weryfikacja end-to-end

**Files:** brak (weryfikacja reczna)

- [ ] **Step 1: Cala bateria testow**

Run:
```powershell
npm test
```
Expected: PASS - slug, wojewodztwa, otodom (czesc czysta), db (dedup), stats, format.

- [ ] **Step 2: Weryfikacja bez Discord (scraper + baza + dashboard)**

Tymczasowo bez tokena (lub z pustym `DISCORD_TOKEN`):
1. `npm start`, otworz http://localhost:3000.
2. Pobierz realne miasto (np. Wroclaw / dolnoslaskie).
Expected: komunikat "nowych N", status `discord_unconfigured` lub `ok`; wykresy
pokazuja dane; `data/app.db` powstal. Drugie pobranie: "nowych 0".

- [ ] **Step 3: Weryfikacja z Discord**

Z poprawnym `.env` (token + guild id):
1. `npm start`, pobierz miasto z nowymi ofertami.
Expected: na serwerze Discord powstaje kanal o nazwie miasta, w nim embedy ofert
(tytul = link, dzielnica, cena, cena/m2, metraz, pokoje). Drugie pobranie tego samego
miasta nie wysyla duplikatow.

- [ ] **Step 4: Przypadki brzegowe (reczne)**

- Bledne miasto (literowki) -> komunikat "Brak ofert..." (status `empty`).
- Puste miasto / brak wojewodztwa -> walidacja (HTTP 400, czytelny komunikat).
- Skasuj recznie kanal na Discord, pobierz ponownie -> kanal odtworzony.

- [ ] **Step 5: Finalny commit (jesli byly poprawki)**

```powershell
git add -A
git commit -m "test: weryfikacja end-to-end i poprawki" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Mapowanie planu na spec (self-review)

- Spec sek. 2 (stos) -> Task 0 (package.json z wersjami).
- Spec sek. 3 (struktura) -> Task 0 + pliki w kolejnych taskach.
- Spec sek. 4 (przeplyw, in-flight, transakcja) -> Task 6 (app) + Task 4 (transakcja).
- Spec sek. 5 (URL, slug, ograniczenie) -> Task 1 (slug), Task 3 (buildUrl), Task 8 (hint), Task 9 (README).
- Spec sek. 6 (schemat, dedup, id TEXT, indeks, data/) -> Task 4.
- Spec sek. 7 (Discord, ensureChannel, Unknown Channel, nazwa kanalu) -> Task 1 (channelName) + Task 5.
- Spec sek. 8 (API, schemat odpowiedzi, walidacja, 400/409) -> Task 6.
- Spec sek. 9 (front, mapowanie pol) -> Task 4 (toApi), Task 7, Task 8.
- Spec sek. 10 (konfiguracja, .env) -> Task 0 + Task 9.
- Spec sek. 11 (statusy bledow) -> Task 3 (extractNextData/fetchListings) + Task 6.
- Spec sek. 12 (testy) -> Task 1-4 + Task 10.
- Spec sek. 13 (README) -> Task 9.

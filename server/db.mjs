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

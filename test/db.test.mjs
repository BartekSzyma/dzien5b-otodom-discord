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
  assert.equal(typeof all[0].cenaM2, "number");
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

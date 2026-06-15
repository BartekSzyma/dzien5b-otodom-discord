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

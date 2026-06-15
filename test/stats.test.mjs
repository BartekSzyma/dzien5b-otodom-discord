import { test } from "node:test";
import assert from "node:assert/strict";
import { median } from "../public/stats.js";

test("median - nieparzysta liczba elementów", () => {
  assert.equal(median([3, 1, 2]), 2);
});

test("median - parzysta liczba elementów (średnia środkowych)", () => {
  assert.equal(median([1, 2, 3, 4]), 2.5);
});

test("median - pusta tablica zwraca null", () => {
  assert.equal(median([]), null);
});

test("median - ignoruje null/NaN", () => {
  assert.equal(median([2, null, 4]), 3);
});

import { roomsBucket, applyFilters } from "../public/stats.js";

const sample = [
  { dzielnica: "Azory", pokoje: 2 },
  { dzielnica: "Azory", pokoje: 3 },
  { dzielnica: "Chelm", pokoje: 4 },
  { dzielnica: "Chelm", pokoje: 5 },
];

test("roomsBucket - 4 i więcej grupuje do 4+", () => {
  assert.equal(roomsBucket(3), "3");
  assert.equal(roomsBucket(4), "4+");
  assert.equal(roomsBucket(5), "4+");
});

test("applyFilters - brak filtrów zwraca wszystko", () => {
  assert.equal(applyFilters(sample, {}).length, 4);
});

test("applyFilters - filtr dzielnicy", () => {
  const r = applyFilters(sample, { districts: ["Azory"] });
  assert.equal(r.length, 2);
  assert.ok(r.every((o) => o.dzielnica === "Azory"));
});

test("applyFilters - filtr pokoi z 4+", () => {
  const r = applyFilters(sample, { rooms: ["4+"] });
  assert.equal(r.length, 2);
});

test("applyFilters - dzielnica i pokoje łącznie", () => {
  const r = applyFilters(sample, { districts: ["Chelm"], rooms: ["4+"] });
  assert.equal(r.length, 2);
});

import { statsByDistrict } from "../public/stats.js";

const byDist = [
  { dzielnica: "Azory", cenaM2: 15000, cena: 800000 },
  { dzielnica: "Azory", cenaM2: 21000, cena: 900000 },
  { dzielnica: "Chelm", cenaM2: 17000, cena: 2400000 },
];

test("statsByDistrict - mediana, liczba, min, max wg cenaM2", () => {
  const rows = statsByDistrict(byDist, "cenaM2");
  const azory = rows.find((r) => r.dzielnica === "Azory");
  assert.equal(azory.value, 18000);
  assert.equal(azory.count, 2);
  assert.equal(azory.min, 15000);
  assert.equal(azory.max, 21000);
});

test("statsByDistrict - sortowanie malejąco wg value", () => {
  const rows = statsByDistrict(byDist, "cenaM2");
  assert.deepEqual(rows.map((r) => r.dzielnica), ["Azory", "Chelm"]);
});

test("statsByDistrict - metryka cena", () => {
  const rows = statsByDistrict(byDist, "cena");
  assert.equal(rows[0].dzielnica, "Chelm");
  assert.equal(rows[0].value, 2400000);
});

import { summary } from "../public/stats.js";

test("summary - liczy mediany i count", () => {
  const s = summary([
    { cena: 800000, cenaM2: 15000, powierzchnia: 50 },
    { cena: 900000, cenaM2: 17000, powierzchnia: 60 },
    { cena: 1000000, cenaM2: 19000, powierzchnia: 70 },
  ]);
  assert.equal(s.count, 3);
  assert.equal(s.medianCena, 900000);
  assert.equal(s.medianCenaM2, 17000);
  assert.equal(s.medianPowierzchnia, 60);
});

test("summary - pusty zbiór", () => {
  const s = summary([]);
  assert.equal(s.count, 0);
  assert.equal(s.medianCena, null);
});

test("statsByDistrict - ignoruje wartosci null w min/max/medianie", () => {
  const rows = statsByDistrict([
    { dzielnica: "A", cena: null },
    { dzielnica: "A", cena: 800000 },
    { dzielnica: "A", cena: 1000000 },
  ], "cena");
  const a = rows.find((r) => r.dzielnica === "A");
  assert.equal(a.value, 900000);
  assert.equal(a.min, 800000);
  assert.equal(a.max, 1000000);
  assert.equal(a.count, 2);
});

test("statsByDistrict - pomija dzielnice bez prawidlowych wartosci", () => {
  const rows = statsByDistrict([
    { dzielnica: "Pusta", cena: null },
    { dzielnica: "B", cena: 500000 },
  ], "cena");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].dzielnica, "B");
});

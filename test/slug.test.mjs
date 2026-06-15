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

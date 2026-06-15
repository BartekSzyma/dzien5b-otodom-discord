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

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

import { test } from "node:test";
import assert from "node:assert/strict";
import { formatInt, formatPLN, formatM2 } from "../public/format.js";

test("formatInt - spacje jako separator tysięcy", () => {
  assert.equal(formatInt(884500), "884 500");
  assert.equal(formatInt(2399000), "2 399 000");
  assert.equal(formatInt(975914.88), "975 915");
});

test("formatInt - null/NaN zwraca kreskę", () => {
  assert.equal(formatInt(null), "-");
  assert.equal(formatInt(NaN), "-");
});

test("formatPLN - dodaje zł", () => {
  assert.equal(formatPLN(884500), "884 500 zł");
  assert.equal(formatPLN(null), "-");
});

test("formatM2 - przecinek dziesiętny i jednostka", () => {
  assert.equal(formatM2(61), "61 m²");
  assert.equal(formatM2(61.09), "61,09 m²");
  assert.equal(formatM2(null), "-");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone } from "../src/phone.ts";

test("телефон: разные форматы приводятся к +77012345678", () => {
  assert.equal(normalizePhone("+7 701 234 56 78"), "+77012345678");
  assert.equal(normalizePhone("87012345678"), "+77012345678");
  assert.equal(normalizePhone("8 (701) 234-56-78"), "+77012345678");
  assert.equal(normalizePhone("+7 (777) 123-45-67"), "+77771234567");
});

test("телефон: неправильные номера", () => {
  assert.equal(normalizePhone(""), null);
  assert.equal(normalizePhone("12345"), null);
  assert.equal(normalizePhone("+7 701 234 56 7"), null); // too short
  assert.equal(normalizePhone("+7 701 234 56 789"), null); // too long
  assert.equal(normalizePhone("+7 727 234 56 78"), null); // city number, not mobile
  assert.equal(normalizePhone("+1 701 234 56 78"), null); // not Kazakhstan
  assert.equal(normalizePhone("8 701 abc 56 78"), null); // letters
});

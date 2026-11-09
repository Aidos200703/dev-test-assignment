import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { assignOrder, getLoad, resetDispatch } from "../src/dispatch.ts";
import { getAlmatyDate, isValidDate } from "../src/time.ts";
import type { Branch, Order } from "../src/types.ts";

// Branch 1: limit 1 only
const branch1: Branch = {
  id: "b-1",
  storeId: "s-1",
  name: "Филиал 1",
  city: "Алматы",
  lat: 43.24,
  lon: 76.91,
  active: true,
  pickupPointIds: ["pp-1"],
  dailyLimit: 1,
};

// Branch 2: in the same city, a little further away
const branch2: Branch = {
  id: "b-2",
  storeId: "s-1",
  name: "Филиал 2",
  city: "Алматы",
  lat: 43.3,
  lon: 76.95,
  active: true,
  pickupPointIds: [],
  dailyLimit: 10,
};

function makeOrder(id: string, createdAt: string): Order {
  return {
    id: id,
    storeId: "s-1",
    city: "Алматы",
    lat: 43.24,
    lon: 76.91,
    pickupPointId: "pp-1",
    manualBranchId: null,
    createdAt: createdAt,
  };
}

beforeEach(() => {
  resetDispatch();
});

test("getAlmatyDate: сутки по UTC+5", () => {
  assert.equal(getAlmatyDate("2026-11-15T18:59:00Z"), "2026-11-15");
  assert.equal(getAlmatyDate("2026-11-15T19:00:00Z"), "2026-11-16");
});

test("isValidDate: правильные и неправильные даты", () => {
  assert.equal(isValidDate("2026-11-16"), true);
  assert.equal(isValidDate("2026-02-30"), false);
  assert.equal(isValidDate("16.11.2026"), false);
  assert.equal(isValidDate("abc"), false);
});

test("повторный вызов не занимает лимит ещё раз", () => {
  const first = assignOrder(makeOrder("o-1", "2026-11-16T05:00:00Z"), [
    branch1,
    branch2,
  ]);
  const second = assignOrder(makeOrder("o-1", "2026-11-16T05:00:00Z"), [
    branch1,
    branch2,
  ]);
  assert.deepEqual(second, first);
  assert.equal(getLoad("b-1", "2026-11-16"), 1);
});

test("заполненный филиал пропускается", () => {
  const first = assignOrder(makeOrder("o-1", "2026-11-16T05:00:00Z"), [
    branch1,
    branch2,
  ]);
  assert.equal(first.branchId, "b-1");

  // b-1 is full (limit 1) — the order will go to b-2
  const second = assignOrder(makeOrder("o-2", "2026-11-16T10:00:00Z"), [
    branch1,
    branch2,
  ]);
  assert.deepEqual(second, { orderId: "o-2", branchId: "b-2", rule: "geo" });
});

test("лимит считается по суткам Алматы", () => {
  assignOrder(makeOrder("o-1", "2026-11-16T05:00:00Z"), [branch1, branch2]);

  // 19:00 UTC = 00:00 the next day in Almaty — limit is free again
  const next = assignOrder(makeOrder("o-2", "2026-11-16T19:00:00Z"), [
    branch1,
    branch2,
  ]);
  assert.equal(next.branchId, "b-1");
});

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { cancelBooking, createBooking } from "../src/bookings.ts";
import type { Booking } from "../src/types.ts";

// Data from data/*.json is used here.
// m-1 on 2030-11-18 (Monday): works 10:00-19:00, break 14:00-15:00,
// already booked 10:00-11:00 (bk-1) and 12:30-13:00 (bk-2).

beforeEach(() => {
  // current time for clock.ts
  process.env.NOW = "2030-11-18T00:00:00Z";
});

function request(start: string) {
  return {
    masterId: "m-1",
    serviceId: "s-cut",
    start: start,
    clientPhone: "8 (701) 234-56-78",
  };
}

test("создание: успешная запись", async () => {
  const res = await createBooking(request("2030-11-18T15:00:00+05:00"));
  assert.equal(res.status, 201);

  const booking = res.body as Booking;
  assert.equal(booking.start, "2030-11-18T10:00:00.000Z");
  assert.equal(booking.end, "2030-11-18T11:00:00.000Z");
  assert.equal(booking.clientPhone, "+77012345678");
  assert.equal(booking.status, "active");
});

test("создание: start в UTC тоже принимается", async () => {
  // 11:00Z = 16:00 Almaty
  const res = await createBooking(request("2030-11-18T11:00:00Z"));
  assert.equal(res.status, 201);
});

test("создание: занятое время — 409", async () => {
  // 10:00 Almaty is taken by bk-1
  const res = await createBooking(request("2030-11-18T10:00:00+05:00"));
  assert.equal(res.status, 409);
  assert.deepEqual(res.body, { error: "slot_unavailable" });
});

test("создание: время не по сетке слотов — 409", async () => {
  const res = await createBooking(request("2030-11-18T17:10:00+05:00"));
  assert.equal(res.status, 409);
});

test("создание: неправильный телефон — 400", async () => {
  const res = await createBooking({
    ...request("2030-11-18T17:00:00+05:00"),
    clientPhone: "123",
  });
  assert.equal(res.status, 400);
});

test("создание: start без часового пояса — 400", async () => {
  const res = await createBooking(request("2030-11-18T17:00:00"));
  assert.equal(res.status, 400);
});

test("создание: нет мастера — 404", async () => {
  const res = await createBooking({
    ...request("2030-11-18T17:00:00+05:00"),
    masterId: "m-999",
  });
  assert.equal(res.status, 404);
});

test("создание: мастер не оказывает услугу — 400", async () => {
  const res = await createBooking({
    ...request("2030-11-18T17:00:00+05:00"),
    serviceId: "s-mani",
  });
  assert.equal(res.status, 400);
});

test("создание: два клиента одновременно на одно время — создаётся одна запись", async () => {
  const [a, b] = await Promise.all([
    createBooking(request("2030-11-20T11:00:00+05:00")),
    createBooking(request("2030-11-20T11:00:00+05:00")),
  ]);
  const statuses = [a.status, b.status].sort();
  assert.deepEqual(statuses, [201, 409]);
});

test("создание: одновременно на пересекающееся время — создаётся одна запись", async () => {
  // 12:00-13:00 and 12:30-13:30 overlap
  const [a, b] = await Promise.all([
    createBooking(request("2030-11-20T12:00:00+05:00")),
    createBooking(request("2030-11-20T12:30:00+05:00")),
  ]);
  const statuses = [a.status, b.status].sort();
  assert.deepEqual(statuses, [201, 409]);
});

test("отмена: запись становится cancelled, повторная отмена — 200", async () => {
  const created = await createBooking(request("2030-11-21T16:00:00+05:00"));
  const id = (created.body as Booking).id;

  const first = await cancelBooking(id);
  assert.equal(first.status, 200);
  assert.equal((first.body as Booking).status, "cancelled");

  const second = await cancelBooking(id);
  assert.equal(second.status, 200);
  assert.equal((second.body as Booking).status, "cancelled");
});

test("отмена: после отмены время снова свободно", async () => {
  const created = await createBooking(request("2030-11-21T17:00:00+05:00"));
  await cancelBooking((created.body as Booking).id);

  const again = await createBooking(request("2030-11-21T17:00:00+05:00"));
  assert.equal(again.status, 201);
});

test("отмена: меньше чем за 2 часа — 409 too_late", async () => {
  const created = await createBooking(request("2030-11-22T13:00:00+05:00"));
  const id = (created.body as Booking).id;

  // now = 11:30 Almaty, booking at 13:00 — only 1.5 hours left
  process.env.NOW = "2030-11-22T06:30:00Z";
  const res = await cancelBooking(id);
  assert.equal(res.status, 409);
  assert.deepEqual(res.body, { error: "too_late" });
});

test("отмена: нет такой записи — 404", async () => {
  const res = await cancelBooking("bk-999");
  assert.equal(res.status, 404);
});

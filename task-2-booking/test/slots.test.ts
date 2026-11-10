import { test } from "node:test";
import assert from "node:assert/strict";
import { getSlots } from "../src/slots.ts";
import { overlaps, toMinutes } from "../src/time.ts";
import type { Booking, Master, Service } from "../src/types.ts";

const day = { from: "10:00", to: "13:00", breaks: [] };

const master: Master = {
  id: "m-1",
  name: "Тест",
  schedule: {
    mon: day,
    tue: day,
    wed: day,
    thu: day,
    fri: day,
    sat: null,
    sun: null,
  },
};

const cut: Service = {
  id: "s-cut",
  name: "Стрижка",
  durationMin: 60,
  masterIds: ["m-1"],
};

const range = (from: string, to: string) => ({
  start: toMinutes(from),
  end: toMinutes(to),
});

test("overlaps: пересекающиеся интервалы", () => {
  assert.equal(
    overlaps(range("10:00", "11:00"), range("10:30", "11:30")),
    true,
  );
});

test("overlaps: запись сразу после другой не пересекается", () => {
  assert.equal(
    overlaps(range("10:00", "11:00"), range("11:00", "12:00")),
    false,
  );
});

test("getSlots: свободный день", () => {
  // 2030-11-18 — понедельник
  const slots = getSlots(master, cut, "2030-11-18", []);
  assert.deepEqual(slots, [
    "10:00",
    "10:15",
    "10:30",
    "10:45",
    "11:00",
    "11:15",
    "11:30",
    "11:45",
    "12:00",
  ]);
});

test("getSlots: выходной", () => {
  assert.deepEqual(getSlots(master, cut, "2030-11-23", []), []);
});

// Time before all test dates, so every slot is in the future
const EARLY = new Date("2030-01-01T00:00:00Z");

test("getSlots: слот не пересекает перерыв", () => {
  const dayWithBreak = {
    from: "10:00",
    to: "13:00",
    breaks: [{ from: "11:00", to: "12:00" }],
  };
  const masterWithBreak: Master = {
    ...master,
    schedule: { ...master.schedule, mon: dayWithBreak },
  };
  const slots = getSlots(masterWithBreak, cut, "2030-11-18", [], EARLY);
  // 10:00-11:00 ends exactly at the break, 12:00-13:00 starts exactly after it
  assert.deepEqual(slots, ["10:00", "12:00"]);
});

test("getSlots: занятое время не выдаётся, отменённые записи не мешают", () => {
  const active: Booking = {
    id: "bk-a",
    masterId: "m-1",
    serviceId: "s-cut",
    start: "2030-11-18T05:00:00.000Z", // 10:00 Almaty
    end: "2030-11-18T06:00:00.000Z", // 11:00 Almaty
    clientPhone: "+77012345678",
    status: "active",
  };
  const cancelled: Booking = {
    ...active,
    id: "bk-c",
    start: "2030-11-18T07:00:00.000Z", // 12:00 Almaty
    end: "2030-11-18T08:00:00.000Z", // 13:00 Almaty
    status: "cancelled",
  };
  const slots = getSlots(master, cut, "2030-11-18", [active, cancelled], EARLY);
  assert.deepEqual(slots, ["11:00", "11:15", "11:30", "11:45", "12:00"]);
});

test("getSlots: прошедшее время не выдаётся", () => {
  // now = 11:10 Almaty
  const currentTime = new Date("2030-11-18T06:10:00.000Z");
  const slots = getSlots(master, cut, "2030-11-18", [], currentTime);
  assert.deepEqual(slots, ["11:15", "11:30", "11:45", "12:00"]);
});

test("getSlots: запись другого дня не мешает", () => {
  const otherDay: Booking = {
    id: "bk-o",
    masterId: "m-1",
    serviceId: "s-cut",
    start: "2030-11-19T05:00:00.000Z",
    end: "2030-11-19T06:00:00.000Z",
    clientPhone: "+77012345678",
    status: "active",
  };
  const slots = getSlots(master, cut, "2030-11-18", [otherDay], EARLY);
  assert.equal(slots.length, 9);
});

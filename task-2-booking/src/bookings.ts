import { randomUUID } from "node:crypto";
import type { Booking } from "./types.ts";
import { bookingRepo, masters, services } from "./store.ts";
import { getSlots } from "./slots.ts";
import { dateToAlmaty } from "./time.ts";
import { normalizePhone } from "./phone.ts";
import { now } from "./clock.ts";

// Every function returns HTTP status and response body
export type Result = { status: number; body: unknown };

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Lock per master.
//
// Problem: the store is slow (has latency). If two clients book the same time
// at the same moment, both can read "slot is free" before anyone saves.
// Then we get two bookings for one time.
//
// Solution: requests for the same master wait in a queue, one after another.
// The next request starts only when the previous one is finished.
// ---------------------------------------------------------------------------
const masterQueues = new Map<string, Promise<unknown>>();

async function runForMaster<T>(
  masterId: string,
  work: () => Promise<T>,
): Promise<T> {
  // wait for the previous request of this master (or nothing)
  const previous = masterQueues.get(masterId) ?? Promise.resolve();

  // our work starts after the previous one, even if the previous one failed
  const current = previous.then(work, work);

  // the next request will wait for us
  masterQueues.set(
    masterId,
    current.catch(() => {}),
  );

  return current;
}

// Is this character a digit 0-9?
function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

// Does the ISO string end with a time zone?
// '...Z'      -> true
// '...+05:00' -> true
// '...-03:00' -> true
// no zone     -> false
function hasTimeZone(text: string): boolean {
  // UTC
  if (text.endsWith("Z")) {
    return true;
  }

  // last 6 characters must look like '+05:00'
  const zone = text.slice(-6);
  if (zone.length !== 6) {
    return false;
  }

  const sign = zone[0];
  if (sign !== "+" && sign !== "-") {
    return false;
  }

  if (!isDigit(zone[1]) || !isDigit(zone[2])) {
    return false;
  }
  if (zone[3] !== ":") {
    return false;
  }
  if (!isDigit(zone[4]) || !isDigit(zone[5])) {
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// POST /bookings
// ---------------------------------------------------------------------------
export async function createBooking(input: unknown): Promise<Result> {
  // 1. Check the body
  if (typeof input !== "object" || input === null) {
    return { status: 400, body: { error: "invalid_body" } };
  }
  const data = input as Record<string, unknown>;

  if (typeof data.masterId !== "string" || typeof data.serviceId !== "string") {
    return { status: 400, body: { error: "invalid_body" } };
  }
  if (typeof data.start !== "string" || typeof data.clientPhone !== "string") {
    return { status: 400, body: { error: "invalid_body" } };
  }

  const masterId = data.masterId;
  const serviceId = data.serviceId;
  const startText = data.start;

  // 2. Check the phone
  const phone = normalizePhone(data.clientPhone);
  if (phone === null) {
    return { status: 400, body: { error: "invalid_phone" } };
  }

  // 3. Check the start time: ISO string WITH time zone (Z or +05:00)
  if (!hasTimeZone(startText)) {
    return { status: 400, body: { error: "invalid_start" } };
  }
  const start = new Date(startText);
  if (isNaN(start.getTime())) {
    return { status: 400, body: { error: "invalid_start" } };
  }

  // 4. Find master and service
  const master = masters.find((m) => m.id === masterId);
  if (!master) {
    return { status: 404, body: { error: "master_not_found" } };
  }
  const service = services.find((s) => s.id === serviceId);
  if (!service) {
    return { status: 404, body: { error: "service_not_found" } };
  }
  if (!service.masterIds.includes(master.id)) {
    return { status: 400, body: { error: "master_does_not_provide_service" } };
  }

  // 5. Convert start to Almaty date and 'HH:mm', e.g. '2030-11-18' and '15:00'
  const almaty = dateToAlmaty(start);

  // Start must be exactly on a minute (no seconds), otherwise it is not a slot
  if (start.getTime() % 60000 !== 0) {
    return { status: 409, body: { error: "slot_unavailable" } };
  }

  // 6. Check the slot and save. This part runs one at a time for each master.
  return runForMaster(master.id, async () => {
    const bookings = await bookingRepo.listByMaster(master.id);
    const freeSlots = getSlots(master, service, almaty.date, bookings, now());

    if (!freeSlots.includes(almaty.time)) {
      return { status: 409, body: { error: "slot_unavailable" } };
    }

    const end = new Date(start.getTime() + service.durationMin * 60000);

    const booking: Booking = {
      id: "bk-" + randomUUID(),
      masterId: master.id,
      serviceId: service.id,
      start: start.toISOString(),
      end: end.toISOString(),
      clientPhone: phone,
      status: "active",
    };

    await bookingRepo.insert(booking);
    return { status: 201, body: booking };
  });
}

// ---------------------------------------------------------------------------
// DELETE /bookings/:id
// ---------------------------------------------------------------------------
export async function cancelBooking(id: string): Promise<Result> {
  const booking = await bookingRepo.get(id);
  if (booking === null) {
    return { status: 404, body: { error: "booking_not_found" } };
  }

  // Already cancelled — just return it, no error
  if (booking.status === "cancelled") {
    return { status: 200, body: booking };
  }

  // Less than 2 hours before start — too late
  const startMs = new Date(booking.start).getTime();
  const nowMs = now().getTime();
  if (startMs - nowMs < TWO_HOURS_MS) {
    return { status: 409, body: { error: "too_late" } };
  }

  await bookingRepo.update(id, { status: "cancelled" });
  booking.status = "cancelled";
  return { status: 200, body: booking };
}

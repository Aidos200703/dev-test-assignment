import type { Booking, Master, Service } from "./types.ts";
import {
  almatyToDate,
  fromMinutes,
  overlaps,
  toMinutes,
  weekday,
  type Range,
} from "./time.ts";
import { now } from "./clock.ts";

export const SLOT_STEP_MIN = 15;

// Free master slots for the date 'HH:mm' in Almaty
export function getSlots(
  master: Master,
  service: Service,
  date: string,
  bookings: Booking[],
  currentTime: Date = now(),
): string[] {
  // 1. Get the work day. null means day off.
  const day = master.schedule[weekday(date)];
  if (!day) {
    return [];
  }

  // 2. Convert breaks to minutes from the start of the day
  const breaks: Range[] = [];
  for (const br of day.breaks) {
    breaks.push({ start: toMinutes(br.from), end: toMinutes(br.to) });
  }

  // 3. Convert active bookings of this master to minutes from the start of this day.
  //    Bookings from other days get numbers < 0 or > 1440, so they never overlap.
  const dayStartMs = almatyToDate(date, "00:00").getTime();
  const busy: Range[] = [];
  for (const booking of bookings) {
    if (booking.masterId !== master.id) {
      continue;
    }
    if (booking.status !== "active") {
      continue; // cancelled bookings do not block the time
    }
    const startMin = (new Date(booking.start).getTime() - dayStartMs) / 60000;
    const endMin = (new Date(booking.end).getTime() - dayStartMs) / 60000;
    busy.push({ start: startMin, end: endMin });
  }

  // 4. Go through the day with a 15 minute step and check every slot
  const result: string[] = [];
  const dayStart = toMinutes(day.from);
  const dayEnd = toMinutes(day.to);

  for (
    let t = dayStart;
    t + service.durationMin <= dayEnd;
    t += SLOT_STEP_MIN
  ) {
    const slot: Range = { start: t, end: t + service.durationMin };

    // 4a. Slot must not overlap a break
    let hitsBreak = false;
    for (const br of breaks) {
      if (overlaps(slot, br)) {
        hitsBreak = true;
        break;
      }
    }
    if (hitsBreak) {
      continue;
    }

    // 4b. Slot must not overlap an active booking
    let hitsBooking = false;
    for (const b of busy) {
      if (overlaps(slot, b)) {
        hitsBooking = true;
        break;
      }
    }
    if (hitsBooking) {
      continue;
    }

    // 4c. Slot must start after the current moment
    const slotStart = almatyToDate(date, fromMinutes(t));
    if (slotStart.getTime() <= currentTime.getTime()) {
      continue;
    }

    result.push(fromMinutes(t));
  }

  return result;
}

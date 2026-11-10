import type { Weekday } from "./types.ts";

// Казахстан живёт в одном часовом поясе
export const TZ_OFFSET = "+05:00";

const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Almaty is UTC + 5 hours
const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// date: 'YYYY-MM-DD'
export function weekday(date: string): Weekday {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export type Range = { start: number; end: number };

// BUG FIX: was "<=". If one range ends exactly when the other starts,
// they do NOT overlap (10:00-11:00 and 11:00-12:00 are fine together).
export function overlaps(a: Range, b: Range): boolean {
  return a.start < b.end && b.start < a.end;
}

// Check that the text is a real date in format 'YYYY-MM-DD'
export function isValidDate(value: string): boolean {
  if (value.length !== 10) {
    return false;
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return false;
  }

  const dateText = date.toISOString().slice(0, 10);
  if (dateText !== value) {
    return false;
  }

  return true;
}

// Almaty date + 'HH:mm' -> Date object
// Example: ('2030-11-18', '10:00') -> 2030-11-18T05:00:00.000Z
export function almatyToDate(date: string, hhmm: string): Date {
  return new Date(`${date}T${hhmm}:00${TZ_OFFSET}`);
}

// Date object -> Almaty date and time
// Example: 2030-11-18T05:00:00.000Z -> { date: '2030-11-18', time: '10:00' }
export function dateToAlmaty(value: Date): { date: string; time: string } {
  const almaty = new Date(value.getTime() + FIVE_HOURS_MS);
  const iso = almaty.toISOString(); // '2030-11-18T10:00:00.000Z'
  return {
    date: iso.slice(0, 10),
    time: iso.slice(11, 16),
  };
}

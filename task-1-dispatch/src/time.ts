const FIVE_HOURS = 5 * 60 * 60 * 1000;

export function getAlmatyDate(createdAt: string): string {
  const utcTime = new Date(createdAt).getTime();
  const almatyTime = utcTime + FIVE_HOURS;
  const almatyDate = new Date(almatyTime);
  const dateText = almatyDate.toISOString().slice(0, 10);
  return dateText;
}

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

// Mobile operator codes in Kazakhstan
const MOBILE_CODES = [
  "700",
  "701",
  "702",
  "705",
  "706",
  "707",
  "708",
  "747",
  "771",
  "775",
  "776",
  "777",
  "778",
];

// Kazakhstan mobile phone -> '+77012345678'.
// Returns null if the phone is not valid.
//
// Accepted examples:
//   '+7 701 234 56 78'
//   '87012345678'
//   '8 (701) 234-56-78'
export function normalizePhone(input: string): string | null {
  // 1. Remove spaces, brackets and dashes
  let phone = "";
  for (const char of input) {
    if (char === " " || char === "(" || char === ")" || char === "-") {
      continue;
    }
    phone += char;
  }

  // 2. Cut the country prefix: '+7', '8' or '7'
  let rest = "";
  if (phone.startsWith("+7") && phone.length === 12) {
    rest = phone.slice(2);
  } else if (phone.startsWith("8") && phone.length === 11) {
    rest = phone.slice(1);
  } else if (phone.startsWith("7") && phone.length === 11) {
    rest = phone.slice(1);
  } else {
    return null;
  }

  // 3. Every character must be a digit 0-9
  for (const char of rest) {
    if (char < "0" || char > "9") {
      return null;
    }
  }

  // 4. First 3 digits must be a mobile operator code (727 is Almaty city phone, not mobile)
  const code = rest.slice(0, 3);
  if (!MOBILE_CODES.includes(code)) {
    return null;
  }

  return "+7" + rest;
}

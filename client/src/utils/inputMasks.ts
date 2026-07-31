/** Live input masks for form fields that only ever hold digits. */

/**
 * Strips everything but digits and inserts CNIC separators as the user types, capping at
 * 13 digits total — e.g. "35202-1234567-1".
 */
export function maskCnic(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 13);
  const part1 = digits.slice(0, 5);
  const part2 = digits.slice(5, 12);
  const part3 = digits.slice(12, 13);
  return [part1, part2, part3].filter(Boolean).join("-");
}

/** Strips everything but digits, capping at 11 — the local mobile number length. */
export function maskPhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 11);
}

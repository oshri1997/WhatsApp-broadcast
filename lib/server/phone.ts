// Normalizes a raw phone number (as read from Excel) into a WhatsApp-compatible
// international-format string with no symbols, e.g. "972501234567".
// Assumes Israeli numbers by default when no country code is present.
export function normalizePhone(raw: unknown): string | null {
  let digits = String(raw ?? '').replace(/\D/g, '');

  if (!digits) return null;

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('972')) {
    return digits;
  }

  if (digits.startsWith('0')) {
    return '972' + digits.slice(1);
  }

  // Local Israeli number without the leading 0 (e.g. "501234567")
  if (digits.length === 9) {
    return '972' + digits;
  }

  // Already looks like it includes some other country code
  return digits;
}

export function isPlausiblePhone(normalized: string | null): boolean {
  return !!normalized && normalized.length >= 11 && normalized.length <= 15;
}

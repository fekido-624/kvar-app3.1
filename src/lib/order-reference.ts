export function normalizeOrderReference(value: string): string {
  const trimmed = value.trim();
  // Ignore leading zeros only for wholly numeric references: 07 = 7, not KV-07 = KV-7.
  return /^\d+$/.test(trimmed) ? trimmed.replace(/^0+(?=\d)/, '') : trimmed.toLowerCase();
}

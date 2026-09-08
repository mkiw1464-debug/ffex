import crypto from "crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function generateLicenseKey() {
  let s = "";
  const bytes = crypto.randomBytes(15);
  for (let i = 0; i < 15; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return `FFEX-${s}`;
}

export function normalizeKey(k) {
  return String(k || "").trim().toUpperCase();
}

export function expiryForDays(days) {
  if (days === null || days === undefined || days === "") return null;
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(Date.now() + n * 86400000).toISOString();
}

export function isExpired(row) {
  return !!row.expires_at && new Date(row.expires_at).getTime() <= Date.now();
}

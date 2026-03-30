"use client";

const PROFILE_NAME_PREFIX = "siren-profile-name";
const MAX_PROFILE_NAME_LENGTH = 18;

function normalizeIdentity(identity?: string | null): string {
  return identity?.trim() || "guest";
}

export function sanitizeProfileName(value: string): string {
  return value
    .trim()
    .replace(/^@+/, "")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, MAX_PROFILE_NAME_LENGTH);
}

export function formatProfileName(value?: string | null): string {
  const normalized = sanitizeProfileName(value ?? "");
  return normalized ? `@${normalized}` : "@siren";
}

export function readProfileName(identity?: string | null): string {
  if (typeof window === "undefined") return "";
  try {
    const stored = window.localStorage.getItem(`${PROFILE_NAME_PREFIX}:${normalizeIdentity(identity)}`) ?? "";
    return sanitizeProfileName(stored);
  } catch {
    return "";
  }
}

export function writeProfileName(identity: string | null | undefined, value: string): string {
  const next = sanitizeProfileName(value);
  if (typeof window === "undefined") return next;
  const key = `${PROFILE_NAME_PREFIX}:${normalizeIdentity(identity)}`;
  try {
    if (next) {
      window.localStorage.setItem(key, next);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore local storage failures
  }
  return next;
}

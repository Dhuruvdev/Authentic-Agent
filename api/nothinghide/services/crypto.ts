import crypto from "crypto";

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input.toLowerCase().trim()).digest("hex");
}

export function sha1(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex").toUpperCase();
}

export function normalizeEmail(email: string): string {
  const trimmed = email.toLowerCase().trim();
  const [localPart, domain] = trimmed.split("@");
  if (!domain) return trimmed;
  
  let normalizedLocal = localPart;
  if (domain === "gmail.com" || domain === "googlemail.com") {
    normalizedLocal = localPart.replace(/\./g, "").split("+")[0];
  } else {
    normalizedLocal = localPart.split("+")[0];
  }
  
  return `${normalizedLocal}@${domain}`;
}

export function hashEmail(email: string): string {
  const normalized = normalizeEmail(email);
  return sha256(normalized);
}

export function getPasswordHashPrefix(passwordOrHash: string): { prefix: string; suffix: string } {
  let hash: string;
  
  if (/^[A-Fa-f0-9]{40}$/.test(passwordOrHash)) {
    hash = passwordOrHash.toUpperCase();
  } else {
    hash = sha1(passwordOrHash);
  }
  
  return {
    prefix: hash.substring(0, 5),
    suffix: hash.substring(5),
  };
}

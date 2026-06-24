import crypto from "crypto";

export function hashPassword(password: string): string {
  // Use a simple, robust SHA-256 hash for local validation.
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

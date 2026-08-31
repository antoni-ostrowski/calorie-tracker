import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { env } from "~/env";

// Derive 32-byte key from BETTER_AUTH_SECRET.
// Using SHA-256 hash of secret - stable, deterministic, gives 32 bytes for AES-256.
// Alternatively HKDF could be used, but sha256 is sufficient for server-side at-rest encryption.
function getEncryptionKey(): Buffer {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("BETTER_AUTH_SECRET must be set and at least 16 chars for encryption");
  }
  return createHash("sha256").update(secret).digest();
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt plaintext token with AES-256-GCM.
 * Returns string format: iv:authTag:ciphertext all base64 encoded.
 * This can be stored safely in DB; DB dump alone without BETTER_AUTH_SECRET is useless.
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) return "";
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Ensure tag length 16
  if (authTag.length !== AUTH_TAG_LENGTH) {
    // should always be 16 for GCM
  }
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

/**
 * Decrypt token encrypted with encryptToken.
 * Throws if decryption fails (wrong key, corrupted data, tampered).
 */
export function decryptToken(encryptedValue: string): string {
  if (!encryptedValue) return "";
  const parts = encryptedValue.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const encrypted = Buffer.from(dataB64, "base64");

  if (iv.length !== IV_LENGTH) {
    throw new Error("Invalid IV length");
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid auth tag length");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Mask token for display: show last 4 chars, rest asterisks.
 * e.g., sk-abc...xyz -> ****xyz
 */
export function maskToken(token: string): string {
  if (!token) return "";
  if (token.length <= 8) return "****";
  const visible = token.slice(-4);
  return `****${visible}`;
}

/**
 * Helper to check if stored value looks encrypted (contains : and base64 parts).
 * Plaintext tokens historically not stored, but env fallback may provide plaintext.
 */
export function isEncryptedValue(value: string): boolean {
  if (!value) return false;
  const parts = value.split(":");
  if (parts.length !== 3) return false;
  try {
    const iv = Buffer.from(parts[0], "base64");
    const tag = Buffer.from(parts[1], "base64");
    const data = Buffer.from(parts[2], "base64");
    return iv.length === IV_LENGTH && tag.length === AUTH_TAG_LENGTH && data.length > 0;
  } catch {
    return false;
  }
}

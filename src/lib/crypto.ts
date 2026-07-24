import crypto from "crypto";

// Server-side symmetric encryption for API keys / secrets stored in the
// database (spec §6: "Enkripsi Simetris Sisi Server"). Uses AES-256-GCM —
// a random IV per value plus an auth tag, so ciphertext is unique and
// tamper-evident even for identical plaintext keys.
//
// Set API_KEY_SECRET in your environment (any long random string). If it's
// missing we fall back to a build-time constant ONLY so local dev/build
// doesn't crash — never rely on that fallback in production.
const RAW_SECRET = process.env.API_KEY_SECRET || "zales-dev-only-insecure-fallback-secret";
const KEY = crypto.createHash("sha256").update(RAW_SECRET).digest(); // 32 bytes
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

/** Encrypts a plaintext string. Returns `iv:authTag:ciphertext`, all hex. */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/** Decrypts a value produced by encryptSecret. Returns "" if malformed. */
export function decryptSecret(payload: string): string {
  try {
    const [ivHex, tagHex, dataHex] = payload.split(":");
    if (!ivHex || !tagHex || !dataHex) return "";
    const decipher = crypto.createDecipheriv(ALGO, KEY, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}

/** True if a string looks like our `iv:tag:data` encrypted format. */
export function isEncryptedPayload(value: string): boolean {
  return /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i.test(value);
}

/** Masks a secret for display, e.g. "sk-abc123xyz" -> "sk-a...9xyz". */
export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

/** Sentinel the client sends back when a masked field was left untouched. */
export const UNCHANGED_SENTINEL = "__UNCHANGED__";

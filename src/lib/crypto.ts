import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

// ---------------------------------------------------------------------------
// Key derivation
// ---------------------------------------------------------------------------

/**
 * Derive the encryption key from environment variables.
 *
 * Priority:
 * 1. ENCRYPTION_SECRET_KEY — raw 32-byte key as base64url string
 * 2. ENCRYPTION_KEY — legacy passphrase, derived via scrypt
 * 3. Dev default — fixed key for local development only
 */
function getEncryptionKey(): Buffer {
  // 1. Preferred: raw 32-byte key encoded as base64url
  const secretKey = process.env.ENCRYPTION_SECRET_KEY;
  if (secretKey) {
    const key = Buffer.from(secretKey, "base64url");
    if (key.length === KEY_LENGTH) {
      return key;
    }
    console.warn(
      `[crypto] ENCRYPTION_SECRET_KEY is ${key.length} bytes, expected ${KEY_LENGTH} — falling back`
    );
  }

  // 2. Legacy: derive from passphrase via scrypt
  const passphrase = process.env.ENCRYPTION_KEY;
  if (passphrase) {
    return scryptSync(passphrase, "cargoiq-salt-v1", KEY_LENGTH);
  }

  // 3. Dev default
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[crypto] ⚠ No ENCRYPTION_SECRET_KEY or ENCRYPTION_KEY configured in production — using insecure default"
    );
  } else {
    console.warn(
      "[crypto] No encryption key configured — using dev default (do not use in production)"
    );
  }

  return scryptSync("cargoiq-dev-default-key", "cargoiq-salt-v1", KEY_LENGTH);
}

// Lazy-initialised singleton key
let _key: Buffer | null = null;

function key(): Buffer {
  if (!_key) {
    _key = getEncryptionKey();
  }
  return _key;
}

// ---------------------------------------------------------------------------
// Encrypt
// ---------------------------------------------------------------------------

/**
 * Encrypt plaintext using AES-256-GCM.
 *
 * Returns a base64-encoded string containing: IV (16 bytes) + AuthTag (16 bytes) + Ciphertext.
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key(), iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Layout: [IV 16 bytes][AuthTag 16 bytes][Ciphertext N bytes]
  const payload = Buffer.concat([iv, authTag, encrypted]);

  return payload.toString("base64");
}

// ---------------------------------------------------------------------------
// Decrypt
// ---------------------------------------------------------------------------

/**
 * Decrypt a value produced by `encrypt()`.
 *
 * @throws Error if the value cannot be decrypted (wrong key, tampered data, etc.)
 */
export function decrypt(encrypted: string): string {
  const payload = Buffer.from(encrypted, "base64");

  if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted payload: too short");
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key(), iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

// ---------------------------------------------------------------------------
// Safe decrypt
// ---------------------------------------------------------------------------

/**
 * Decrypt a value, returning `null` instead of throwing on failure.
 */
export function safeDecrypt(encrypted: string): string | null {
  try {
    return decrypt(encrypted);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Check if encrypted
// ---------------------------------------------------------------------------

/**
 * Heuristic check whether a string looks like a payload produced by `encrypt()`.
 *
 * Valid payloads are base64 strings that decode to at least IV_LENGTH + AUTH_TAG_LENGTH bytes.
 */
export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== "string") return false;

  // Must be valid base64
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  if (!base64Regex.test(value)) return false;

  try {
    const decoded = Buffer.from(value, "base64");
    return decoded.length >= IV_LENGTH + AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Re-export constants for external use
// ---------------------------------------------------------------------------

export { ALGORITHM, KEY_LENGTH, IV_LENGTH, AUTH_TAG_LENGTH };

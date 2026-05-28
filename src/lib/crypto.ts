// CargoIQ — AES-256-GCM Cryptographic Security Service
// Uses dynamic import of Node.js crypto to avoid turbopack compilation issues

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

async function getNodeCrypto() {
  return await import("crypto");
}

async function getEncryptionKey(): Promise<Buffer> {
  const crypto = await getNodeCrypto();
  
  const secretKey = process.env.ENCRYPTION_SECRET_KEY;
  if (secretKey) {
    const decoded = Buffer.from(secretKey, "base64url");
    if (decoded.length === KEY_LENGTH) return decoded;
    return crypto.scryptSync(secretKey, "cargoiq-salt-v2", KEY_LENGTH);
  }

  const legacyKey = process.env.ENCRYPTION_KEY;
  if (legacyKey) {
    return crypto.scryptSync(legacyKey, "cargoiq-salt", KEY_LENGTH);
  }

  if (process.env.NODE_ENV === "production") {
    console.error("[crypto] CRITICAL: No encryption key configured in production!");
  }
  return crypto.scryptSync("cargoiq-default-encryption-key-change-in-production", "cargoiq-salt", KEY_LENGTH);
}

let _keyCache: Buffer | null = null;

async function getKey(): Promise<Buffer> {
  if (_keyCache) return _keyCache;
  _keyCache = await getEncryptionKey();
  return _keyCache;
}

export async function encrypt(plaintext: string): Promise<string> {
  const crypto = await getNodeCrypto();
  const key = await getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, "utf8", "base64");
  ciphertext += cipher.final("base64");

  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, Buffer.from(ciphertext, "base64")]);
  return combined.toString("base64");
}

export async function decrypt(encrypted: string): Promise<string> {
  const crypto = await getNodeCrypto();
  const key = await getKey();
  const combined = Buffer.from(encrypted, "base64");

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(ciphertext, undefined, "utf8");
  plaintext += decipher.final("utf8");
  return plaintext;
}

export async function safeDecrypt(encrypted: string): Promise<string | null> {
  try {
    return await decrypt(encrypted);
  } catch (error) {
    console.warn("[crypto] Decryption failed:", error instanceof Error ? error.message : "unknown");
    return null;
  }
}

export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const decoded = Buffer.from(value, "base64");
    return decoded.length >= 33;
  } catch {
    return false;
  }
}

export const cryptoService = { encrypt, decrypt, safeDecrypt, isEncrypted };

// CargoIQ — AES-256 Encryption Service
// Used for encrypting sensitive credentials (e.g. CargoWise credentials) at rest

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || "cargoiq-default-encryption-key-change-in-production";
  return scryptSync(secret, "cargoiq-salt", KEY_LENGTH);
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a base64-encoded string containing iv + authTag + ciphertext.
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, "utf8", "base64");
  ciphertext += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  // Concatenate iv + authTag + ciphertext and base64-encode
  const combined = Buffer.concat([iv, authTag, Buffer.from(ciphertext, "base64")]);
  return combined.toString("base64");
}

/**
 * Decrypt a base64-encoded string that was encrypted with the encrypt() function.
 */
export function decrypt(encrypted: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encrypted, "base64");

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(ciphertext, undefined, "utf8");
  plaintext += decipher.final("utf8");

  return plaintext;
}

/**
 * Crypto service object for consistent import pattern
 */
export const cryptoService = {
  encrypt,
  decrypt,
};

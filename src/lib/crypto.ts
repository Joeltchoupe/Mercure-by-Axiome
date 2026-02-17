// src/lib/crypto.ts

import crypto from 'crypto';
import { env } from '@/lib/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const ENCODING = 'hex';

// ─── Encryption ───

export function encrypt(text: string): string {
  const key = Buffer.from(env.ENCRYPTION_KEY, ENCODING);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', ENCODING);
  encrypted += cipher.final(ENCODING);

  const tag = cipher.getAuthTag();

  // Format: iv:tag:encrypted
  return `${iv.toString(ENCODING)}:${tag.toString(ENCODING)}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const key = Buffer.from(env.ENCRYPTION_KEY, ENCODING);
  const parts = encryptedText.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }

  const [ivHex, tagHex, encrypted] = parts;

  const iv = Buffer.from(ivHex, ENCODING);
  const tag = Buffer.from(tagHex, ENCODING);

  if (iv.length !== IV_LENGTH) {
    throw new Error('Invalid IV length');
  }

  if (tag.length !== TAG_LENGTH) {
    throw new Error('Invalid auth tag length');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, ENCODING, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ─── Hashing ───

export function hash(text: string, algorithm: string = 'sha256'): string {
  return crypto.createHash(algorithm).update(text).digest(ENCODING);
}

export function hmac(
  text: string,
  secret: string,
  algorithm: string = 'sha256'
): string {
  return crypto
    .createHmac(algorithm, secret)
    .update(text)
    .digest(ENCODING);
}

export function hmacBase64(
  text: string,
  secret: string,
  algorithm: string = 'sha256'
): string {
  return crypto
    .createHmac(algorithm, secret)
    .update(text, 'utf8')
    .digest('base64');
}

// ─── Timing-safe comparison ───

export function timingSafeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);

    if (bufA.length !== bufB.length) return false;

    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

// ─── Random generation ───

export function generateNonce(bytes: number = 16): string {
  return crypto.randomBytes(bytes).toString(ENCODING);
}

export function generateToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function generateId(prefix?: string): string {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}

export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString(ENCODING);
}

export function generateApiKey(): string {
  const prefix = 'axio';
  const key = crypto.randomBytes(24).toString('base64url');
  return `${prefix}_${key}`;
}

// ─── Deterministic ID from content ───

export function contentHash(
  ...parts: string[]
): string {
  return crypto
    .createHash('sha256')
    .update(parts.join(':'))
    .digest(ENCODING)
    .substring(0, 32);
    }

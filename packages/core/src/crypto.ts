import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/** Raised when a secret cannot be stored or read: no/invalid `ENCRYPTION_KEY`, or tampered ciphertext. */
export class CryptoError extends Error {
  constructor(readonly reason: 'NO_KEY' | 'BAD_KEY' | 'BAD_DATA') {
    super(reason)
  }
}

const PREFIX = 'v1'

function keyFrom(raw: string | undefined): Buffer {
  if (!raw) throw new CryptoError('NO_KEY')
  const key = Buffer.from(raw.trim(), 'base64')
  if (key.length !== 32) throw new CryptoError('BAD_KEY')
  return key
}

/** AES-256-GCM. Output `v1.<iv>.<tag>.<ciphertext>` (base64url). `ENCRYPTION_KEY` = 32 random bytes, base64. */
export function encryptSecret(plain: string, rawKey = process.env.ENCRYPTION_KEY): string {
  const key = keyFrom(rawKey)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [PREFIX, iv, cipher.getAuthTag(), ct]
    .map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
    .join('.')
}

export function decryptSecret(payload: string, rawKey = process.env.ENCRYPTION_KEY): string {
  const key = keyFrom(rawKey)
  const [version, iv, tag, ct] = payload.split('.')
  if (version !== PREFIX || !iv || !tag || !ct) throw new CryptoError('BAD_DATA')
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([
      decipher.update(Buffer.from(ct, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    throw new CryptoError('BAD_DATA')
  }
}

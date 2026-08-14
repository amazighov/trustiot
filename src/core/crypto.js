import { createCipheriv, createHash, randomBytes } from 'node:crypto';

export function generateDataKey() {
  return randomBytes(32);
}

export function encryptBatch(plaintext, key) {
  if (!Buffer.isBuffer(plaintext)) throw new Error('plaintext must be a Buffer');
  if (!Buffer.isBuffer(key) || key.length !== 32) {
    throw new Error('AES-256-GCM key must be exactly 32 bytes');
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  const envelope = {
    version: 1,
    algorithm: 'AES-256-GCM',
    iv: iv.toString('base64'),
    authTag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64')
  };

  const serialized = Buffer.from(JSON.stringify(envelope), 'utf8');

  return {
    envelope: serialized,
    ciphertextSha256: createHash('sha256').update(serialized).digest('hex')
  };
}

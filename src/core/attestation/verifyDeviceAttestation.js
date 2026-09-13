import crypto from 'node:crypto';

import {
  canonicalDeviceReading
} from './canonicalDeviceReading.js';


export function verifyDeviceAttestation({
  reading,
  signature,
  publicKey
}) {
  if (!reading) {
    throw new Error(
      'reading is required'
    );
  }

  if (!signature) {
    throw new Error(
      'signature is required'
    );
  }

  if (!publicKey) {
    throw new Error(
      'publicKey is required'
    );
  }

  if (
    !Number.isInteger(
      reading.sequence
    ) ||
    reading.sequence < 0
  ) {
    throw new Error(
      `Invalid sequence: ${reading.sequence}`
    );
  }

  const canonical =
    canonicalDeviceReading(
      reading
    );

  let signatureBytes;

  try {
    signatureBytes =
      Buffer.from(
        signature,
        'base64'
      );
  } catch {
    throw new Error(
      'Invalid signature encoding'
    );
  }

  if (
    signatureBytes.length === 0
  ) {
    throw new Error(
      'Empty signature'
    );
  }

  try {
    return crypto.verify(
      'sha256',

      Buffer.from(
        canonical,
        'utf8'
      ),

      {
        key:
          publicKey,

        dsaEncoding:
          'der'
      },

      signatureBytes
    );
  } catch (error) {
    throw new Error(
      `Device signature verification failed: ${error.message}`
    );
  }
}

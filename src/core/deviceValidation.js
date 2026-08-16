import {
  getTrustedDevice
} from './deviceRegistry.js';

import {
  verifyDeviceReading
} from './deviceSigning.js';

export async function validateDeviceReading(
  signedReading
) {
  if (
    !signedReading ||
    typeof signedReading !== 'object'
  ) {
    throw new Error(
      'Invalid device reading'
    );
  }

  const {
    deviceId,
    sequence,
    timestamp,
    nonce,
    signature,
    signatureAlgorithm
  } = signedReading;

  if (!deviceId) {
    throw new Error(
      'deviceId is required'
    );
  }

  if (
    !Number.isInteger(sequence) ||
    sequence < 0
  ) {
    throw new Error(
      'Invalid device sequence'
    );
  }

  if (
    !timestamp ||
    Number.isNaN(
      Date.parse(timestamp)
    )
  ) {
    throw new Error(
      'Invalid device timestamp'
    );
  }

  if (!nonce) {
    throw new Error(
      'Device nonce is required'
    );
  }

  if (!signature) {
    throw new Error(
      'Device signature is required'
    );
  }

  const trustedDevice =
    await getTrustedDevice(
      deviceId
    );

  if (
    trustedDevice.algorithm !==
    signatureAlgorithm
  ) {
    throw new Error(
      `Signature algorithm mismatch for device ${deviceId}`
    );
  }

  const signatureValid =
    verifyDeviceReading(
      signedReading,
      trustedDevice.publicKeyPem
    );

  if (!signatureValid) {
    throw new Error(
      `Invalid device signature: ${deviceId}`
    );
  }

  return {
    valid: true,
    deviceId,
    sequence,
    timestamp,
    nonce
  };
}

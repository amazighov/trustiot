import {
  createPrivateKey,
  createPublicKey,
  sign,
  verify
} from 'node:crypto';

import {
  canonicalize
} from './signing.js';

export function signDeviceReading(
  reading,
  privateKeyPem
) {
  const canonical =
    canonicalize(reading);

  const privateKey =
    createPrivateKey(
      privateKeyPem
    );

  const signature =
    sign(
      null,
      Buffer.from(
        canonical,
        'utf8'
      ),
      privateKey
    );

  return {
    ...reading,
    signature:
      signature.toString(
        'base64'
      ),
    signatureAlgorithm:
      'Ed25519'
  };
}

export function verifyDeviceReading(
  signedReading,
  publicKeyPem
) {
  const {
    signature,
    signatureAlgorithm,
    ...reading
  } = signedReading;

  if (
    signatureAlgorithm !==
    'Ed25519'
  ) {
    return false;
  }

  if (!signature) {
    return false;
  }

  const canonical =
    canonicalize(reading);

  const publicKey =
    createPublicKey(
      publicKeyPem
    );

  return verify(
    null,
    Buffer.from(
      canonical,
      'utf8'
    ),
    publicKey,
    Buffer.from(
      signature,
      'base64'
    )
  );
}

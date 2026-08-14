import {
  generateKeyPairSync,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
  randomBytes
} from 'node:crypto';

export function generateSigningKeyPair() {
  const { privateKey, publicKey } =
    generateKeyPairSync('ed25519');

  return {
    privateKeyPem: privateKey.export({
      type: 'pkcs8',
      format: 'pem'
    }),

    publicKeyPem: publicKey.export({
      type: 'spki',
      format: 'pem'
    })
  };
}

export function canonicalize(value) {
  if (
    value === null ||
    typeof value !== 'object'
  ) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return (
      '[' +
      value
        .map((item) => canonicalize(item))
        .join(',') +
      ']'
    );
  }

  const keys =
    Object.keys(value).sort();

  return (
    '{' +
    keys
      .map(
        (key) =>
          `${JSON.stringify(key)}:` +
          canonicalize(value[key])
      )
      .join(',') +
    '}'
  );
}

export function createNonce() {
  return randomBytes(16)
    .toString('hex');
}

export function signManifest(
  manifest,
  {
    signerId,
    privateKeyPem,
    timestamp =
      new Date().toISOString(),
    nonce =
      createNonce()
  }
) {
  if (!signerId) {
    throw new Error(
      'signerId is required'
    );
  }

  if (!privateKeyPem) {
    throw new Error(
      'privateKeyPem is required'
    );
  }

  const signedPayload = {
    manifest,
    signerId,
    timestamp,
    nonce
  };

  const canonical =
    canonicalize(signedPayload);

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
    ...signedPayload,
    signature:
      signature.toString(
        'base64'
      ),
    signatureAlgorithm:
      'Ed25519'
  };
}

export function verifySignedManifest(
  signedManifest,
  publicKeyPem
) {
  const {
    manifest,
    signerId,
    timestamp,
    nonce,
    signature,
    signatureAlgorithm
  } = signedManifest;

  if (
    signatureAlgorithm !==
    'Ed25519'
  ) {
    return false;
  }

  if (
    !manifest ||
    !signerId ||
    !timestamp ||
    !nonce ||
    !signature
  ) {
    return false;
  }

  const canonical =
    canonicalize({
      manifest,
      signerId,
      timestamp,
      nonce
    });

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

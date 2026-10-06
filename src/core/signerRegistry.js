import { readFile } from 'node:fs/promises';

const defaultTrustedSigners = {
  'gateway-farm-001': {
    publicKeyPath:
      'data/keys/gateway-public.pem',
    algorithm: 'Ed25519',
    status: 'ACTIVE'
  }
};

let trustedSigners = {
  ...defaultTrustedSigners
};

export async function getTrustedSigner(
  signerId
) {
  const signer =
    trustedSigners[signerId];

  if (!signer) {
    throw new Error(
      `Unknown signer: ${signerId}`
    );
  }

  if (signer.status !== 'ACTIVE') {
    throw new Error(
      `Signer is not active: ${signerId}`
    );
  }

  const publicKeyPem =
    await readFile(
      process.env.TRUSTIOT_GATEWAY_PUBLIC_KEY_PATH ||
        signer.publicKeyPath,
      'utf8'
    );

  return {
    signerId,
    algorithm: signer.algorithm,
    status: signer.status,
    publicKeyPem
  };
}

export function isTrustedSigner(
  signerId
) {
  const signer =
    trustedSigners[signerId];

  return Boolean(
    signer &&
    signer.status === 'ACTIVE'
  );
}

// Test/support helper.
// This changes registry state only in the current Node process.
export function setSignerStatus(
  signerId,
  status
) {
  const signer =
    trustedSigners[signerId];

  if (!signer) {
    throw new Error(
      `Unknown signer: ${signerId}`
    );
  }

  if (
    status !== 'ACTIVE' &&
    status !== 'REVOKED'
  ) {
    throw new Error(
      `Invalid signer status: ${status}`
    );
  }

  trustedSigners[signerId] = {
    ...signer,
    status
  };
}

export function resetSignerRegistry() {
  trustedSigners = {
    ...defaultTrustedSigners
  };
}

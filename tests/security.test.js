import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateSigningKeyPair,
  signManifest,
  verifySignedManifest
} from '../src/core/signing.js';

import {
  validateReplayProtection,
  clearReplayCache
} from '../src/core/replay.js';

import {
  getTrustedSigner,
  isTrustedSigner,
  setSignerStatus,
  resetSignerRegistry
} from '../src/core/signerRegistry.js';

test('accepts a valid Ed25519 signed manifest', () => {
  const {
    privateKeyPem,
    publicKeyPem
  } = generateSigningKeyPair();

  const manifest = {
    datasetId: 'security-test-valid',
    deviceId: 'farm-001/temp-01',
    ownerOrg: 'FarmOrg',
    cid: 'bafkrei-security-valid',
    ciphertextSha256:
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    readingCount: 25,
    schemaVersion: 'trustiot.batch.v1'
  };

  const signed = signManifest(
    manifest,
    {
      signerId: 'gateway-farm-001',
      privateKeyPem
    }
  );

  assert.equal(
    verifySignedManifest(
      signed,
      publicKeyPem
    ),
    true
  );
});

test('rejects a tampered signed manifest', () => {
  const {
    privateKeyPem,
    publicKeyPem
  } = generateSigningKeyPair();

  const manifest = {
    datasetId: 'security-test-tamper',
    deviceId: 'farm-001/temp-01',
    ownerOrg: 'FarmOrg',
    cid: 'bafkrei-security-tamper',
    ciphertextSha256:
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    readingCount: 25,
    schemaVersion: 'trustiot.batch.v1'
  };

  const signed = signManifest(
    manifest,
    {
      signerId: 'gateway-farm-001',
      privateKeyPem
    }
  );

  signed.manifest.readingCount = 999;

  assert.equal(
    verifySignedManifest(
      signed,
      publicKeyPem
    ),
    false
  );
});

test('rejects replayed nonce', () => {
  clearReplayCache();

  const {
    privateKeyPem
  } = generateSigningKeyPair();

  const signed = signManifest(
    {
      datasetId: 'security-test-replay',
      deviceId: 'farm-001/temp-01',
      ownerOrg: 'FarmOrg'
    },
    {
      signerId: 'gateway-farm-001',
      privateKeyPem
    }
  );

  const first =
    validateReplayProtection(
      signed
    );

  const second =
    validateReplayProtection(
      signed
    );

  assert.equal(
    first.valid,
    true
  );

  assert.equal(
    second.valid,
    false
  );

  assert.equal(
    second.reason,
    'nonce already used'
  );
});

test('rejects expired signed manifest', () => {
  clearReplayCache();

  const {
    privateKeyPem
  } = generateSigningKeyPair();

  const signed = signManifest(
    {
      datasetId: 'security-test-expired',
      deviceId: 'farm-001/temp-01',
      ownerOrg: 'FarmOrg'
    },
    {
      signerId: 'gateway-farm-001',
      privateKeyPem,
      timestamp: new Date(
        Date.now() - 10 * 60 * 1000
      ).toISOString()
    }
  );

  const result =
    validateReplayProtection(
      signed,
      {
        maxAgeMs: 5 * 60 * 1000
      }
    );

  assert.equal(
    result.valid,
    false
  );

  assert.equal(
    result.reason,
    'timestamp outside allowed window'
  );
});

test('trusted signer registry accepts active signer', async () => {
  assert.equal(
    isTrustedSigner(
      'gateway-farm-001'
    ),
    true
  );

  const signer =
    await getTrustedSigner(
      'gateway-farm-001'
    );

  assert.equal(
    signer.signerId,
    'gateway-farm-001'
  );

  assert.equal(
    signer.algorithm,
    'Ed25519'
  );

  assert.equal(
    signer.status,
    'ACTIVE'
  );

  assert.equal(
    Boolean(
      signer.publicKeyPem
    ),
    true
  );
});

test('trusted signer registry rejects unknown signer', async () => {
  assert.equal(
    isTrustedSigner(
      'unknown-gateway'
    ),
    false
  );

  await assert.rejects(
    () =>
      getTrustedSigner(
        'unknown-gateway'
      ),
    /Unknown signer: unknown-gateway/
  );
  test('trusted signer registry rejects revoked signer', async () => {
  resetSignerRegistry();

  try {
    assert.equal(
      isTrustedSigner('gateway-farm-001'),
      true
    );

    setSignerStatus(
      'gateway-farm-001',
      'REVOKED'
    );

    assert.equal(
      isTrustedSigner('gateway-farm-001'),
      false
    );

    await assert.rejects(
      () =>
        getTrustedSigner(
          'gateway-farm-001'
        ),
      /Signer is not active: gateway-farm-001/
    );
  } finally {
    // Always restore ACTIVE state,
    // even if the test fails.
    resetSignerRegistry();
  }

  assert.equal(
    isTrustedSigner('gateway-farm-001'),
    true
  );
});
});
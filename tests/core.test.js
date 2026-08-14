import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { generateReadings } from '../src/core/simulator.js';
import { createBatch } from '../src/core/batch.js';
import { generateDataKey, encryptBatch } from '../src/core/crypto.js';
import { buildPublicManifest } from '../src/core/manifest.js';

test('creates a canonical encrypted batch and public manifest', () => {
  const readings = generateReadings({ count: 5, start: 0 });
  const batch = createBatch(readings, 'FarmOrg');
  assert.equal(batch.readingCount, 5);
  assert.equal(batch.deviceId, 'farm-001/temp-01');

  const key = generateDataKey();
  const encrypted = encryptBatch(batch.body, key);
  assert.equal(
    encrypted.ciphertextSha256,
    createHash('sha256').update(encrypted.envelope).digest('hex')
  );

  const manifest = buildPublicManifest(
    batch,
    { driver: 'local', ref: 'x', cid: null },
    encrypted.ciphertextSha256
  );

  assert.equal(manifest.readingCount, 5);
  assert.equal(manifest.cid, null);
  assert.equal(manifest.verificationStatus, 'UNVERIFIED');
});

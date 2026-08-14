import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import {
  FabricLedgerAdapter
} from '../src/adapters/fabricLedger.js';

test(
  'Fabric persistently rejects reused signer nonce',
  async () => {
    const ledger =
      new FabricLedgerAdapter();

    const sharedNonce =
      `integration-replay-${randomUUID()}`;

    const baseManifest = {
      deviceId:
        'integration-test/device-01',

      ownerOrg:
        'FarmOrg',

      cid:
        'bafkrei-integration-replay-test',

      storageRef:
        'bafkrei-integration-replay-test',

      storageDriver:
        'filecoin-pin',

      ciphertextSha256:
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',

      startedAt:
        new Date().toISOString(),

      endedAt:
        new Date().toISOString(),

      readingCount: 1,

      encryption:
        'AES-256-GCM',

      schemaVersion:
        'trustiot.batch.v1',

      createdAt:
        new Date().toISOString(),

      verificationStatus:
        'UNVERIFIED',

      signerId:
        'gateway-farm-001',

      signedAt:
        new Date().toISOString(),

      nonce:
        sharedNonce,

      signature:
        'integration-test-signature',

      signatureAlgorithm:
        'Ed25519'
    };

    const firstManifest = {
      ...baseManifest,
      datasetId: randomUUID()
    };

    const secondManifest = {
      ...baseManifest,
      datasetId: randomUUID()
    };

    const first =
      await ledger.register(
        firstManifest
      );

    assert.equal(
      first.alreadyExists,
      false
    );

    await assert.rejects(
      () =>
        ledger.register(
          secondManifest
        ),
      (error) => {
        const details =
          Array.isArray(error.details)
            ? error.details
                .map(
                  (detail) =>
                    detail.message
                )
                .join(' ')
            : '';

        const message =
          `${error.message} ${details}`;

        assert.match(
          message,
          /Replay detected: nonce already used for signer gateway-farm-001/
        );

        return true;
      }
    );
  }
);

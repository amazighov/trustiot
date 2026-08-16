import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createHash,
  randomBytes
} from 'node:crypto';

import {
  mkdir,
  writeFile,
  rm
} from 'node:fs/promises';

import {
  SynapseStorageAdapter
} from '../src/adapters/synapseStorage.js';

import {
  retrieveStoredArtifact
} from '../src/core/storageRetrieval.js';

test(
  'Synapse uploads and retrieves an artifact with matching SHA-256',
  async () => {
    if (
      !process.env.SYNAPSE_PRIVATE_KEY
    ) {
      throw new Error(
        'SYNAPSE_PRIVATE_KEY is required'
      );
    }

    await mkdir(
      'data/work',
      {
        recursive: true
      }
    );

    const filePath =
      `data/work/synapse-integration-${Date.now()}.bin`;

    // Well above Synapse's 127-byte minimum.
    const originalBytes =
      randomBytes(1024);

    await writeFile(
      filePath,
      originalBytes
    );

    try {
      const expectedSha256 =
        createHash('sha256')
          .update(originalBytes)
          .digest('hex');

      const storage =
        new SynapseStorageAdapter();

      const receipt =
        await storage.store(
          filePath
        );

      assert.equal(
        receipt.driver,
        'synapse'
      );

      assert.equal(
        receipt.network,
        'calibration'
      );

      assert.ok(
        receipt.pieceCid
      );

      assert.equal(
        receipt.ref,
        receipt.pieceCid
      );

      assert.equal(
        receipt.complete,
        true
      );

      const record = {
        storageDriver:
          'synapse',

        storageNetwork:
          receipt.network,

        storageRef:
          receipt.ref,

        pieceCid:
          receipt.pieceCid,

        cid: null,

        ipfsRootCid: null
      };

      const retrievedBytes =
        await retrieveStoredArtifact(
          record
        );

      const actualSha256 =
        createHash('sha256')
          .update(retrievedBytes)
          .digest('hex');

      assert.equal(
        actualSha256,
        expectedSha256
      );
    } finally {
      await rm(
        filePath,
        {
          force: true
        }
      );
    }
  }
);

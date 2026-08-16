import {
  mkdir,
  writeFile,
  readFile
} from 'node:fs/promises';

import path from 'node:path';

import { generateReadings } from './core/simulator.js';
import { createBatch } from './core/batch.js';

import {
  generateDataKey,
  encryptBatch
} from './core/crypto.js';

import {
  buildPublicManifest
} from './core/manifest.js';

import {
  signManifest,
  verifySignedManifest
} from './core/signing.js';

import {
  validateReplayProtection
} from './core/replay.js';

import {
  LocalStorageAdapter
} from './adapters/localStorage.js';

import {
  FilecoinPinAdapter
} from './adapters/filecoinPin.js';

import {
  LocalLedgerAdapter
} from './adapters/localLedger.js';

import {
  FabricLedgerAdapter
} from './adapters/fabricLedger.js';
import {
  SynapseStorageAdapter
} from './adapters/synapseStorage.js';
async function main() {
  await mkdir('data/work', {
    recursive: true
  });

  // --------------------------------------------------
  // 1. Generate IoT readings
  // --------------------------------------------------

  const readings = generateReadings({
    count: 25
  });

  const batch = createBatch(
    readings,
    'FarmOrg'
  );

  // --------------------------------------------------
  // 2. Encrypt dataset
  // --------------------------------------------------

  const key = generateDataKey();

  const encrypted = encryptBatch(
    batch.body,
    key
  );

  const encryptedPath = path.join(
    'data/work',
    `${batch.datasetId}.enc.json`
  );

  await writeFile(
    encryptedPath,
    encrypted.envelope
  );

  // --------------------------------------------------
  // 3. Storage adapter
  // --------------------------------------------------

  let storage;

switch (process.env.STORAGE_DRIVER) {
  case 'synapse':
    storage =
      new SynapseStorageAdapter();
    break;

  case 'filecoin':
  case 'filecoin-pin':
    storage =
      new FilecoinPinAdapter();
    break;

  case 'local':
  case undefined:
  case '':
    storage =
      new LocalStorageAdapter();
    break;

  default:
    throw new Error(
      `Unsupported STORAGE_DRIVER: ${process.env.STORAGE_DRIVER}`
    );
}
  const storageReceipt =
    await storage.store(
      encryptedPath
    );

  // --------------------------------------------------
  // 4. Build public manifest
  // --------------------------------------------------

  const manifest =
    buildPublicManifest(
      batch,
      storageReceipt,
      encrypted.ciphertextSha256
    );

  // --------------------------------------------------
  // 5. Sign manifest
  // --------------------------------------------------

  const privateKeyPem = await readFile(
    'data/keys/gateway-private.pem',
    'utf8'
  );

  const publicKeyPem = await readFile(
    'data/keys/gateway-public.pem',
    'utf8'
  );

  const signedManifest =
    signManifest(
      manifest,
      {
        signerId: 'gateway-farm-001',
        privateKeyPem
      }
    );

  // --------------------------------------------------
  // 6. Verify signature
  // --------------------------------------------------

  const signatureValid =
    verifySignedManifest(
      signedManifest,
      publicKeyPem
    );

  if (!signatureValid) {
    throw new Error(
      'Manifest signature verification failed'
    );
  }

  // --------------------------------------------------
  // 7. Anti-replay validation
  // --------------------------------------------------

  const replayValidation =
    validateReplayProtection(
      signedManifest
    );

  if (!replayValidation.valid) {
    throw new Error(
      `Manifest replay protection failed: ${replayValidation.reason}`
    );
  }

  // --------------------------------------------------
  // 8. Build secured manifest
  // --------------------------------------------------

  const securedManifest = {
    ...manifest,

    signerId:
      signedManifest.signerId,

    signedAt:
      signedManifest.timestamp,

    nonce:
      signedManifest.nonce,

    signature:
      signedManifest.signature,

    signatureAlgorithm:
      signedManifest.signatureAlgorithm
  };

  // --------------------------------------------------
  // 9. Governance adapter
  // --------------------------------------------------

  const ledger =
    process.env.LEDGER_DRIVER === 'fabric'
      ? new FabricLedgerAdapter()
      : new LocalLedgerAdapter();

  const ledgerReceipt =
    await ledger.register(
      securedManifest
    );

  // --------------------------------------------------
  // 10. Output
  // --------------------------------------------------

  console.log(
    JSON.stringify(
      {
        message:
          'TrustIoT MVP vertical slice completed',

        datasetId:
          batch.datasetId,

        readings:
          batch.readingCount,

        encryptedArtifact:
          encryptedPath,

        storage:
          storageReceipt,

        security: {
          signerId:
            signedManifest.signerId,

          signedAt:
            signedManifest.timestamp,

          nonce:
            signedManifest.nonce,

          signatureAlgorithm:
            signedManifest.signatureAlgorithm,

          signatureValid,

          replayProtection:
            replayValidation.valid
        },

        governance:
          ledgerReceipt,

        publicManifest:
          securedManifest,

        note:
          'Encryption key was ephemeral and was not written to disk.'
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
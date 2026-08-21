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
  performance
} from 'node:perf_hooks';

import {
  SynapseStorageAdapter
} from './adapters/synapseStorage.js';

import {
  retrieveStoredArtifact
} from './core/storageRetrieval.js';

if (!process.env.SYNAPSE_PRIVATE_KEY) {
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

const sizeBytes =
  Number(
    process.argv[2] ?? 4096
  );

if (
  !Number.isInteger(sizeBytes) ||
  sizeBytes < 127
) {
  throw new Error(
    'Benchmark size must be an integer >= 127 bytes'
  );
}

const filePath =
  `data/work/synapse-benchmark-${Date.now()}.bin`;

const bytes =
  randomBytes(
    sizeBytes
  );

await writeFile(
  filePath,
  bytes
);

const expectedSha256 =
  createHash('sha256')
    .update(bytes)
    .digest('hex');

try {
  const storage =
    new SynapseStorageAdapter();

  const totalStart =
    performance.now();

  const uploadStart =
    performance.now();

  const receipt =
    await storage.store(
      filePath
    );

  const uploadEnd =
    performance.now();

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

  const retrievalStart =
    performance.now();

  const retrieved =
    await retrieveStoredArtifact(
      record
    );

  const retrievalEnd =
    performance.now();

  const actualSha256 =
    createHash('sha256')
      .update(retrieved)
      .digest('hex');

  const totalEnd =
    performance.now();

  const verified =
    expectedSha256 ===
    actualSha256;

  console.log(
    JSON.stringify(
      {
        benchmark:
          'trustiot.synapse.v1',

        network:
          receipt.network,

        artifactSizeBytes:
          sizeBytes,

        pieceCid:
          receipt.pieceCid,

        requestedCopies:
          receipt.requestedCopies,

        complete:
          receipt.complete,

        failedAttempts:
          receipt.failedAttempts,

        uploadLatencyMs:
          Math.round(
            uploadEnd -
            uploadStart
          ),

        retrievalLatencyMs:
          Math.round(
            retrievalEnd -
            retrievalStart
          ),

        totalLatencyMs:
          Math.round(
            totalEnd -
            totalStart
          ),

        expectedSha256,

        actualSha256,

        verified
      },
      null,
      2
    )
  );

  if (!verified) {
    process.exitCode = 2;
  }
} finally {
  await rm(
    filePath,
    {
      force: true
    }
  );
}

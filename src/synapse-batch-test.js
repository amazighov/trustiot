

import { createHash } from 'node:crypto';
import {
  readFile,
  readdir,
  stat,
  appendFile,
  mkdir,

} from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

import {
  SynapseStorageAdapter
} from './adapters/synapseStorage.js';

import {
  retrieveStoredArtifact
} from './core/storageRetrieval.js';


// ----------------------------------------------------
// Environment
// ----------------------------------------------------

if (
  !process.env.SYNAPSE_PRIVATE_KEY &&
  process.env.PRIVATE_KEY
) {
  process.env.SYNAPSE_PRIVATE_KEY =
    process.env.PRIVATE_KEY;
}

if (!process.env.SYNAPSE_PRIVATE_KEY) {
  throw new Error(
    'SYNAPSE_PRIVATE_KEY is required'
  );
}


// ----------------------------------------------------
// Find latest batch artifact
// ----------------------------------------------------

const artifactsDir =
  path.resolve('artifacts/batches');

const requestedPath = process.argv[2];

let selected;

if (requestedPath) {
  const filePath =
    path.resolve(requestedPath);

  const info =
    await stat(filePath);

  selected = {
    file: path.basename(filePath),
    filePath,
    mtimeMs: info.mtimeMs
  };
} else {
  const files =
    (await readdir(artifactsDir))
      .filter(file =>
        file.endsWith('.json')
      );

  if (files.length === 0) {
    throw new Error(
      'No batch artifacts found in artifacts/batches'
    );
  }

  const candidates =
    await Promise.all(
      files.map(async file => {
        const filePath =
          path.join(
            artifactsDir,
            file
          );

        const info =
          await stat(filePath);

        return {
          file,
          filePath,
          mtimeMs: info.mtimeMs
        };
      })
    );

  candidates.sort(
    (a, b) =>
      b.mtimeMs - a.mtimeMs
  );

  selected =
    candidates[0];
}


// ----------------------------------------------------
// Read batch artifact
// ----------------------------------------------------

const originalBytes =
  await readFile(
    selected.filePath
  );

const artifact =
  JSON.parse(
    originalBytes.toString('utf8')
  );


// ----------------------------------------------------
// Validate batch structure
// ----------------------------------------------------

if (
  artifact.schema !==
  'trustiot.sensor.batch.v1'
) {
  throw new Error(
    `Unexpected schema: ${artifact.schema}`
  );
}

if (
  !artifact.deviceId ||
  !artifact.sensor ||
  !Array.isArray(artifact.readings) ||
  !Number.isInteger(artifact.readingCount) ||
  !artifact.sha256
) {
  throw new Error(
    'Invalid TrustIoT batch artifact'
  );
}

if (
  artifact.readingCount !==
  artifact.readings.length
) {
  throw new Error(
    'readingCount does not match readings.length'
  );
}


// ----------------------------------------------------
// Verify batch payload SHA-256
// ----------------------------------------------------

// ----------------------------------------------------
// Verify batch payload SHA-256
// ----------------------------------------------------

if (
  artifact.batchStartedAt < 1700000000 ||
  artifact.batchEndedAt < 1700000000
) {
  throw new Error(
    'Invalid batch timestamp - refusing Synapse upload'
  );
}

const canonicalPayload =
  JSON.stringify({
    deviceId:
      artifact.deviceId,

    sensor:
      artifact.sensor,

    batchStartedAt:
      artifact.batchStartedAt,

    batchEndedAt:
      artifact.batchEndedAt,

    readingCount:
      artifact.readingCount,

    readings:
      artifact.readings
  });

const calculatedPayloadSha256 =
  createHash('sha256')
    .update(canonicalPayload)
    .digest('hex');

const payloadVerified =
  calculatedPayloadSha256 ===
  artifact.sha256;

// ----------------------------------------------------
// Hash complete artifact file
// ----------------------------------------------------

const expectedFileSha256 =
  createHash('sha256')
    .update(originalBytes)
    .digest('hex');
// ----------------------------------------------------
// Deduplication
// ----------------------------------------------------

const ledgerDir =
  path.resolve('data/ledger');

const ledgerPath =
  path.join(
    ledgerDir,
    'synapse-batches.jsonl'
  );

await mkdir(
  ledgerDir,
  {
    recursive: true
  }
);

let previousRecords = [];

try {
  const ledgerContent =
    await readFile(
      ledgerPath,
      'utf8'
    );

  previousRecords =
    ledgerContent
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line));

} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error;
  }
}

const existingRecord =
  previousRecords.find(
    record =>
      record.fileSha256 === expectedFileSha256 &&
      record.storageVerified === true
  );

if (existingRecord) {
  console.log(
    '\nBatch already verified and recorded.'
  );

  console.log(
    'Artifact:',
    existingRecord.artifact
  );

  console.log(
    'PieceCID:',
    existingRecord.pieceCid
  );

  console.log(
    'File SHA-256:',
    existingRecord.fileSha256
  );

  console.log(
    'Skipping Synapse upload.'
  );

  process.exit(0);
}

// ----------------------------------------------------
// Display local verification
// ----------------------------------------------------


console.log(
  'TrustIoT batch:',
  selected.file
);

console.log(
  'Device:',
  artifact.deviceId
);

console.log(
  'Sensor:',
  artifact.sensor
);

console.log(
  'Readings:',
  artifact.readingCount
);

console.log(
  'Batch started:',
  artifact.batchStartedAt
);

console.log(
  'Batch ended:',
  artifact.batchEndedAt
);

console.log(
  'Payload SHA-256:',
  artifact.sha256
);

console.log(
  'Calculated SHA-256:',
  calculatedPayloadSha256
);

console.log(
  'Payload verified:',
  payloadVerified
);


if (!payloadVerified) {
  throw new Error(
    'Batch payload SHA-256 verification failed before upload'
  );
}


// ----------------------------------------------------
// Synapse upload
// ----------------------------------------------------

const storage =
  new SynapseStorageAdapter();

const totalStart =
  performance.now();

const uploadStart =
  performance.now();

const receipt =
  await storage.store(
    selected.filePath
  );

const uploadEnd =
  performance.now();


// ----------------------------------------------------
// Build retrieval record
// ----------------------------------------------------

const record = {
  storageDriver:
    'synapse',

  storageNetwork:
    receipt.network,

  storageRef:
    receipt.ref,

  pieceCid:
    receipt.pieceCid,

  cid:
    null,

  ipfsRootCid:
    null
};


// ----------------------------------------------------
// Retrieve from Synapse
// ----------------------------------------------------

const retrievalStart =
  performance.now();

const retrieved =
  await retrieveStoredArtifact(
    record
  );

const retrievalEnd =
  performance.now();


// ----------------------------------------------------
// Verify retrieved artifact
// ----------------------------------------------------

const actualFileSha256 =
  createHash('sha256')
    .update(retrieved)
    .digest('hex');

const storageVerified =
  expectedFileSha256 ===
  actualFileSha256;

const totalEnd =
  performance.now();


// ----------------------------------------------------
// Final result
// ----------------------------------------------------

const result = {
  test:
    'trustiot.sensor.batch.synapse.v1',

  artifact:
    selected.file,

  schema:
    artifact.schema,

  deviceId:
    artifact.deviceId,

  sensor:
    artifact.sensor,

  batchStartedAt:
    artifact.batchStartedAt,

  batchEndedAt:
    artifact.batchEndedAt,

  readingCount:
    artifact.readingCount,

  payloadSha256:
    artifact.sha256,

  calculatedPayloadSha256,

  payloadVerifiedBeforeUpload:
    payloadVerified,

  artifactSizeBytes:
    originalBytes.length,

  network:
    receipt.network,

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

  expectedFileSha256,

  actualFileSha256,

  storageVerified
};

 

await mkdir(
  ledgerDir,
  {
    recursive: true
  }
);


 
  

const ledgerRecord = {
  recordType:
    'trustiot.storage.receipt.v1',

  recordedAt:
    new Date().toISOString(),

  artifact:
    selected.file,

  deviceId:
    artifact.deviceId,

  sensor:
    artifact.sensor,

  batchStartedAt:
    artifact.batchStartedAt,

  batchEndedAt:
    artifact.batchEndedAt,

  readingCount:
    artifact.readingCount,

  payloadSha256:
    artifact.sha256,

  fileSha256:
    expectedFileSha256,

  pieceCid:
    receipt.pieceCid,

  network:
    receipt.network,

  requestedCopies:
    receipt.requestedCopies,

  complete:
    receipt.complete,

  failedAttempts:
    receipt.failedAttempts,

  uploadLatencyMs:
    result.uploadLatencyMs,

  retrievalLatencyMs:
    result.retrievalLatencyMs,

  totalLatencyMs:
    result.totalLatencyMs,

  storageVerified:
    storageVerified
};

await appendFile(
  ledgerPath,
  JSON.stringify(ledgerRecord) + '\n'
);

console.log(
  'Ledger record appended:',
  ledgerPath
);

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);


// ----------------------------------------------------
// Exit status
// ----------------------------------------------------

if (!storageVerified) {
  process.exitCode = 2;
}

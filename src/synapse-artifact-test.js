import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

import {
  SynapseStorageAdapter
} from './adapters/synapseStorage.js';

import {
  retrieveStoredArtifact
} from './core/storageRetrieval.js';


// Support the existing .env variable name too
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


const artifactsDir =
  path.resolve('artifacts');


// ----------------------------------------------------
// Find latest TrustIoT sensor artifact
// ----------------------------------------------------

const files =
  (await readdir(artifactsDir))
    .filter(file =>
      file.endsWith('.json')
    );

if (files.length === 0) {
  throw new Error(
    'No artifacts found in artifacts/'
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

const selected =
  candidates[0];


// ----------------------------------------------------
// Read and validate artifact
// ----------------------------------------------------

const originalBytes =
  await readFile(
    selected.filePath
  );

const artifact =
  JSON.parse(
    originalBytes.toString('utf8')
  );

if (
  artifact.schema !==
  'trustiot.sensor.v1'
) {
  throw new Error(
    `Unexpected schema: ${artifact.schema}`
  );
}

if (
  !artifact.payload ||
  !artifact.sha256
) {
  throw new Error(
    'Invalid TrustIoT artifact'
  );
}


// Reproduce the canonical payload used by receiver.js
const canonicalPayload =
  JSON.stringify({
    deviceId:
      artifact.payload.deviceId,

    sensor:
      artifact.payload.sensor,

    temperature:
      artifact.payload.temperature,

    humidity:
      artifact.payload.humidity,

    pressure:
      artifact.payload.pressure,

    timestamp:
      artifact.payload.timestamp
  });

const calculatedPayloadSha256 =
  createHash('sha256')
    .update(canonicalPayload)
    .digest('hex');

const payloadVerified =
  calculatedPayloadSha256 ===
  artifact.sha256;


// Hash of the complete JSON artifact file
const expectedFileSha256 =
  createHash('sha256')
    .update(originalBytes)
    .digest('hex');


console.log(
  'TrustIoT artifact:',
  selected.file
);

console.log(
  'Device:',
  artifact.payload.deviceId
);

console.log(
  'Sensor:',
  artifact.payload.sensor
);

console.log(
  'Payload SHA-256:',
  artifact.sha256
);

console.log(
  'Payload verified:',
  payloadVerified
);


if (!payloadVerified) {
  throw new Error(
    'Artifact payload SHA-256 verification failed before upload'
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
// Synapse retrieval
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


console.log(
  JSON.stringify(
    {
      test:
        'trustiot.sensor.synapse.v1',

      artifact:
        selected.file,

      schema:
        artifact.schema,

      deviceId:
        artifact.payload.deviceId,

      sensor:
        artifact.payload.sensor,

      sensorTimestamp:
        artifact.payload.timestamp,

      payloadSha256:
        artifact.sha256,

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
    },
    null,
    2
  )
);


if (!storageVerified) {
  process.exitCode = 2;
}

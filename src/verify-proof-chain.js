import fs from 'fs';
import path from 'path';
import crypto from 'crypto';


// ----------------------------------------------------
// Helpers
// ----------------------------------------------------

function fail(
  message,
  code = 1
) {
  console.error(
    `FAIL: ${message}`
  );

  process.exit(
    code
  );
}


function readJsonLines(
  filePath
) {
  if (
    !fs.existsSync(
      filePath
    )
  ) {
    fail(
      `Ledger not found: ${filePath}`
    );
  }

  return fs
    .readFileSync(
      filePath,
      'utf8'
    )
    .split(/\r?\n/)
    .filter(Boolean)
    .map(
      line =>
        JSON.parse(
          line
        )
    );
}


function fileSha256(
  filePath
) {
  return crypto
    .createHash(
      'sha256'
    )
    .update(
      fs.readFileSync(
        filePath
      )
    )
    .digest(
      'hex'
    );
}


// ----------------------------------------------------
// Input
// ----------------------------------------------------

const requestedPath =
  process.argv[2];

if (!requestedPath) {
  fail(
    'Usage: node src/verify-proof-chain.js <artifact.json>'
  );
}


const artifactPath =
  path.resolve(
    requestedPath
  );

if (
  !fs.existsSync(
    artifactPath
  )
) {
  fail(
    `Artifact not found: ${artifactPath}`
  );
}


const artifactName =
  path.basename(
    artifactPath
  );


// ----------------------------------------------------
// Artifact
// ----------------------------------------------------

let artifact;

try {
  artifact =
    JSON.parse(
      fs.readFileSync(
        artifactPath,
        'utf8'
      )
    );
} catch (error) {
  fail(
    `Invalid artifact JSON: ${error.message}`
  );
}


const calculatedFileSha256 =
  fileSha256(
    artifactPath
  );


// ----------------------------------------------------
// Ledgers
// ----------------------------------------------------

const synapseLedgerPath =
  path.resolve(
    'data/ledger/synapse-batches.jsonl'
  );

const fabricLedgerPath =
  path.resolve(
    'data/ledger/fabric-proofs.jsonl'
  );


const synapseRecords =
  readJsonLines(
    synapseLedgerPath
  );

const fabricRecords =
  readJsonLines(
    fabricLedgerPath
  );


// ----------------------------------------------------
// Find latest matching Synapse receipt
// ----------------------------------------------------

const synapseReceipt =
  [...synapseRecords]
    .reverse()
    .find(
      record =>
        record.artifact ===
        artifactName
    );


if (!synapseReceipt) {
  fail(
    `No Synapse receipt found for artifact: ${artifactName}`
  );
}


// ----------------------------------------------------
// Find latest matching Fabric receipt
// ----------------------------------------------------

const fabricReceipt =
  [...fabricRecords]
    .reverse()
    .find(
      record =>
        record.artifact ===
        artifactName
    );


if (!fabricReceipt) {
  fail(
    `No Fabric receipt found for artifact: ${artifactName}`
  );
}


// ----------------------------------------------------
// Artifact <-> Synapse verification
// ----------------------------------------------------

const payloadLinked =
  synapseReceipt.payloadSha256 ===
  artifact.sha256;


const fileLinked =
  synapseReceipt.fileSha256 ===
  calculatedFileSha256;


const deviceLinked =
  synapseReceipt.deviceId ===
  artifact.deviceId;


const sensorLinked =
  synapseReceipt.sensor ===
  artifact.sensor;


const readingCountLinked =
  synapseReceipt.readingCount ===
  artifact.readingCount;


const storageVerified =
  synapseReceipt.storageVerified ===
  true;


const pieceCid =
  synapseReceipt.pieceCid;


// ----------------------------------------------------
// Synapse <-> Fabric verification
// ----------------------------------------------------

const fabricVerified =
  fabricReceipt.fabricVerified ===
  true;


const fabricPayloadLinked =
  fabricReceipt.payloadSha256 ===
  synapseReceipt.payloadSha256;


const fabricFileLinked =
  fabricReceipt.fileSha256 ===
  synapseReceipt.fileSha256;


const fabricPieceCidLinked =
  fabricReceipt.pieceCid ===
  synapseReceipt.pieceCid;


const fabricDeviceLinked =
  fabricReceipt.deviceId ===
  artifact.deviceId;


// ----------------------------------------------------
// Overall
// ----------------------------------------------------

const artifactToStorageVerified =
  payloadLinked &&
  fileLinked &&
  deviceLinked &&
  sensorLinked &&
  readingCountLinked &&
  storageVerified;


const storageToFabricVerified =
  fabricVerified &&
  fabricPayloadLinked &&
  fabricFileLinked &&
  fabricPieceCidLinked &&
  fabricDeviceLinked;


const overallVerified =
  artifactToStorageVerified &&
  storageToFabricVerified;


// ----------------------------------------------------
// Report
// ----------------------------------------------------

console.log(
  '\n================================'
);

console.log(
  'TrustIoT Proof Chain Verifier'
);

console.log(
  '================================\n'
);


console.log(
  'Artifact:',
  artifactName
);

console.log(
  'Device:',
  artifact.deviceId
);

console.log(
  'Readings:',
  artifact.readingCount
);


console.log(
  '\n--- Artifact -> Synapse ---'
);

console.log(
  'Payload SHA-256 linkage:',
  payloadLinked
    ? 'VERIFIED'
    : 'FAILED'
);

console.log(
  'File SHA-256 linkage:',
  fileLinked
    ? 'VERIFIED'
    : 'FAILED'
);

console.log(
  'Device linkage:',
  deviceLinked
    ? 'VERIFIED'
    : 'FAILED'
);

console.log(
  'Sensor linkage:',
  sensorLinked
    ? 'VERIFIED'
    : 'FAILED'
);

console.log(
  'Reading count linkage:',
  readingCountLinked
    ? 'VERIFIED'
    : 'FAILED'
);

console.log(
  'Storage verification:',
  storageVerified
    ? 'VERIFIED'
    : 'FAILED'
);

console.log(
  'PieceCID:',
  pieceCid ??
    'MISSING'
);


console.log(
  '\n--- Synapse -> Fabric ---'
);

console.log(
  'Payload linkage:',
  fabricPayloadLinked
    ? 'VERIFIED'
    : 'FAILED'
);

console.log(
  'File linkage:',
  fabricFileLinked
    ? 'VERIFIED'
    : 'FAILED'
);

console.log(
  'PieceCID linkage:',
  fabricPieceCidLinked
    ? 'VERIFIED'
    : 'FAILED'
);

console.log(
  'Device linkage:',
  fabricDeviceLinked
    ? 'VERIFIED'
    : 'FAILED'
);

console.log(
  'Fabric verification:',
  fabricVerified
    ? 'VERIFIED'
    : 'FAILED'
);


console.log(
  '\n--------------------------------'
);

console.log(
  'Artifact -> Storage:',
  artifactToStorageVerified
    ? 'VERIFIED'
    : 'FAILED'
);

console.log(
  'Storage -> Fabric:',
  storageToFabricVerified
    ? 'VERIFIED'
    : 'FAILED'
);

console.log(
  'Overall proof chain:',
  overallVerified
    ? 'VERIFIED'
    : 'FAILED'
);

console.log(
  '--------------------------------\n'
);


if (
  !overallVerified
) {
  process.exitCode =
    2;
}

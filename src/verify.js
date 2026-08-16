import {
  retrieveStoredArtifact
} from './core/storageRetrieval.js';
import {
  getTrustedSigner
} from './core/signerRegistry.js';
import { createHash } from 'node:crypto';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import {
  verifySignedManifest
} from './core/signing.js';

import { LocalLedgerAdapter } from './adapters/localLedger.js';
import { FabricLedgerAdapter } from './adapters/fabricLedger.js';

const [datasetId] = process.argv.slice(2);

if (!datasetId) {
  console.error('Usage: npm run verify -- <datasetId>');
  process.exit(1);
}

const ledgerDriver = process.env.LEDGER_DRIVER || 'local';

let record;
let ledger;

if (ledgerDriver === 'fabric') {
  ledger = new FabricLedgerAdapter();
  record = await ledger.read(datasetId);
} else {
  const ledgerPath = 'data/local-ledger.jsonl';

  const ledgerText = await readFile(ledgerPath, 'utf8');

  const records = ledgerText
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  record = records
    .slice()
    .reverse()
    .find(
      (item) =>
        item.datasetId === datasetId &&
        item.recordType !== 'verification'
    );

  if (!record) {
    throw new Error(
      `Dataset not found in local ledger: ${datasetId}`
    );
  }
}



if (!record.ciphertextSha256) {
  throw new Error(
    `Dataset has no ciphertextSha256: ${datasetId}`
  );
}
let storedSignatureValid = null;

if (ledgerDriver === 'fabric') {
  const trustedSigner =
  await getTrustedSigner(
    record.signerId
  );

if (
  trustedSigner.algorithm !==
  record.signatureAlgorithm
) {
  throw new Error(
    `Signature algorithm mismatch for signer ${record.signerId}`
  );
}

const publicKeyPem =
  trustedSigner.publicKeyPem;

  const originalManifest = {
    datasetId: record.datasetId,
    deviceId: record.deviceId,
    ownerOrg: record.ownerOrg,
    cid: record.cid,
    storageRef: record.storageRef,
    storageDriver: record.storageDriver,
    ciphertextSha256:
      record.ciphertextSha256,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    readingCount: record.readingCount,
    encryption: record.encryption,
    schemaVersion: record.schemaVersion,
    createdAt: record.createdAt,
    storageNetwork:
  record.storageNetwork ?? null,

pieceCid:
  record.pieceCid ?? null,

ipfsRootCid:
  record.ipfsRootCid ?? null,

    // The manifest was originally signed before
    // verification happened.
    verificationStatus: 'UNVERIFIED'
  };

  const signedRecord = {
    manifest: originalManifest,
    signerId: record.signerId,
    timestamp: record.signedAt,
    nonce: record.nonce,
    signature: record.signature,
    signatureAlgorithm:
      record.signatureAlgorithm
  };

  storedSignatureValid =
    verifySignedManifest(
      signedRecord,
      publicKeyPem
    );

  if (!storedSignatureValid) {
    throw new Error(
      `Stored manifest signature verification failed for dataset ${datasetId}`
    );
  }

  console.log(
    'Stored manifest signature: VERIFIED'
  );
}

console.log(
  `Dataset: ${datasetId}`
);

console.log(
  `Ledger driver: ${ledgerDriver}`
);

console.log(
  `Storage driver: ${record.storageDriver}`
);

const bytes =
  await retrieveStoredArtifact(
    record
  );

const actualSha256 = createHash('sha256')
  .update(bytes)
  .digest('hex');

const expectedSha256 =
  record.ciphertextSha256.toLowerCase();

const verified =
  actualSha256.toLowerCase() === expectedSha256;

const verificationStatus =
  verified ? 'VERIFIED' : 'REJECTED';

const outputPath =
  `data/work/retrieved-${datasetId}.enc.json`;

await writeFile(outputPath, bytes);

let governanceUpdate = null;

if (ledgerDriver === 'fabric') {
  governanceUpdate =
    await ledger.setVerificationStatus(
      datasetId,
      verificationStatus
    );
} else {
  const verificationRecord = {
    recordType: 'verification',
    datasetId,
   storageDriver:
  record.storageDriver,

storageRef:
  record.storageRef,

pieceCid:
  record.pieceCid ?? null,

ipfsRootCid:
  record.ipfsRootCid ?? null,

verificationSource:
  `${record.storageDriver}-retrieval`,
    expectedSha256,
    actualSha256,
    verificationStatus,
    
    verifiedAt: new Date().toISOString()
  };
 
 

  await appendFile(
    'data/local-ledger.jsonl',
    `${JSON.stringify(verificationRecord)}\n`
  );

  governanceUpdate = verificationRecord;
}

console.log(
  JSON.stringify(
    
      {
  datasetId,
  ledgerDriver,

  storageDriver:
    record.storageDriver,

  storageNetwork:
    record.storageNetwork ?? null,

  storageRef:
    record.storageRef,

  pieceCid:
    record.pieceCid ?? null,

  ipfsRootCid:
    record.ipfsRootCid ?? null,

  cid:
    record.cid ?? null,

  storedSignatureValid,
  expectedSha256,
  actualSha256,
  verificationStatus,
  retrievedArtifact:
    outputPath,
  governanceUpdate
},
null, 
2 
) 
); 
if (!verified)
   { process.exitCode = 2; }

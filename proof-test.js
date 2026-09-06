import {
  readFile
} from 'node:fs/promises';

import {
  createProofRecord
} from './src/core/proofRecord.js';


const ledgerPath =
  'data/ledger/synapse-batches.jsonl';

const content =
  await readFile(
    ledgerPath,
    'utf8'
  );

const records =
  content
    .split('\n')
    .filter(Boolean)
    .map(
      line =>
        JSON.parse(line)
    );

if (
  records.length === 0
) {
  throw new Error(
    'No Synapse ledger records found'
  );
}

const latest =
  records[
    records.length - 1
  ];

if (
  latest.storageVerified !==
  true
) {
  throw new Error(
    'Latest storage record is not verified'
  );
}

const proof =
  createProofRecord({
    artifact:
      latest.artifact,

    deviceId:
      latest.deviceId,

    sensor:
      latest.sensor,

    batchStartedAt:
      latest.batchStartedAt,

    batchEndedAt:
      latest.batchEndedAt,

    readingCount:
      latest.readingCount,

    payloadSha256:
      latest.payloadSha256,

    fileSha256:
      latest.fileSha256,

    pieceCid:
      latest.pieceCid,

    network:
      latest.network,

    storageVerified:
      latest.storageVerified,

    storageState:
      latest.storageState ??
      (
        latest.complete
          ? 'COMMITTED'
          : 'PARTIAL'
      )
  });

console.log(
  JSON.stringify(
    proof,
    null,
    2
  )
);

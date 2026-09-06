import dotenv from 'dotenv';

dotenv.config({
  override: true
});

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import grpc from '@grpc/grpc-js';

import {
  connect,
  hash,
  signers
} from '@hyperledger/fabric-gateway';

import {
  createProofRecord
} from './core/proofRecord.js';


// ----------------------------------------------------
// Environment
// ----------------------------------------------------

const requiredEnv = [
  'FABRIC_CHANNEL',
  'FABRIC_CHAINCODE',
  'FABRIC_MSP_ID',
  'FABRIC_PEER_ENDPOINT',
  'FABRIC_PEER_HOST_ALIAS',
  'FABRIC_CERT_PATH',
  'FABRIC_KEY_PATH',
  'FABRIC_TLS_CERT_PATH'
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(
      `${key} is required`
    );
  }
}


// ----------------------------------------------------
// Read latest verified TrustIoT receipt
// ----------------------------------------------------

const ledgerPath =
  path.resolve(
    'data/ledger/synapse-batches.jsonl'
  );

const ledgerContent =
  fs.readFileSync(
    ledgerPath,
    'utf8'
  );

const records =
  ledgerContent
    .split('\n')
    .filter(Boolean)
    .map(
      line =>
        JSON.parse(line)
    );

const requestedArtifact =
  process.argv[2]
    ? path.basename(process.argv[2])
    : null;

let latest;

if (requestedArtifact) {
  latest =
    [...records]
      .reverse()
      .find(
        record =>
          record.artifact === requestedArtifact &&
          record.storageVerified === true
      );

  if (!latest) {
    throw new Error(
      `No verified Synapse receipt found for artifact: ${requestedArtifact}`
    );
  }
} else {
  latest =
    [...records]
      .reverse()
      .find(
        record =>
          record.storageVerified === true
      );

  if (!latest) {
    throw new Error(
      'No verified Synapse receipt found'
    );
  }
}


// ----------------------------------------------------
// Build TrustIoT proof
// ----------------------------------------------------

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


// ----------------------------------------------------
// Identity
// ----------------------------------------------------

const credentials =
  fs.readFileSync(
    process.env.FABRIC_CERT_PATH
  );

const identity = {
  mspId:
    process.env.FABRIC_MSP_ID,

  credentials
};


// ----------------------------------------------------
// Signer
// ----------------------------------------------------

const privateKeyPem =
  fs.readFileSync(
    process.env.FABRIC_KEY_PATH
  );

const privateKey =
  crypto.createPrivateKey(
    privateKeyPem
  );

const signer =
  signers.newPrivateKeySigner(
    privateKey
  );


// ----------------------------------------------------
// gRPC client
// ----------------------------------------------------

const tlsRootCert =
  fs.readFileSync(
    process.env.FABRIC_TLS_CERT_PATH
  );

const client =
  new grpc.Client(
    process.env.FABRIC_PEER_ENDPOINT,
    grpc.credentials.createSsl(
      tlsRootCert
    ),
    {
      'grpc.ssl_target_name_override':
        process.env.FABRIC_PEER_HOST_ALIAS
    }
  );


// ----------------------------------------------------
// Gateway
// ----------------------------------------------------

const gateway =
  connect({
    client,

    identity,

    signer,

    hash:
      hash.sha256
  });

try {
  const network =
    gateway.getNetwork(
      process.env.FABRIC_CHANNEL
    );
const contract =
  network.getContract(
    process.env.FABRIC_CHAINCODE,
    'TrustIoTProofContract'
  );
  

  // --------------------------------------------------
  // Deduplication
  // --------------------------------------------------

  const existsBytes =
    await contract.evaluateTransaction(
      'ProofExists',
      proof.proofSha256
    );

  const exists =
    Buffer
      .from(
        existsBytes
      )
      .toString(
        'utf8'
      ) ===
      'true';

  if (exists) {
    console.log(
      'Fabric proof already exists.'
    );

    console.log(
      'Proof SHA-256:',
      proof.proofSha256
    );

  } else {
    // ------------------------------------------------
    // Register proof
    // ------------------------------------------------

    const result =
      await contract.submitTransaction(
        'RegisterProof',

        proof.proofSha256,

        proof.artifact,

        proof.deviceId,

        proof.sensor ?? '',

        String(
          proof.batchStartedAt
        ),

        String(
          proof.batchEndedAt
        ),

        String(
          proof.readingCount
        ),

        proof.payloadSha256,

        proof.fileSha256,

        proof.storage.pieceCid,

        proof.storage.network ?? '',

        proof.storage.storageState ?? '',

        String(
          proof.storage.storageVerified
        )
      );

    console.log(
      'Fabric proof registered.'
    );

    console.log(
      Buffer
        .from(
          result
        )
        .toString(
          'utf8'
        )
    );
  }

  // --------------------------------------------------
  // Read back and verify
  // --------------------------------------------------

  const storedBytes =
    await contract.evaluateTransaction(
      'GetProof',
      proof.proofSha256
    );

  const stored =
    JSON.parse(
      Buffer
        .from(
          storedBytes
        )
        .toString(
          'utf8'
        )
    );

  const fabricVerified =
    stored.proofSha256 ===
    proof.proofSha256;

  console.log(
    JSON.stringify(
      {
        test:
          'trustiot.fabric.proof.submit.v1',

        channel:
          process.env.FABRIC_CHANNEL,

        chaincode:
          process.env.FABRIC_CHAINCODE,

        proofSha256:
          proof.proofSha256,

        pieceCid:
          proof.storage.pieceCid,

        fabricVerified
      },
      null,
      2
    )
  );

  if (!fabricVerified) {
    process.exitCode = 2;
  }

} finally {
  gateway.close();
  client.close();
}
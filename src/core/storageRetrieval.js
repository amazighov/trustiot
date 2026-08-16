import {
  readFile
} from 'node:fs/promises';

import {
  Synapse,
  calibration,
  mainnet
} from '@filoz/synapse-sdk';

import {
  privateKeyToAccount
} from 'viem/accounts';

async function retrieveLocal(record) {
  if (!record.storageRef) {
    throw new Error(
      'Local record has no storageRef'
    );
  }

  return Buffer.from(
    await readFile(
      record.storageRef
    )
  );
}

async function retrieveFilecoinPin(record) {
  const ipfsRootCid =
    record.ipfsRootCid ??
    record.cid;

  if (!ipfsRootCid) {
    throw new Error(
      'Filecoin Pin record has no IPFS root CID'
    );
  }

  const url =
    `https://dweb.link/ipfs/${ipfsRootCid}`;

  console.log(
    `Retrieving from IPFS: ${url}`
  );

  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `IPFS retrieval failed: ${response.status} ${response.statusText}`
    );
  }

  return Buffer.from(
    await response.arrayBuffer()
  );
}

async function retrieveSynapse(record) {
  if (!record.pieceCid) {
    throw new Error(
      'Synapse record has no pieceCid'
    );
  }

  const privateKey =
    process.env.SYNAPSE_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error(
      'SYNAPSE_PRIVATE_KEY is required for Synapse retrieval'
    );
  }

  const chain =
    record.storageNetwork === 'mainnet'
      ? mainnet
      : calibration;

  const synapse =
    Synapse.create({
      account:
        privateKeyToAccount(
          privateKey
        ),

      source:
        'trustiot',

      chain,

      withCDN: false
    });

  console.log(
    `Retrieving from Synapse: ${record.pieceCid}`
  );

  const bytes =
    await synapse.storage.download({
      pieceCid:
        record.pieceCid
    });

  return Buffer.from(bytes);
}

export async function retrieveStoredArtifact(
  record
) {
  switch (record.storageDriver) {
    case 'synapse':
      return retrieveSynapse(
        record
      );

    case 'filecoin-pin':
    case 'filecoin':
      return retrieveFilecoinPin(
        record
      );

    case 'local':
      return retrieveLocal(
        record
      );

    default:
      throw new Error(
        `Unsupported storage driver: ${record.storageDriver}`
      );
  }
}

import { readFile } from 'node:fs/promises';

import {
  Synapse,
  calibration
} from '@filoz/synapse-sdk';

import {
  privateKeyToAccount
} from 'viem/accounts';

export class SynapseStorageAdapter {
  constructor({
    privateKey =
      process.env.SYNAPSE_PRIVATE_KEY,
    source =
      process.env.SYNAPSE_SOURCE ||
      'trustiot',
    withCDN =
      process.env.SYNAPSE_CDN === '1'
  } = {}) {
    if (!privateKey) {
      throw new Error(
        'SYNAPSE_PRIVATE_KEY is required'
      );
    }

    this.privateKey =
      privateKey;

    this.source =
      source;

    this.withCDN =
      withCDN;

    this.synapse =
      Synapse.create({
        account:
          privateKeyToAccount(
            privateKey
          ),

        source:
          this.source,

        chain:
          calibration,

        withCDN:
          this.withCDN
      });
  }

  async store(filePath) {
  const bytes =
    new Uint8Array(
      await readFile(filePath)
    );

  if (bytes.length < 127) {
    throw new Error(
      `Synapse requires at least 127 bytes, got ${bytes.length}`
    );
  }

  const result =
    await this.synapse.storage.upload(
      bytes
    );

  const pieceCid =
    result.pieceCid?.toString?.() ??
    String(result.pieceCid);

  return {
    driver: 'synapse',

    network: 'calibration',

    ref: pieceCid,

    // Synapse/PDP primary identifier
    pieceCid,

    // Synapse upload is not using an IPFS
    // root CID in this storage path.
    cid: null,
    ipfsRootCid: null,

    size:
      Number(result.size),

    requestedCopies:
      Number(result.requestedCopies),

    complete:
      Boolean(result.complete),

    copies:
      Array.isArray(result.copies)
        ? result.copies.length
        : 0,

    failedAttempts:
      Array.isArray(
        result.failedAttempts
      )
        ? result.failedAttempts.length
        : 0
  };
}
}
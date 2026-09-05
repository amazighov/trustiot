import {
  readFile
} from 'node:fs/promises';

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
        await readFile(
          filePath
        )
      );

    if (bytes.length < 127) {
      throw new Error(
        `Synapse requires at least 127 bytes, got ${bytes.length}`
      );
    }

    try {
      const result =
        await this.synapse.storage.upload(
          bytes
        );

      const pieceCid =
        result.pieceCid
          ?.toString?.() ??
        String(
          result.pieceCid
        );

      return {
        driver:
          'synapse',

        network:
          'calibration',

        ref:
          pieceCid,

        // Synapse/PDP primary identifier
        pieceCid,

        // This storage path does not use an
        // IPFS root CID.
        cid:
          null,

        ipfsRootCid:
          null,

        size:
          Number(
            result.size
          ),

        requestedCopies:
          Number(
            result.requestedCopies
          ),

        complete:
          Boolean(
            result.complete
          ),

        copies:
          Array.isArray(
            result.copies
          )
            ? result.copies.length
            : 0,

        failedAttempts:
          Array.isArray(
            result.failedAttempts
          )
            ? result.failedAttempts.length
            : 0,

        storageState:
          result.complete
            ? 'COMMITTED'
            : 'PARTIAL'
      };

    } catch (error) {
      const message =
        String(
          error?.shortMessage ??
          error?.message ??
          error
        );

      const details =
        String(
          error?.details ??
          ''
        );

      // ------------------------------------------------
      // Case 1:
      // Data reached storage, but on-chain commit failed.
      // ------------------------------------------------

      const storedButNotCommitted =
        message.includes(
          'data is stored but not on-chain'
        ) ||
        details.includes(
          'Failed to commit pieces on-chain'
        );

      if (
        storedButNotCommitted
      ) {
        const wrapped =
          new Error(
            'Synapse data stored but on-chain commit failed'
          );

        wrapped.name =
          'SynapseStoredNotCommittedError';

        wrapped.code =
          'SYNAPSE_STORED_NOT_COMMITTED';

        wrapped.storageState =
          'STORED_NOT_COMMITTED';

        wrapped.retryable =
          true;

        wrapped.providerId =
          error?.providerId ??
          null;

        wrapped.endpoint =
          error?.endpoint ??
          null;

        wrapped.originalError =
          error;

        throw wrapped;
      }


      // ------------------------------------------------
      // Case 2:
      // Piece could not be stored on the provider.
      // ------------------------------------------------

      const storeFailed =
        error?.name ===
          'StoreError' ||
        message.includes(
          'Failed to store on primary provider'
        ) ||
        details.includes(
          'Failed to store piece on service provider'
        );

      if (
        storeFailed
      ) {
        const wrapped =
          new Error(
            'Synapse store failed before commit'
          );

        wrapped.name =
          'SynapseStoreFailedError';

        wrapped.code =
          'SYNAPSE_STORE_FAILED';

        wrapped.storageState =
          'STORE_FAILED';

        wrapped.retryable =
          true;

        wrapped.providerId =
          error?.providerId ??
          null;

        wrapped.endpoint =
          error?.endpoint ??
          null;

        wrapped.originalError =
          error;

        throw wrapped;
      }


      // ------------------------------------------------
      // Unknown error
      // ------------------------------------------------

      throw error;
    }
  }
}
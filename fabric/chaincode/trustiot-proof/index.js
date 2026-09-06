'use strict';

const {
  Contract
} = require('fabric-contract-api');


class TrustIoTProofContract extends Contract {

  async ProofExists(
    ctx,
    proofSha256
  ) {
    if (!proofSha256) {
      throw new Error(
        'proofSha256 is required'
      );
    }

    const data =
      await ctx.stub.getState(
        proofSha256
      );

    return Boolean(
      data &&
      data.length > 0
    );
  }


  async RegisterProof(
    ctx,
    proofSha256,
    artifact,
    deviceId,
    sensor,
    batchStartedAt,
    batchEndedAt,
    readingCount,
    payloadSha256,
    fileSha256,
    pieceCid,
    storageNetwork,
    storageState,
    storageVerified
  ) {
    if (!proofSha256) {
      throw new Error(
        'proofSha256 is required'
      );
    }

    const exists =
      await this.ProofExists(
        ctx,
        proofSha256
      );

    if (exists) {
      throw new Error(
        `Proof already exists: ${proofSha256}`
      );
    }

    if (!artifact) {
      throw new Error(
        'artifact is required'
      );
    }

    if (!deviceId) {
      throw new Error(
        'deviceId is required'
      );
    }

    if (!payloadSha256) {
      throw new Error(
        'payloadSha256 is required'
      );
    }

    if (!fileSha256) {
      throw new Error(
        'fileSha256 is required'
      );
    }

    if (!pieceCid) {
      throw new Error(
        'pieceCid is required'
      );
    }

    const normalizedStorageVerified =
      String(
        storageVerified
      ).toLowerCase() ===
      'true';

    if (!normalizedStorageVerified) {
      throw new Error(
        'Only storageVerified=true proofs may be registered'
      );
    }

    const normalizedBatchStartedAt =
      Number(
        batchStartedAt
      );

    const normalizedBatchEndedAt =
      Number(
        batchEndedAt
      );

    const normalizedReadingCount =
      Number(
        readingCount
      );

    if (
      !Number.isInteger(
        normalizedBatchStartedAt
      ) ||
      !Number.isInteger(
        normalizedBatchEndedAt
      )
    ) {
      throw new Error(
        'Invalid batch timestamp'
      );
    }

    if (
      normalizedBatchStartedAt <
      1700000000 ||
      normalizedBatchEndedAt <
      1700000000
    ) {
      throw new Error(
        'Invalid batch timestamp'
      );
    }

    if (
      !Number.isInteger(
        normalizedReadingCount
      ) ||
      normalizedReadingCount < 1
    ) {
      throw new Error(
        'Invalid readingCount'
      );
    }

    const txId =
      ctx.stub.getTxID();

    const txTimestamp =
      ctx.stub.getTxTimestamp();

    const proof = {
      schema:
        'trustiot.fabric.proof.v1',

      proofSha256,

      artifact,

      deviceId,

      sensor:
        sensor || null,

      batchStartedAt:
        normalizedBatchStartedAt,

      batchEndedAt:
        normalizedBatchEndedAt,

      readingCount:
        normalizedReadingCount,

      payloadSha256,

      fileSha256,

      pieceCid,

      storageNetwork:
        storageNetwork || null,

      storageState:
        storageState || null,

      storageVerified:
        true,

      fabric: {
        txId,

        recordedAt: {
          seconds:
            Number(
              txTimestamp.seconds
            ),

          nanos:
            Number(
              txTimestamp.nanos
            )
        }
      }
    };

    await ctx.stub.putState(
      proofSha256,
      Buffer.from(
        JSON.stringify(
          proof
        )
      )
    );

    ctx.stub.setEvent(
      'TrustIoTProofRegistered',
      Buffer.from(
        JSON.stringify({
          proofSha256,
          deviceId,
          pieceCid,
          txId
        })
      )
    );

    return JSON.stringify(
      proof
    );
  }


  async GetProof(
    ctx,
    proofSha256
  ) {
    if (!proofSha256) {
      throw new Error(
        'proofSha256 is required'
      );
    }

    const data =
      await ctx.stub.getState(
        proofSha256
      );

    if (
      !data ||
      data.length === 0
    ) {
      throw new Error(
        `Proof does not exist: ${proofSha256}`
      );
    }

    return data.toString(
      'utf8'
    );
  }
}


module.exports.contracts = [
  TrustIoTProofContract
];
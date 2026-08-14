'use strict';

const { Contract } = require('fabric-contract-api');

class TrustIoTContract extends Contract {
  async DatasetExists(ctx, datasetId) {
    const data = await ctx.stub.getState(datasetId);
    return data && data.length > 0;
  }

async RegisterDataset(
  ctx,
  datasetId,
  deviceId,
  ownerOrg,
  cid,
  storageRef,
  ciphertextSha256,
  startedAt,
  endedAt,
  readingCount,
  schemaVersion,
  signerId,
  signedAt,
  nonce,
  signature,
  signatureAlgorithm,
  storageDriver,
  encryption,
  createdAt
) {
  if (await this.DatasetExists(ctx, datasetId)) {
    throw new Error(
      `Dataset ${datasetId} already exists`
    );
  }
  if (!signerId || !nonce) {
  throw new Error(
    'signerId and nonce are required'
  );
}

const nonceKey =
  ctx.stub.createCompositeKey(
    'trustiotNonce',
    [
      signerId,
      nonce
    ]
  );

const existingNonce =
  await ctx.stub.getState(
    nonceKey
  );

if (
  existingNonce &&
  existingNonce.length > 0
) {
  throw new Error(
    `Replay detected: nonce already used for signer ${signerId}`
  );
}

  const record = {
    docType: 'trustiotDataset',

    datasetId,
    deviceId,
    ownerOrg,

    cid: cid || null,
    storageRef,
    storageDriver:
      storageDriver || null,

    ciphertextSha256,

    startedAt,
    endedAt,

    readingCount:
      Number(readingCount),

    encryption:
      encryption || null,

    schemaVersion,

    createdAt:
      createdAt || null,

    signerId:
      signerId || null,

    signedAt:
      signedAt || null,

    nonce:
      nonce || null,

    signature:
      signature || null,

    signatureAlgorithm:
      signatureAlgorithm || null,

    verificationStatus:
      'UNVERIFIED'
  };

  await ctx.stub.putState(
    datasetId,
    Buffer.from(
      JSON.stringify(record)
    )
  );
const txTimestamp =
  ctx.stub.getTxTimestamp();

const nonceRecord = {
  docType: 'trustiotNonce',
  signerId,
  nonce,
  datasetId,
  transactionId:
    ctx.stub.getTxID(),
  consumedAtSeconds:
    txTimestamp.seconds.toString()
};

await ctx.stub.putState(
  nonceKey,
  Buffer.from(
    JSON.stringify(nonceRecord)
  )
);
  return JSON.stringify(record);
}
  

  async ReadDataset(ctx, datasetId) {
    const data = await ctx.stub.getState(datasetId);
    if (!data || data.length === 0) {
      throw new Error(`Dataset ${datasetId} does not exist`);
    }
    return data.toString();
  }

  async SetVerificationStatus(ctx, datasetId, status) {
    const allowed = new Set(['UNVERIFIED', 'VERIFIED', 'REJECTED']);
    if (!allowed.has(status)) throw new Error(`Invalid verification status: ${status}`);

    const record = JSON.parse(await this.ReadDataset(ctx, datasetId));
    record.verificationStatus = status;
    await ctx.stub.putState(datasetId, Buffer.from(JSON.stringify(record)));
    return JSON.stringify(record);
  }
}

module.exports = TrustIoTContract;

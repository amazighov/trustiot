import {
  createHash
} from 'node:crypto';


export function createProofRecord({
  artifact,
  deviceId,
  sensor,
  batchStartedAt,
  batchEndedAt,
  readingCount,
  payloadSha256,
  fileSha256,
  pieceCid,
  network,
  storageVerified,
  storageState
}) {
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

  const proofPayload = {
    schema:
      'trustiot.proof.v1',

    artifact,

    deviceId,

    sensor,

    batchStartedAt,

    batchEndedAt,

    readingCount,

    payloadSha256,

    fileSha256,

    storage: {
      driver:
        'synapse',

      network,

      pieceCid,

      storageVerified:
        Boolean(
          storageVerified
        ),

      storageState
    }
  };

  const canonical =
    JSON.stringify(
      proofPayload
    );

  const proofSha256 =
    createHash(
      'sha256'
    )
      .update(
        canonical
      )
      .digest(
        'hex'
      );

  return {
    ...proofPayload,

    proofSha256
  };
}

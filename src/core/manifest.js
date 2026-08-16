export function buildPublicManifest(
  batch,
  storageReceipt,
  ciphertextSha256
) {
  return {
    datasetId:
      batch.datasetId,

    deviceId:
      batch.deviceId,

    ownerOrg:
      batch.ownerOrg,

    // Generic storage fields
    storageDriver:
      storageReceipt.driver,

    storageNetwork:
      storageReceipt.network ?? null,

    storageRef:
      storageReceipt.ref,

    // IPFS-compatible identifier when available
    cid:
      storageReceipt.cid ?? null,

    // Synapse / PDP primary identifier
    pieceCid:
      storageReceipt.pieceCid ?? null,

    // Filecoin Pin / IPFS root when available
    ipfsRootCid:
      storageReceipt.ipfsRootCid ??
      storageReceipt.cid ??
      null,

    ciphertextSha256,

    startedAt:
      batch.startedAt,

    endedAt:
      batch.endedAt,

    readingCount:
      batch.readingCount,

    encryption:
      'AES-256-GCM',

    schemaVersion:
      batch.schemaVersion,

    createdAt:
      new Date().toISOString(),

    verificationStatus:
      'UNVERIFIED'
  };
}
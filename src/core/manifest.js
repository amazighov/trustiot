export function buildPublicManifest(batch, storageReceipt, ciphertextSha256) {
  return {
    datasetId: batch.datasetId,
    deviceId: batch.deviceId,
    ownerOrg: batch.ownerOrg,
    cid: storageReceipt.cid ?? null,
    storageRef: storageReceipt.ref,
    storageDriver: storageReceipt.driver,
    ciphertextSha256,
    startedAt: batch.startedAt,
    endedAt: batch.endedAt,
    readingCount: batch.readingCount,
    encryption: 'AES-256-GCM',
    schemaVersion: batch.schemaVersion,
    createdAt: new Date().toISOString(),
    verificationStatus: 'UNVERIFIED'
  };
}

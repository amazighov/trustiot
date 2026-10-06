import { createWmcBatchCommitment } from "../wmcCommitment.js";

function check(name, expected, actual) {
  return { name, expected, actual, ok: expected === actual };
}

export async function verifyWmcCommitment(batch, adapter) {
  try {
    const local = createWmcBatchCommitment(batch);
    const [device, onChain] = await Promise.all([
      adapter.getDeviceByKey(local.deviceKey),
      adapter.getBatch(local.batchId),
    ]);

    const checks = [
      check("device.active", 1, device.status),
      check("batch.deviceId", local.deviceKey, onChain.deviceId),
      check("batch.commitment", local.commitment, onChain.commitment),
      check("batch.schemaHash", local.schemaHash, onChain.schemaHash),
      check("batch.startedAt", local.startedAt, onChain.startedAt),
      check("batch.endedAt", local.endedAt, onChain.endedAt),
      check("batch.readingCount", local.readingCount, onChain.readingCount),
    ];

    return {
      ok: checks.every((item) => item.ok),
      deviceId: local.deviceId,
      deviceKey: local.deviceKey,
      batchId: local.batchId,
      commitment: local.commitment,
      submitter: onChain.submitter,
      committedAt: onChain.committedAt,
      checks,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      checks: [],
    };
  }
}

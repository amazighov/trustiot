import test from "node:test";
import assert from "node:assert/strict";
import { createWmcBatchCommitment } from "../src/core/wmcCommitment.js";
import { verifyWmcCommitment } from "../src/core/verification/verifyWmcCommitment.js";

const batch = {
  deviceId: "device-verify-001",
  batchStartedAt: "2026-10-04T12:00:00.000Z",
  batchEndedAt: "2026-10-04T12:00:30.000Z",
  readings: [{ value: 10 }],
};

function adapterFor(status = 1, overrides = {}) {
  const local = createWmcBatchCommitment(batch);
  return {
    async getDeviceByKey() { return { status }; },
    async getBatch() {
      return {
        deviceId: local.deviceKey,
        commitment: local.commitment,
        schemaHash: local.schemaHash,
        submitter: `0x${"1".repeat(40)}`,
        startedAt: local.startedAt,
        endedAt: local.endedAt,
        committedAt: local.endedAt + 1,
        readingCount: local.readingCount,
        ...overrides,
      };
    },
  };
}

test("verifies active device identity and all on-chain commitment fields", async () => {
  const result = await verifyWmcCommitment(batch, adapterFor());
  assert.equal(result.ok, true);
  assert.equal(result.checks.every((item) => item.ok), true);
});

test("fails verification for a revoked device", async () => {
  const result = await verifyWmcCommitment(batch, adapterFor(2));
  assert.equal(result.ok, false);
  assert.equal(result.checks.find((item) => item.name === "device.active").ok, false);
});

test("fails verification when an on-chain commitment differs", async () => {
  const result = await verifyWmcCommitment(
    batch,
    adapterFor(1, { commitment: `0x${"f".repeat(64)}` }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.checks.find((item) => item.name === "batch.commitment").ok, false);
});

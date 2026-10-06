import test from "node:test";
import assert from "node:assert/strict";
import { keccak256Hex } from "../src/core/keccak256.js";
import {
  createWmcBatchCommitment,
  deviceIdToBytes32,
  fingerprintDeviceKey,
} from "../src/core/wmcCommitment.js";

const sample = {
  schema: "trustiot.sensor.batch.v1",
  deviceId: "device-001",
  batchStartedAt: "2026-10-04T12:00:00.000Z",
  batchEndedAt: "2026-10-04T12:00:10.000Z",
  readingCount: 2,
  readings: [
    { timestamp: "2026-10-04T12:00:00.000Z", value: 10 },
    { timestamp: "2026-10-04T12:00:10.000Z", value: 11 },
  ],
};

test("implements Ethereum Keccak-256 rather than NIST SHA3-256", () => {
  assert.equal(
    keccak256Hex(""),
    "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
  );
  assert.equal(
    keccak256Hex("hello"),
    "0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8",
  );
});

test("creates deterministic EVM-compatible commitment metadata", () => {
  const first = createWmcBatchCommitment(sample);
  const reordered = createWmcBatchCommitment({
    readings: sample.readings,
    readingCount: 2,
    batchEndedAt: sample.batchEndedAt,
    batchStartedAt: sample.batchStartedAt,
    deviceId: sample.deviceId,
    schema: sample.schema,
  });

  assert.deepEqual(first, reordered);
  assert.equal(first.deviceKey, deviceIdToBytes32("device-001"));
  assert.match(first.batchId, /^0x[0-9a-f]{64}$/);
  assert.equal(first.readingCount, 2);
  assert.equal("readings" in first, false);
});

test("detects telemetry mutation and validates batch boundaries", () => {
  const original = createWmcBatchCommitment(sample);
  const changed = structuredClone(sample);
  changed.readings[1].value = 99;
  const mutated = createWmcBatchCommitment(changed);
  assert.notEqual(original.commitment, mutated.commitment);
  assert.notEqual(original.batchId, mutated.batchId);

  assert.throws(
    () => createWmcBatchCommitment({ ...sample, readingCount: 3 }),
    /does not match/,
  );
});

test("keeps WMC commitments independent from storage and SHA-256 metadata", () => {
  const baseline = createWmcBatchCommitment(sample);
  const withStorageFields = createWmcBatchCommitment({
    ...sample,
    sha256: "legacy-storage-digest",
    cid: "bafy-filecoin-reference",
    storage: { provider: "not-part-of-wmc" },
    oort: { objectId: "excluded" },
  });
  assert.equal(withStorageFields.commitment, baseline.commitment);
  assert.equal(withStorageFields.batchId, baseline.batchId);
});

test("device public key fingerprint is deterministic and fixed-size", () => {
  assert.match(fingerprintDeviceKey("-----BEGIN PUBLIC KEY-----demo"), /^0x[0-9a-f]{64}$/);
});

test("accepts Unix-second timestamps produced by the physical-device receiver", () => {
  const physicalBatch = {
    schema: "trustiot.sensor.batch.v1",
    deviceId: "esp32-01",
    batchStartedAt: 1791234456,
    batchEndedAt: 1791234774,
    readingCount: 2,
    readings: [
      { timestamp: 1791234456, temperature: 29.39 },
      { timestamp: 1791234774, temperature: 29.51 },
    ],
    sha256: "storage-only-digest",
  };

  const result = createWmcBatchCommitment(physicalBatch);
  assert.equal(result.startedAt, 1791234456);
  assert.equal(result.endedAt, 1791234774);
  assert.equal(result.readingCount, 2);
  assert.match(result.commitment, /^0x[0-9a-f]{64}$/);
});

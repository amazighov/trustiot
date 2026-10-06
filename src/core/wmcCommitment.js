import { keccak256Hex } from "./keccak256.js";

export const WMC_COMMITMENT_SCHEMA = "trustiot.wmc.telemetry-commitment.v1";

const STORAGE_ONLY_FIELDS = new Set([
  "sha256",
  "cid",
  "pieceCid",
  "storage",
  "storageRef",
  "filecoin",
  "oort",
  "encryption",
]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function telemetryPayload(batch) {
  return Object.fromEntries(
    Object.entries(batch).filter(([key]) => !STORAGE_ONLY_FIELDS.has(key)),
  );
}

function requiredText(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} is required`);
  }
  return value.trim();
}

function timestampSeconds(value, label) {
  if (
    Number.isSafeInteger(value) &&
    value >= 0
  ) {
    return value;
  }

  const milliseconds = Date.parse(requiredText(value, label));
  if (!Number.isFinite(milliseconds)) throw new Error(`${label} must be an ISO-8601 timestamp`);
  return Math.floor(milliseconds / 1000);
}

function readingCount(batch) {
  if (batch.readingCount !== undefined
      && (!Number.isSafeInteger(batch.readingCount) || batch.readingCount <= 0)) {
    throw new Error("readingCount must be a positive integer");
  }
  if (Array.isArray(batch.readings) && batch.readings.length > 0) return batch.readings.length;
  if (Number.isSafeInteger(batch.readingCount) && batch.readingCount > 0) {
    return batch.readingCount;
  }
  throw new Error("batch must include non-empty readings or a positive readingCount");
}

export function assertBytes32(value, label = "value") {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${label} must be a 32-byte 0x-prefixed hex value`);
  }
  return value.toLowerCase();
}

export function deviceIdToBytes32(deviceId) {
  return keccak256Hex(`trustiot.wmc.device.v1\n${requiredText(deviceId, "deviceId")}`);
}

export function fingerprintDeviceKey(publicKey) {
  return keccak256Hex(`trustiot.wmc.device-key.v1\n${requiredText(publicKey, "publicKey")}`);
}

export function metadataToBytes32(metadata) {
  if (metadata === undefined || metadata === null || metadata === "") {
    return `0x${"0".repeat(64)}`;
  }
  return keccak256Hex(
    `trustiot.wmc.device-metadata.v1\n${JSON.stringify(canonicalize(metadata))}`,
  );
}

/**
 * Produce the only payload TrustIoT writes to WMC: fixed-size commitment
 * metadata. Raw readings remain off-chain and are never returned here.
 */
export function createWmcBatchCommitment(batch) {
  if (!batch || typeof batch !== "object" || Array.isArray(batch)) {
    throw new Error("batch must be an object");
  }

  const deviceId = requiredText(batch.deviceId, "deviceId");
  const startedAt = timestampSeconds(batch.batchStartedAt, "batchStartedAt");
  const endedAt = timestampSeconds(batch.batchEndedAt, "batchEndedAt");
  if (startedAt > endedAt) throw new Error("batchStartedAt must not be after batchEndedAt");

  const count = readingCount(batch);
  if (count > 0xffffffff) throw new Error("readingCount exceeds the WMC uint32 limit");
  if (Number.isSafeInteger(batch.readingCount) && batch.readingCount !== count) {
    throw new Error("readingCount does not match readings.length");
  }

  // WMC is an independent integrity/provenance path. Filecoin/OORT storage
  // fields and legacy SHA-256 metadata do not affect this commitment.
  const canonicalBatch = JSON.stringify(canonicalize(telemetryPayload(batch)));
  const commitment = keccak256Hex(`${WMC_COMMITMENT_SCHEMA}\n${canonicalBatch}`);
  const deviceKey = deviceIdToBytes32(deviceId);
  const schemaHash = keccak256Hex(WMC_COMMITMENT_SCHEMA);
  const batchId = keccak256Hex([
    WMC_COMMITMENT_SCHEMA,
    deviceKey,
    String(startedAt),
    String(endedAt),
    String(count),
    commitment,
  ].join("\n"));

  return {
    schema: WMC_COMMITMENT_SCHEMA,
    deviceId,
    deviceKey,
    batchId,
    commitment,
    schemaHash,
    startedAt,
    endedAt,
    readingCount: count,
  };
}

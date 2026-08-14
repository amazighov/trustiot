import { createHash, randomUUID } from 'node:crypto';

export function canonicalNdjson(readings) {
  if (!Array.isArray(readings) || readings.length === 0) {
    throw new Error('readings must be a non-empty array');
  }

  for (const r of readings) {
    validateReading(r);
  }

  return Buffer.from(readings.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
}

export function createBatch(readings, ownerOrg = 'FarmOrg') {
  const body = canonicalNdjson(readings);
  const first = readings[0];
  const last = readings[readings.length - 1];

  return {
    datasetId: randomUUID(),
    ownerOrg,
    deviceId: first.deviceId,
    startedAt: first.timestamp,
    endedAt: last.timestamp,
    readingCount: readings.length,
    schemaVersion: 'trustiot.batch.v1',
    plaintextSha256: createHash('sha256').update(body).digest('hex'),
    body
  };
}

function validateReading(r) {
  const required = ['deviceId', 'timestamp', 'type', 'value', 'unit', 'sequence'];
  for (const field of required) {
    if (r[field] === undefined || r[field] === null) {
      throw new Error(`missing reading field: ${field}`);
    }
  }
  if (!Number.isFinite(r.value)) throw new Error('reading value must be finite');
  if (!Number.isInteger(r.sequence) || r.sequence < 0) {
    throw new Error('sequence must be a non-negative integer');
  }
  if (Number.isNaN(Date.parse(r.timestamp))) {
    throw new Error('timestamp must be ISO-compatible');
  }
}

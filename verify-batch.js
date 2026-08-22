import fs from 'fs';
import crypto from 'crypto';

const file =
  'artifacts/batches/esp32-01-batch-1787354841-1787354888-ac3ca9fcaa74.json';

const artifact =
  JSON.parse(fs.readFileSync(file, 'utf8'));

const batchPayload = {
  deviceId: artifact.deviceId,
  sensor: artifact.sensor,
  batchStartedAt: artifact.batchStartedAt,
  batchEndedAt: artifact.batchEndedAt,
  readingCount: artifact.readingCount,
  readings: artifact.readings
};

const calculated =
  crypto
    .createHash('sha256')
    .update(JSON.stringify(batchPayload))
    .digest('hex');

console.log('stored:    ', artifact.sha256);
console.log('calculated:', calculated);
console.log('verified:  ', artifact.sha256 === calculated);

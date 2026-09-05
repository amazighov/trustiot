import { spawn } from 'child_process';
import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const PORT = 3000;
const BATCH_SIZE = 60;

const batchesDir = path.resolve('./artifacts/batches');

fs.mkdirSync(batchesDir, { recursive: true });

let readings = [];
const processingQueue = [];
let processingBatch = false;

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 30000;

function enqueueBatch(filePath, attempt = 0) {
  processingQueue.push({
    filePath,
    attempt
  });

  console.log(
    'Batch queued for Synapse:',
    path.basename(filePath),
    `attempt=${attempt + 1}`
  );

  processNextBatch();
}
function canonicalReading(reading) {
  return {
    deviceId: reading.deviceId,
    sensor: reading.sensor,
    temperature: reading.temperature,
    humidity: reading.humidity,
    pressure: reading.pressure,
    timestamp: reading.timestamp
  };
}

function createBatch() {
  const first = readings[0];
  const last = readings[readings.length - 1];

  const batchPayload = {
    deviceId: first.deviceId,
    sensor: first.sensor,
    batchStartedAt: first.timestamp,
    batchEndedAt: last.timestamp,
    readingCount: readings.length,
    readings
  };

  const canonicalPayload =
    JSON.stringify(batchPayload);

  const sha256 =
    crypto
      .createHash('sha256')
      .update(canonicalPayload)
      .digest('hex');

  const artifact = {
    schema: 'trustiot.sensor.batch.v1',
    createdAt: new Date().toISOString(),
    ...batchPayload,
    sha256
  };

  const filename =
    `${first.deviceId}-batch-${first.timestamp}-${last.timestamp}-${sha256.slice(0, 12)}.json`;

  const filepath =
    path.join(
      batchesDir,
      filename
    );

  fs.writeFileSync(
    filepath,
    JSON.stringify(artifact, null, 2)
  );

  console.log('\n================================');
  console.log('TrustIoT batch created');
  console.log('File:', filename);
  console.log('Readings:', artifact.readingCount);
  console.log('SHA-256:', sha256);
  console.log('================================\n');

  enqueueBatch(filepath);

  readings = [];

  return {
    filename,
    sha256
  };
}



function processNextBatch() {
  if (processingBatch) {
    return;
  }

  const job = processingQueue.shift();

  if (!job) {
    return;
  }

  const {
    filePath,
    attempt
  } = job;

  processingBatch = true;

  console.log('\n================================');
  console.log('Starting automatic Synapse processing');
  console.log('Batch:', path.basename(filePath));
  console.log('Attempt:', attempt + 1);
  console.log('Queue remaining:', processingQueue.length);
  console.log('================================\n');

  const child = spawn(
    process.execPath,
    [
      'src/synapse-batch-test.js',
      filePath
    ],
    {
      stdio: 'inherit',
      env: process.env
    }
  );

  child.on('error', error => {
    console.error(
      'Batch processor failed to start:',
      error.message
    );

    processingBatch = false;

    retryOrContinue(
      filePath,
      attempt
    );
  });

  child.on('exit', code => {
    processingBatch = false;

    if (code === 0) {
      console.log(
        '\nBatch processing completed successfully:',
        path.basename(filePath)
      );

      processNextBatch();
      return;
    }

    if (code === 75) {
      console.error(
        '\nSynapse stored the batch but on-chain commit failed:',
        path.basename(filePath)
      );

      console.error(
        'This is retryable. Scheduling another attempt.'
      );

      retryOrContinue(
        filePath,
        attempt
      );

      return;
    }

    console.error(
      '\nBatch processing failed:',
      path.basename(filePath),
      'exit code:',
      code
    );

    retryOrContinue(
      filePath,
      attempt
    );
  });
}


function retryOrContinue(
  filePath,
  attempt
) {
  const nextAttempt =
    attempt + 1;

  if (nextAttempt >= MAX_RETRIES) {
    console.error(
      'Maximum retries reached:',
      path.basename(filePath)
    );

    processNextBatch();
    return;
  }

  const delay =
    RETRY_DELAY_MS *
    Math.pow(2, attempt);

  console.log(
    `Retry scheduled in ${delay / 1000}s:`,
    path.basename(filePath)
  );

  setTimeout(() => {
    processingQueue.unshift({
      filePath,
      attempt: nextAttempt
    });

    processNextBatch();
  }, delay);
}
const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/sensor') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  let body = '';

  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', () => {
    try {
      const input = JSON.parse(body);

      const requiredFields = [
        'deviceId',
        'sensor',
        'temperature',
        'humidity',
        'pressure',
        'timestamp'
      ];

      for (const field of requiredFields) {
        if (!(field in input)) {
          throw new Error(`Missing field: ${field}`);
        }
      }

      const reading = canonicalReading(input);
if (
  !Number.isInteger(reading.timestamp) ||
  reading.timestamp < 1700000000
) {
  throw new Error(
    `Invalid timestamp: ${reading.timestamp}`
  );
}
      readings.push(reading);

      console.log(
        `[${readings.length}/${BATCH_SIZE}]`,
        reading.deviceId,
        `T=${reading.temperature}`,
        `H=${reading.humidity}`,
        `P=${reading.pressure}`,
        `timestamp=${reading.timestamp}`
      );

      let batch = null;

      if (readings.length >= BATCH_SIZE) {
        batch = createBatch();
      }

      res.writeHead(200, {
        'Content-Type': 'application/json'
      });

      res.end(
        JSON.stringify({
          ok: true,
          buffered: readings.length,
          batchCreated: batch !== null,
          batch
        })
      );

    } catch (error) {
      console.error(
        'Invalid payload:',
        error.message
      );

      res.writeHead(400, {
        'Content-Type': 'application/json'
      });

      res.end(
        JSON.stringify({
          ok: false,
          error: error.message
        })
      );
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(
    `TrustIoT batching receiver listening on port ${PORT}`
  );

  console.log(
    `Batch size: ${BATCH_SIZE} readings`
  );
});
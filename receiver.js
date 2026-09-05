import {
  PersistentRetryQueue
} from './src/private/retryQueue.js';

import { spawn } from 'child_process';
import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';


// ----------------------------------------------------
// Configuration
// ----------------------------------------------------

const PORT = 3000;
const BATCH_SIZE = 60;

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 30000;

const batchesDir =
  path.resolve('./artifacts/batches');

fs.mkdirSync(
  batchesDir,
  {
    recursive: true
  }
);


// ----------------------------------------------------
// Private persistent retry queue
// ----------------------------------------------------

const persistentQueue =
  new PersistentRetryQueue();


// ----------------------------------------------------
// Runtime state
// ----------------------------------------------------

let readings = [];

const processingQueue = [];

let processingBatch = false;


// ----------------------------------------------------
// Canonical reading
// ----------------------------------------------------

function canonicalReading(reading) {
  return {
    deviceId:
      reading.deviceId,

    sensor:
      reading.sensor,

    temperature:
      reading.temperature,

    humidity:
      reading.humidity,

    pressure:
      reading.pressure,

    timestamp:
      reading.timestamp
  };
}


// ----------------------------------------------------
// Queue a new batch
// ----------------------------------------------------

function enqueueBatch(
  filePath,
  attempt = 0
) {
  const persistentJob =
    persistentQueue.enqueue(
      filePath,
      attempt
    );

  processingQueue.push({
    filePath,
    attempt,
    jobId:
      persistentJob.id
  });

  console.log(
    'Persisted queue job:',
    persistentJob.id
  );

  console.log(
    'Batch queued for Synapse:',
    path.basename(filePath),
    `attempt=${attempt + 1}`
  );

  processNextBatch();
}


// ----------------------------------------------------
// Create TrustIoT batch
// ----------------------------------------------------

function createBatch() {
  if (readings.length === 0) {
    throw new Error(
      'Cannot create empty batch'
    );
  }

  const first =
    readings[0];

  const last =
    readings[
      readings.length - 1
    ];

  const batchReadings =
    readings.map(
      reading => ({
        ...reading
      })
    );

  const batchPayload = {
    deviceId:
      first.deviceId,

    sensor:
      first.sensor,

    batchStartedAt:
      first.timestamp,

    batchEndedAt:
      last.timestamp,

    readingCount:
      batchReadings.length,

    readings:
      batchReadings
  };

  const canonicalPayload =
    JSON.stringify(
      batchPayload
    );

  const sha256 =
    crypto
      .createHash('sha256')
      .update(
        canonicalPayload
      )
      .digest('hex');

  const artifact = {
    schema:
      'trustiot.sensor.batch.v1',

    createdAt:
      new Date().toISOString(),

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
    JSON.stringify(
      artifact,
      null,
      2
    )
  );

  console.log(
    '\n================================'
  );

  console.log(
    'TrustIoT batch created'
  );

  console.log(
    'File:',
    filename
  );

  console.log(
    'Readings:',
    artifact.readingCount
  );

  console.log(
    'SHA-256:',
    sha256
  );

  console.log(
    '================================\n'
  );

  // Artifact is already safely on disk.
  readings = [];

  enqueueBatch(
    filepath
  );

  return {
    filename,
    sha256
  };
}


// ----------------------------------------------------
// Process next Synapse job
// ----------------------------------------------------

function processNextBatch() {
  if (processingBatch) {
    return;
  }

  const job =
    processingQueue.shift();

  if (!job) {
    return;
  }

  const {
    filePath,
    attempt,
    jobId
  } = job;

  if (
    !fs.existsSync(
      filePath
    )
  ) {
    console.error(
      'Batch artifact missing:',
      filePath
    );

    persistentQueue.markFailed(
      jobId,
      'Batch artifact missing'
    );

    processNextBatch();
    return;
  }

  processingBatch = true;

  persistentQueue.markProcessing(
    jobId
  );

  console.log(
    '\n================================'
  );

  console.log(
    'Starting automatic Synapse processing'
  );

  console.log(
    'Batch:',
    path.basename(filePath)
  );

  console.log(
    'Attempt:',
    attempt + 1
  );

  console.log(
    'Queue remaining:',
    processingQueue.length
  );

  console.log(
    '================================\n'
  );

  const child =
    spawn(
      process.execPath,
      [
        'src/synapse-batch-test.js',
        filePath
      ],
      {
        stdio:
          'inherit',

        env:
          process.env
      }
    );

  child.on(
    'error',
    error => {
      console.error(
        'Batch processor failed to start:',
        error.message
      );

      processingBatch =
        false;

      retryOrContinue(
        filePath,
        attempt,
        jobId,
        error.message
      );
    }
  );

  child.on(
    'exit',
    code => {
      processingBatch =
        false;

      // ----------------------------------------------
      // Success
      // ----------------------------------------------

      if (code === 0) {
        persistentQueue.markSuccess(
          jobId
        );

        console.log(
          '\nBatch processing completed successfully:',
          path.basename(filePath)
        );

        processNextBatch();

        return;
      }

      // ----------------------------------------------
      // Synapse stored, but commit failed
      // ----------------------------------------------

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
          attempt,
          jobId,
          'STORED_NOT_COMMITTED'
        );

        return;
      }

      // ----------------------------------------------
      // Generic failure
      // ----------------------------------------------

      console.error(
        '\nBatch processing failed:',
        path.basename(filePath),
        'exit code:',
        code
      );

      retryOrContinue(
        filePath,
        attempt,
        jobId,
        `exit code ${code}`
      );
    }
  );
}


// ----------------------------------------------------
// Retry with exponential backoff
// ----------------------------------------------------

function retryOrContinue(
  filePath,
  attempt,
  jobId,
  errorMessage = null
) {
  const nextAttempt =
    attempt + 1;

  if (
    nextAttempt >=
    MAX_RETRIES
  ) {
    persistentQueue.markFailed(
      jobId,
      errorMessage ??
      'Maximum retries reached'
    );

    console.error(
      'Maximum retries reached:',
      path.basename(filePath)
    );

    processNextBatch();

    return;
  }

  const delay =
    RETRY_DELAY_MS *
    Math.pow(
      2,
      attempt
    );

  persistentQueue.scheduleRetry(
    jobId,
    {
      attempt:
        nextAttempt,

      delayMs:
        delay,

      error:
        errorMessage
    }
  );

  console.log(
    `Retry scheduled in ${delay / 1000}s:`,
    path.basename(filePath)
  );

  setTimeout(
    () => {
      processingQueue.unshift({
        filePath,

        attempt:
          nextAttempt,

        jobId
      });

      processNextBatch();
    },
    delay
  );
}


// ----------------------------------------------------
// Startup recovery
// ----------------------------------------------------

function recoverPersistentJobs() {
  const jobs =
    persistentQueue
      .recoverPending();

  if (jobs.length === 0) {
    console.log(
      'No persistent queue jobs to recover'
    );

    return;
  }

  console.log(
    `Recovering ${jobs.length} persistent queue job(s)`
  );

  for (const job of jobs) {
    if (
      !fs.existsSync(
        job.filePath
      )
    ) {
      console.error(
        'Missing batch artifact during recovery:',
        job.filePath
      );

      persistentQueue.markFailed(
        job.id,
        'Batch artifact missing during startup recovery'
      );

      continue;
    }

    processingQueue.push({
      filePath:
        job.filePath,

      attempt:
        job.attempt ?? 0,

      jobId:
        job.id
    });

    console.log(
      'Recovered:',
      job.id,
      `previousStatus=${job.status}`,
      `attempt=${(job.attempt ?? 0) + 1}`
    );
  }

  processNextBatch();
}


// ----------------------------------------------------
// HTTP receiver
// ----------------------------------------------------

const server =
  http.createServer(
    (req, res) => {
      if (
        req.method !== 'POST' ||
        req.url !== '/sensor'
      ) {
        res.writeHead(
          404,
          {
            'Content-Type':
              'application/json'
          }
        );

        res.end(
          JSON.stringify({
            ok: false,
            error: 'Not found'
          })
        );

        return;
      }

      let body = '';

      req.on(
        'data',
        chunk => {
          body += chunk;
        }
      );

      req.on(
        'end',
        () => {
          try {
            const input =
              JSON.parse(body);

            const requiredFields = [
              'deviceId',
              'sensor',
              'temperature',
              'humidity',
              'pressure',
              'timestamp'
            ];

            for (
              const field
              of requiredFields
            ) {
              if (
                !(field in input)
              ) {
                throw new Error(
                  `Missing field: ${field}`
                );
              }
            }

            const reading =
              canonicalReading(
                input
              );

            // ----------------------------------------
            // Validate timestamp
            // ----------------------------------------

            if (
              !Number.isInteger(
                reading.timestamp
              ) ||
              reading.timestamp <
                1700000000
            ) {
              throw new Error(
                `Invalid timestamp: ${reading.timestamp}`
              );
            }

            // ----------------------------------------
            // Basic numeric validation
            // ----------------------------------------

            if (
              !Number.isFinite(
                reading.temperature
              ) ||
              !Number.isFinite(
                reading.humidity
              ) ||
              !Number.isFinite(
                reading.pressure
              )
            ) {
              throw new Error(
                'Invalid sensor numeric value'
              );
            }

            readings.push(
              reading
            );

            console.log(
              `[${readings.length}/${BATCH_SIZE}]`,
              reading.deviceId,
              `T=${reading.temperature}`,
              `H=${reading.humidity}`,
              `P=${reading.pressure}`,
              `timestamp=${reading.timestamp}`
            );

            let batch =
              null;

            if (
              readings.length >=
              BATCH_SIZE
            ) {
              batch =
                createBatch();
            }

            res.writeHead(
              200,
              {
                'Content-Type':
                  'application/json'
              }
            );

            res.end(
              JSON.stringify({
                ok:
                  true,

                buffered:
                  readings.length,

                batchCreated:
                  batch !== null,

                batch
              })
            );

          } catch (error) {
            console.error(
              'Invalid payload:',
              error.message
            );

            res.writeHead(
              400,
              {
                'Content-Type':
                  'application/json'
              }
            );

            res.end(
              JSON.stringify({
                ok:
                  false,

                error:
                  error.message
              })
            );
          }
        }
      );
    }
  );


// ----------------------------------------------------
// Start receiver
// ----------------------------------------------------

server.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `TrustIoT batching receiver listening on port ${PORT}`
    );

    console.log(
      `Batch size: ${BATCH_SIZE} readings`
    );

    console.log(
      'Persistent private retry queue enabled'
    );

    recoverPersistentJobs();
  }
);
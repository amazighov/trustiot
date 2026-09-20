import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  PersistentRetryQueue
} from './src/private/retryQueue.js';


// ----------------------------------------------------
// Temporary isolated queue
// ----------------------------------------------------

const tempRoot =
  fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      'trustiot-queue-test-'
    )
  );

const queueDir =
  path.join(
    tempRoot,
    'queue'
  );

fs.mkdirSync(
  queueDir,
  {
    recursive: true
  }
);


console.log(
  'Temporary queue:',
  queueDir
);


// ----------------------------------------------------
// Queue instance
// ----------------------------------------------------

const queue =
  new PersistentRetryQueue({
    queueDir
  });


// ----------------------------------------------------
// Create valid artifact placeholders
// ----------------------------------------------------

const artifactA =
  path.join(
    tempRoot,
    'valid-a.json'
  );

const artifactB =
  path.join(
    tempRoot,
    'valid-b.json'
  );


fs.writeFileSync(
  artifactA,
  '{}',
  'utf8'
);

fs.writeFileSync(
  artifactB,
  '{}',
  'utf8'
);


// ----------------------------------------------------
// Create two valid jobs
// ----------------------------------------------------

const jobA =
  queue.enqueue(
    artifactA
  );

const jobB =
  queue.enqueue(
    artifactB
  );


console.log(
  'Created valid job:',
  jobA.id
);

console.log(
  'Created valid job:',
  jobB.id
);


// ----------------------------------------------------
// Corrupt one queue job deliberately
// ----------------------------------------------------

const corruptPath =
  path.join(
    queueDir,
    `${jobB.id}.json`
  );


fs.writeFileSync(
  corruptPath,
  Buffer.from([
    0xff,
    0x00,
    0x81,
    0x82,
    0x83
  ])
);


console.log(
  'Corrupted job:',
  jobB.id
);


// ----------------------------------------------------
// Recovery
//
// Expected:
// - corrupted job quarantined
// - valid job survives
// - no exception
// ----------------------------------------------------

let recovered;

try {
  recovered =
    queue.recoverPending();

} catch (error) {
  console.error(
    'TEST FAILED: recovery crashed'
  );

  console.error(
    error
  );

  process.exit(1);
}


// ----------------------------------------------------
// Assertions
// ----------------------------------------------------

const validRecovered =
  recovered.some(
    job =>
      job.id ===
      jobA.id
  );


const corruptRecovered =
  recovered.some(
    job =>
      job.id ===
      jobB.id
  );


const quarantineDir =
  path.join(
    queueDir,
    'quarantine'
  );


const quarantinedFiles =
  fs.existsSync(
    quarantineDir
  )
    ? fs.readdirSync(
        quarantineDir
      )
    : [];


const corruptQuarantined =
  quarantinedFiles.some(
    file =>
      file.includes(
        jobB.id
      )
  );


// ----------------------------------------------------
// Report
// ----------------------------------------------------

console.log();
console.log(
  'Valid job recovered:',
  validRecovered
);

console.log(
  'Corrupt job recovered:',
  corruptRecovered
);

console.log(
  'Corrupt job quarantined:',
  corruptQuarantined
);

console.log(
  'Recovered jobs:',
  recovered.length
);


// ----------------------------------------------------
// Final result
// ----------------------------------------------------

const passed =
  validRecovered &&
  !corruptRecovered &&
  corruptQuarantined;


if (!passed) {
  console.error();
  console.error(
    'Retry queue corruption test FAILED'
  );

  process.exitCode =
    2;

} else {
  console.log();
  console.log(
    'Retry queue corruption test PASSED'
  );
}


// ----------------------------------------------------
// Cleanup
// ----------------------------------------------------

fs.rmSync(
  tempRoot,
  {
    recursive: true,
    force: true
  }
);

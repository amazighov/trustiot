import fs from 'fs';
import path from 'path';
import crypto from 'crypto';


// ----------------------------------------------------
// Helpers
// ----------------------------------------------------

function fail(
  message,
  code = 1
) {
  console.error(
    `FAIL: ${message}`
  );

  process.exit(
    code
  );
}


function sha256Hex(
  value
) {
  return crypto
    .createHash(
      'sha256'
    )
    .update(
      value
    )
    .digest(
      'hex'
    );
}


// ----------------------------------------------------
// Input
// ----------------------------------------------------

const requestedPath =
  process.argv[2];

if (!requestedPath) {
  fail(
    'Usage: node src/verify.js <artifact.json>'
  );
}


const artifactPath =
  path.resolve(
    requestedPath
  );


if (
  !fs.existsSync(
    artifactPath
  )
) {
  fail(
    `Artifact not found: ${artifactPath}`
  );
}


// ----------------------------------------------------
// Load artifact
// ----------------------------------------------------

let artifact;

try {
  artifact =
    JSON.parse(
      fs.readFileSync(
        artifactPath,
        'utf8'
      )
    );

} catch (error) {
  fail(
    `Invalid artifact JSON: ${error.message}`
  );
}


// ----------------------------------------------------
// Schema
// ----------------------------------------------------

if (
  artifact.schema !==
  'trustiot.sensor.batch.v1'
) {
  fail(
    `Unsupported artifact schema: ${artifact.schema}`
  );
}


// ----------------------------------------------------
// Required top-level fields
// ----------------------------------------------------

const requiredFields = [
  'deviceId',
  'sensor',
  'batchStartedAt',
  'batchEndedAt',
  'readingCount',
  'readings',
  'sha256'
];


for (
  const field
  of requiredFields
) {
  if (
    !(field in artifact)
  ) {
    fail(
      `Missing artifact field: ${field}`
    );
  }
}


// ----------------------------------------------------
// Readings validation
// ----------------------------------------------------

if (
  !Array.isArray(
    artifact.readings
  )
) {
  fail(
    'Artifact readings must be an array'
  );
}


if (
  artifact.readings.length !==
  artifact.readingCount
) {
  fail(
    `readingCount mismatch: expected=${artifact.readingCount}, actual=${artifact.readings.length}`
  );
}


if (
  artifact.readingCount ===
  0
) {
  fail(
    'Artifact contains no readings'
  );
}


// ----------------------------------------------------
// Verify per-reading consistency
// ----------------------------------------------------

let previousSequence =
  null;

let previousTimestamp =
  null;


for (
  let index = 0;
  index < artifact.readings.length;
  index++
) {
  const reading =
    artifact.readings[
      index
    ];


  if (
    reading.deviceId !==
    artifact.deviceId
  ) {
    fail(
      `deviceId mismatch at reading ${index}`
    );
  }


  if (
    reading.sensor !==
    artifact.sensor
  ) {
    fail(
      `sensor mismatch at reading ${index}`
    );
  }


  if (
    !Number.isInteger(
      reading.timestamp
    )
  ) {
    fail(
      `Invalid timestamp at reading ${index}`
    );
  }


  if (
    !Number.isInteger(
      reading.sequence
    )
  ) {
    fail(
      `Invalid sequence at reading ${index}`
    );
  }


  if (
    previousSequence !==
      null &&
    reading.sequence <=
      previousSequence
  ) {
    fail(
      `Non-increasing sequence at reading ${index}: ${reading.sequence} <= ${previousSequence}`
    );
  }


  if (
    previousTimestamp !==
      null &&
    reading.timestamp <
      previousTimestamp
  ) {
    fail(
      `Timestamp moved backwards at reading ${index}`
    );
  }


  previousSequence =
    reading.sequence;

  previousTimestamp =
    reading.timestamp;
}


// ----------------------------------------------------
// Batch boundary verification
// ----------------------------------------------------

const firstReading =
  artifact.readings[0];

const lastReading =
  artifact.readings[
    artifact.readings.length - 1
  ];


if (
  artifact.batchStartedAt !==
  firstReading.timestamp
) {
  fail(
    `batchStartedAt mismatch: artifact=${artifact.batchStartedAt}, firstReading=${firstReading.timestamp}`
  );
}


if (
  artifact.batchEndedAt !==
  lastReading.timestamp
) {
  fail(
    `batchEndedAt mismatch: artifact=${artifact.batchEndedAt}, lastReading=${lastReading.timestamp}`
  );
}


// ----------------------------------------------------
// Rebuild canonical batch payload
//
// MUST match receiver.js createBatch()
// ----------------------------------------------------

const batchPayload = {
  deviceId:
    artifact.deviceId,

  sensor:
    artifact.sensor,

  batchStartedAt:
    artifact.batchStartedAt,

  batchEndedAt:
    artifact.batchEndedAt,

  readingCount:
    artifact.readingCount,

  readings:
    artifact.readings
};


const canonicalPayload =
  JSON.stringify(
    batchPayload
  );


const calculatedSha256 =
  sha256Hex(
    canonicalPayload
  );


const payloadVerified =
  calculatedSha256 ===
  artifact.sha256;


// ----------------------------------------------------
// Report
// ----------------------------------------------------

console.log(
  '\n================================'
);

console.log(
  'TrustIoT Independent Verifier'
);

console.log(
  '================================\n'
);


console.log(
  'Artifact:',
  path.basename(
    artifactPath
  )
);


console.log(
  'Schema:',
  artifact.schema
);


console.log(
  'Device:',
  artifact.deviceId
);


console.log(
  'Sensor:',
  artifact.sensor
);


console.log(
  'Readings:',
  artifact.readingCount
);


console.log(
  'Sequence range:',
  `${firstReading.sequence} -> ${lastReading.sequence}`
);


console.log(
  'Timestamp range:',
  `${artifact.batchStartedAt} -> ${artifact.batchEndedAt}`
);


console.log(
  '\nPayload SHA-256:'
);

console.log(
  artifact.sha256
);


console.log(
  'Calculated SHA-256:'
);

console.log(
  calculatedSha256
);


console.log(
  '\nArtifact integrity:',
  payloadVerified
    ? 'VERIFIED'
    : 'FAILED'
);


console.log(
  'Sequence integrity:',
  'VERIFIED'
);


console.log(
  'Batch consistency:',
  'VERIFIED'
);


// ----------------------------------------------------
// Overall result
// ----------------------------------------------------

const overallVerified =
  payloadVerified;


console.log(
  '\n--------------------------------'
);

console.log(
  'Overall:',
  overallVerified
    ? 'VERIFIED'
    : 'FAILED'
);

console.log(
  '--------------------------------\n'
);


if (
  !overallVerified
) {
  process.exitCode =
    2;
}

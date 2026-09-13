import {
  spawn
} from 'child_process';

import fs from 'fs';
import path from 'path';


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


function runVerifier(
  scriptPath,
  artifactPath
) {
  return new Promise(
    resolve => {
      const child =
        spawn(
          process.execPath,
          [
            scriptPath,
            artifactPath
          ],
          {
            stdio: [
              'ignore',
              'pipe',
              'pipe'
            ],

            env:
              process.env
          }
        );


      let stdout =
        '';

      let stderr =
        '';


      child.stdout.on(
        'data',
        chunk => {
          stdout +=
            chunk.toString();
        }
      );


      child.stderr.on(
        'data',
        chunk => {
          stderr +=
            chunk.toString();
        }
      );


      child.on(
        'error',
        error => {
          resolve({
            code:
              null,

            stdout,

            stderr,

            error
          });
        }
      );


      child.on(
        'exit',
        code => {
          resolve({
            code,

            stdout,

            stderr,

            error:
              null
          });
        }
      );
    }
  );
}


// ----------------------------------------------------
// Input
// ----------------------------------------------------

const requestedPath =
  process.argv[2];


if (!requestedPath) {
  fail(
    'Usage: node src/verify-trustiot.js <artifact.json>'
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
// Verify artifact JSON can be loaded
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
// Run batch verifier
// ----------------------------------------------------

const batchResult =
  await runVerifier(
    'src/verify-batch.js',
    artifactPath
  );


if (
  batchResult.error
) {
  fail(
    `Batch verifier failed to start: ${batchResult.error.message}`
  );
}


// ----------------------------------------------------
// Run proof-chain verifier
// ----------------------------------------------------

const proofChainResult =
  await runVerifier(
    'src/verify-proof-chain.js',
    artifactPath
  );


if (
  proofChainResult.error
) {
  fail(
    `Proof-chain verifier failed to start: ${proofChainResult.error.message}`
  );
}


// ----------------------------------------------------
// Derive high-level statuses
// ----------------------------------------------------

const batchVerified =
  batchResult.code ===
    0;


const proofChainVerified =
  proofChainResult.code ===
    0;


const sequenceVerified =
  batchResult.stdout.includes(
    'Sequence integrity: VERIFIED'
  );


const batchConsistencyVerified =
  batchResult.stdout.includes(
    'Batch consistency: VERIFIED'
  );


const artifactIntegrityVerified =
  batchResult.stdout.includes(
    'Artifact integrity: VERIFIED'
  );


const artifactToStorageVerified =
  proofChainResult.stdout.includes(
    'Artifact -> Storage: VERIFIED'
  );


const storageToFabricVerified =
  proofChainResult.stdout.includes(
    'Storage -> Fabric: VERIFIED'
  );


const pieceCidLinked =
  proofChainResult.stdout.includes(
    'PieceCID linkage: VERIFIED'
  );


const overallVerified =
  batchVerified &&
  proofChainVerified;


// ----------------------------------------------------
// Report
// ----------------------------------------------------

console.log(
  '\n================================'
);

console.log(
  'TrustIoT Independent Verification'
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
  artifact.schema ??
    'UNKNOWN'
);


console.log(
  'Device:',
  artifact.deviceId ??
    'UNKNOWN'
);


console.log(
  'Sensor:',
  artifact.sensor ??
    'UNKNOWN'
);


console.log(
  'Readings:',
  artifact.readingCount ??
    'UNKNOWN'
);


console.log(
  '\n--- Batch Verification ---'
);


console.log(
  'Artifact integrity:',
  artifactIntegrityVerified
    ? 'VERIFIED'
    : 'FAILED'
);


console.log(
  'Sequence integrity:',
  sequenceVerified
    ? 'VERIFIED'
    : 'FAILED'
);


console.log(
  'Batch consistency:',
  batchConsistencyVerified
    ? 'VERIFIED'
    : 'FAILED'
);


console.log(
  '\n--- Proof Chain Verification ---'
);


console.log(
  'Artifact -> Storage:',
  artifactToStorageVerified
    ? 'VERIFIED'
    : 'FAILED'
);


console.log(
  'Storage -> Fabric:',
  storageToFabricVerified
    ? 'VERIFIED'
    : 'FAILED'
);


console.log(
  'PieceCID linkage:',
  pieceCidLinked
    ? 'VERIFIED'
    : 'FAILED'
);


// ----------------------------------------------------
// Diagnostic output on failure
// ----------------------------------------------------

if (
  !batchVerified
) {
  console.log(
    '\n--- Batch Verifier Diagnostics ---\n'
  );

  if (
    batchResult.stdout.trim()
  ) {
    console.log(
      batchResult.stdout.trim()
    );
  }

  if (
    batchResult.stderr.trim()
  ) {
    console.error(
      batchResult.stderr.trim()
    );
  }
}


if (
  !proofChainVerified
) {
  console.log(
    '\n--- Proof Chain Diagnostics ---\n'
  );

  if (
    proofChainResult.stdout.trim()
  ) {
    console.log(
      proofChainResult.stdout.trim()
    );
  }

  if (
    proofChainResult.stderr.trim()
  ) {
    console.error(
      proofChainResult.stderr.trim()
    );
  }
}


// ----------------------------------------------------
// Overall
// ----------------------------------------------------

console.log(
  '\n--------------------------------'
);


console.log(
  'Overall TrustIoT proof:',
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

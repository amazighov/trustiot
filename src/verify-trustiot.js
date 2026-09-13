import fs from 'fs';
import path from 'path';

import {
  verifyBatchArtifact
} from './core/verification/verifyBatch.js';

import {
  verifyProofChain
} from './core/verification/verifyProofChain.js';


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


function status(
  verified
) {
  return verified
    ? 'VERIFIED'
    : 'FAILED';
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
// Batch verification
// ----------------------------------------------------

const batchResult =
  verifyBatchArtifact(
    artifactPath
  );


if (
  !batchResult.artifact
) {
  fail(
    batchResult.error ??
      'Batch verification failed'
  );
}


// ----------------------------------------------------
// Proof-chain verification
// ----------------------------------------------------

const proofChainResult =
  verifyProofChain(
    artifactPath
  );


// ----------------------------------------------------
// Overall
// ----------------------------------------------------

const batchVerified =
  batchResult.overallVerified ===
  true;


const proofChainVerified =
  proofChainResult.overallVerified ===
  true;


const overallVerified =
  batchVerified &&
  proofChainVerified;


// ----------------------------------------------------
// Header
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
  batchResult.artifact.schema
);


console.log(
  'Device:',
  batchResult.artifact.deviceId
);


console.log(
  'Sensor:',
  batchResult.artifact.sensor
);


console.log(
  'Readings:',
  batchResult.artifact.readingCount
);


console.log(
  'Sequence range:',
  `${batchResult.firstSequence} -> ${batchResult.lastSequence}`
);


// ----------------------------------------------------
// Batch verification report
// ----------------------------------------------------

console.log(
  '\n--- Batch Verification ---'
);


console.log(
  'Artifact integrity:',
  status(
    batchResult.artifactIntegrity
  )
);


console.log(
  'Sequence integrity:',
  status(
    batchResult.sequenceIntegrity
  )
);


console.log(
  'Batch consistency:',
  status(
    batchResult.batchConsistency
  )
);


console.log(
  'Expected SHA-256:',
  batchResult.expectedSha256
);


console.log(
  'Calculated SHA-256:',
  batchResult.calculatedSha256
);


// ----------------------------------------------------
// Proof-chain report
// ----------------------------------------------------

console.log(
  '\n--- Artifact -> Synapse ---'
);


if (
  proofChainResult.artifactToStorage
) {
  console.log(
    'Payload linkage:',
    status(
      proofChainResult
        .artifactToStorage
        .payloadLinked
    )
  );


  console.log(
    'File linkage:',
    status(
      proofChainResult
        .artifactToStorage
        .fileLinked
    )
  );


  console.log(
    'Device linkage:',
    status(
      proofChainResult
        .artifactToStorage
        .deviceLinked
    )
  );


  console.log(
    'Sensor linkage:',
    status(
      proofChainResult
        .artifactToStorage
        .sensorLinked
    )
  );


  console.log(
    'Reading count linkage:',
    status(
      proofChainResult
        .artifactToStorage
        .readingCountLinked
    )
  );


  console.log(
    'Storage verification:',
    status(
      proofChainResult
        .artifactToStorage
        .storageVerified
    )
  );


  console.log(
    'PieceCID present:',
    status(
      proofChainResult
        .artifactToStorage
        .pieceCidPresent
    )
  );


  console.log(
    'Artifact -> Storage:',
    status(
      proofChainResult
        .artifactToStorage
        .verified
    )
  );

} else {
  console.log(
    'Artifact -> Storage: FAILED'
  );
}


// ----------------------------------------------------
// Synapse -> Fabric
// ----------------------------------------------------

console.log(
  '\n--- Synapse -> Fabric ---'
);


if (
  proofChainResult.storageToFabric
) {
  console.log(
    'Payload linkage:',
    status(
      proofChainResult
        .storageToFabric
        .payloadLinked
    )
  );


  console.log(
    'File linkage:',
    status(
      proofChainResult
        .storageToFabric
        .fileLinked
    )
  );


  console.log(
    'PieceCID linkage:',
    status(
      proofChainResult
        .storageToFabric
        .pieceCidLinked
    )
  );


  console.log(
    'Device linkage:',
    status(
      proofChainResult
        .storageToFabric
        .deviceLinked
    )
  );


  console.log(
    'Fabric verification:',
    status(
      proofChainResult
        .storageToFabric
        .fabricVerified
    )
  );


  console.log(
    'Storage -> Fabric:',
    status(
      proofChainResult
        .storageToFabric
        .verified
    )
  );

} else {
  console.log(
    'Storage -> Fabric: FAILED'
  );
}


// ----------------------------------------------------
// PieceCID
// ----------------------------------------------------

if (
  proofChainResult.pieceCid
) {
  console.log(
    '\nPieceCID:',
    proofChainResult.pieceCid
  );
}


// ----------------------------------------------------
// Diagnostics
// ----------------------------------------------------

if (
  batchResult.error
) {
  console.log(
    '\nBatch diagnostic:',
    batchResult.error
  );
}


if (
  proofChainResult.error
) {
  console.log(
    '\nProof-chain diagnostic:',
    proofChainResult.error
  );
}


// ----------------------------------------------------
// Final result
// ----------------------------------------------------

console.log(
  '\n--------------------------------'
);


console.log(
  'Batch proof:',
  status(
    batchVerified
  )
);


console.log(
  'Proof chain:',
  status(
    proofChainVerified
  )
);


console.log(
  'Overall TrustIoT proof:',
  status(
    overallVerified
  )
);


console.log(
  '--------------------------------\n'
);


// ----------------------------------------------------
// Machine-readable result
// ----------------------------------------------------

console.log(
  JSON.stringify(
    {
      verifier:
        'trustiot.independent.verifier.v1',

      artifact:
        path.basename(
          artifactPath
        ),

      deviceId:
        batchResult
          .artifact
          .deviceId,

      batch: {
        artifactIntegrity:
          batchResult
            .artifactIntegrity,

        sequenceIntegrity:
          batchResult
            .sequenceIntegrity,

        batchConsistency:
          batchResult
            .batchConsistency,

        verified:
          batchVerified
      },

      proofChain: {
        artifactToStorage:
          proofChainResult
            .artifactToStorage
            ?.verified ??
            false,

        storageToFabric:
          proofChainResult
            .storageToFabric
            ?.verified ??
            false,

        pieceCid:
          proofChainResult
            .pieceCid ??
            null,

        verified:
          proofChainVerified
      },

      overallVerified
    },
    null,
    2
  )
);


// ----------------------------------------------------
// Exit status
// ----------------------------------------------------

if (
  !overallVerified
) {
  process.exitCode =
    2;
}
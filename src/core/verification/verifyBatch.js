import fs from 'fs';
import path from 'path';
import crypto from 'crypto';


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


export function verifyBatchArtifact(
  requestedPath
) {
  const artifactPath =
    path.resolve(
      requestedPath
    );

  if (
    !fs.existsSync(
      artifactPath
    )
  ) {
    return {
      ok: false,
      error:
        `Artifact not found: ${artifactPath}`
    };
  }


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
    return {
      ok: false,
      error:
        `Invalid artifact JSON: ${error.message}`
    };
  }


  if (
    artifact.schema !==
    'trustiot.sensor.batch.v1'
  ) {
    return {
      ok: false,
      error:
        `Unsupported artifact schema: ${artifact.schema}`
    };
  }


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
      return {
        ok: false,
        error:
          `Missing artifact field: ${field}`
      };
    }
  }


  if (
    !Array.isArray(
      artifact.readings
    )
  ) {
    return {
      ok: false,
      error:
        'Artifact readings must be an array'
    };
  }


  if (
    artifact.readings.length !==
    artifact.readingCount
  ) {
    return {
      ok: false,
      error:
        `readingCount mismatch: expected=${artifact.readingCount}, actual=${artifact.readings.length}`
    };
  }


  if (
    artifact.readingCount ===
    0
  ) {
    return {
      ok: false,
      error:
        'Artifact contains no readings'
    };
  }


  let sequenceIntegrity =
    true;

  let batchConsistency =
    true;

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
      batchConsistency =
        false;
    }


    if (
      reading.sensor !==
      artifact.sensor
    ) {
      batchConsistency =
        false;
    }


    if (
      !Number.isInteger(
        reading.timestamp
      )
    ) {
      batchConsistency =
        false;
    }


    if (
      !Number.isInteger(
        reading.sequence
      )
    ) {
      sequenceIntegrity =
        false;
    }


    if (
      previousSequence !==
        null &&
      reading.sequence <=
        previousSequence
    ) {
      sequenceIntegrity =
        false;
    }


    if (
      previousTimestamp !==
        null &&
      reading.timestamp <
        previousTimestamp
    ) {
      batchConsistency =
        false;
    }


    previousSequence =
      reading.sequence;

    previousTimestamp =
      reading.timestamp;
  }


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
    batchConsistency =
      false;
  }


  if (
    artifact.batchEndedAt !==
    lastReading.timestamp
  ) {
    batchConsistency =
      false;
  }


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


  const artifactIntegrity =
    calculatedSha256 ===
    artifact.sha256;


  const overallVerified =
    artifactIntegrity &&
    sequenceIntegrity &&
    batchConsistency;


  return {
    ok:
      overallVerified,

    artifactPath,

    artifact,

    artifactIntegrity,

    sequenceIntegrity,

    batchConsistency,

    expectedSha256:
      artifact.sha256,

    calculatedSha256,

    firstSequence:
      firstReading.sequence,

    lastSequence:
      lastReading.sequence,

    overallVerified
  };
}

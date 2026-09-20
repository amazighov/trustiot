import crypto from 'node:crypto';

import {
  canonicalDeviceReading
} from './src/core/attestation/canonicalDeviceReading.js';

import {
  verifyDeviceAttestation
} from './src/core/attestation/verifyDeviceAttestation.js';

import {
  registerDevice,
  getDevice,
  assertFreshSequence,
  commitSequence
} from './src/core/attestation/deviceRegistry.js';


const TEST_DEVICE_ID =
  'test-replay-device';


const {
  privateKey,
  publicKey
} =
  crypto.generateKeyPairSync(
    'ec',
    {
      namedCurve:
        'prime256v1'
    }
  );


registerDevice({
  deviceId:
    TEST_DEVICE_ID,

  publicKey
});


const reading = {
  deviceId:
    TEST_DEVICE_ID,

  sensor:
    'bme280',

  temperature:
    30.55,

  humidity:
    54.46,

  pressure:
    897.64,

  timestamp:
    1788735634,

  sequence:
    123
};


const canonical =
  canonicalDeviceReading(
    reading
  );


const signature =
  crypto
    .sign(
      'sha256',

      Buffer.from(
        canonical,
        'utf8'
      ),

      {
        key:
          privateKey,

        dsaEncoding:
          'der'
      }
    )
    .toString(
      'base64'
    );


const device =
  getDevice(
    TEST_DEVICE_ID
  );


if (!device) {
  throw new Error(
    'Test device was not registered'
  );
}


const signatureVerified =
  verifyDeviceAttestation({
    reading,

    signature,

    publicKey:
      device.publicKey
  });


if (!signatureVerified) {
  throw new Error(
    'Signature verification failed'
  );
}


// First sequence must pass.

assertFreshSequence(
  TEST_DEVICE_ID,
  reading.sequence
);


commitSequence(
  TEST_DEVICE_ID,
  reading.sequence
);


console.log(
  'First reading accepted'
);


// Same sequence must be rejected.

let replayRejected =
  false;


try {
  assertFreshSequence(
    TEST_DEVICE_ID,
    reading.sequence
  );

} catch (error) {
  replayRejected =
    true;

  console.log(
    'Replay rejected:',
    error.message
  );
}


if (!replayRejected) {
  throw new Error(
    'Replay attack was accepted'
  );
}


// Higher sequence must pass.

const nextSequence =
  reading.sequence + 1;


assertFreshSequence(
  TEST_DEVICE_ID,
  nextSequence
);


commitSequence(
  TEST_DEVICE_ID,
  nextSequence
);


const updatedDevice =
  getDevice(
    TEST_DEVICE_ID
  );


if (
  updatedDevice.lastSequence !==
  nextSequence
) {
  throw new Error(
    `Sequence commit failed: expected=${nextSequence}, actual=${updatedDevice.lastSequence}`
  );
}


console.log(
  'Higher sequence accepted:',
  nextSequence
);


console.log(
  'Replay protection test passed'
);
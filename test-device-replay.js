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
    'esp32-01',

  publicKey
});


const reading = {
  deviceId:
    'esp32-01',

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
  crypto.sign(
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
    reading.deviceId
  );


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


assertFreshSequence(
  reading.deviceId,
  reading.sequence
);


commitSequence(
  reading.deviceId,
  reading.sequence
);


console.log(
  'First reading accepted'
);


let replayRejected =
  false;

try {
  assertFreshSequence(
    reading.deviceId,
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


console.log(
  'Replay protection test passed'
);

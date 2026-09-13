import crypto from 'node:crypto';

import {
  canonicalDeviceReading
} from './src/core/attestation/canonicalDeviceReading.js';

import {
  verifyDeviceAttestation
} from './src/core/attestation/verifyDeviceAttestation.js';


// ----------------------------------------------------
// Temporary test identity
// ----------------------------------------------------

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


// ----------------------------------------------------
// Simulated ESP32 reading
// ----------------------------------------------------

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


// ----------------------------------------------------
// Canonical representation
// ----------------------------------------------------

const canonical =
  canonicalDeviceReading(
    reading
  );


// ----------------------------------------------------
// Simulated device signature
// ----------------------------------------------------

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


// ----------------------------------------------------
// TrustIoT verification
// ----------------------------------------------------

const verified =
  verifyDeviceAttestation({
    reading,
    signature,
    publicKey
  });

console.log(
  'Canonical:',
  canonical
);

console.log(
  'Signature verified:',
  verified
);


// ----------------------------------------------------
// Tampering test
// ----------------------------------------------------

const tamperedReading = {
  ...reading,

  temperature:
    99.99
};

const tamperedVerified =
  verifyDeviceAttestation({
    reading:
      tamperedReading,

    signature,

    publicKey
  });

console.log(
  'Tampered reading verified:',
  tamperedVerified
);


// ----------------------------------------------------
// Assertions
// ----------------------------------------------------

if (
  verified !== true
) {
  throw new Error(
    'Valid device signature was rejected'
  );
}

if (
  tamperedVerified !== false
) {
  throw new Error(
    'Tampered reading was accepted'
  );
}

console.log(
  'Device attestation test passed'
);

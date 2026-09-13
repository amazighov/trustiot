import fs from 'fs';
import crypto from 'crypto';

import {
  canonicalDeviceReading
} from './src/core/attestation/canonicalDeviceReading.js';


const privateKey =
  fs.readFileSync(
    'data/private/device-keys/esp32-02-private.pem',
    'utf8'
  );


const state =
  JSON.parse(
    fs.readFileSync(
      'data/private/device-state.json',
      'utf8'
    )
  );

const lastSequence =
  state.devices?.['esp32-02']
    ?.lastSequence ?? 0;

const reading = {
  deviceId:
    'esp32-02',

  sensor:
    'bme280',

  temperature:
    29.42,

  humidity:
    48.17,

  pressure:
    891.26,

  timestamp:
    Math.floor(
      Date.now() / 1000
    ),

  sequence:
    lastSequence + 1
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


const payload = {
  ...reading,
  signature
};


console.log(
  'Canonical:'
);

console.log(
  canonical
);


console.log(
  '\nSending:'
);

console.log(
  JSON.stringify(
    payload
  )
);


const response =
  await fetch(
    'http://127.0.0.1:3000/sensor',
    {
      method:
        'POST',

      headers: {
        'Content-Type':
          'application/json'
      },

      body:
        JSON.stringify(
          payload
        )
    }
  );


console.log(
  '\nHTTP:',
  response.status
);


console.log(
  await response.text()
);

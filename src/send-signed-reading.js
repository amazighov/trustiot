import { readFile } from 'node:fs/promises';

import {
  signDeviceReading
} from './core/deviceSigning.js';

const privateKeyPem =
  await readFile(
    'data/device-keys/esp32-01-private.pem',
    'utf8'
  );

const reading = {
  deviceId: 'farm-001/esp32-01',
  sequence: 1,
  timestamp: new Date().toISOString(),
  temperature: 24.5,
  nonce: `reading-${Date.now()}`
};

const signedReading =
  signDeviceReading(
    reading,
    privateKeyPem
  );

const response =
  await fetch(
    'http://127.0.0.1:8080/api/readings',
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/json'
      },
      body:
        JSON.stringify(
          signedReading
        )
    }
  );

console.log(
  'HTTP status:',
  response.status
);

console.log(
  await response.text()
);

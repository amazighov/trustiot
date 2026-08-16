import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  signDeviceReading,
  verifyDeviceReading
} from '../src/core/deviceSigning.js';

const privateKeyPem =
  await readFile(
    'data/device-keys/esp32-01-private.pem',
    'utf8'
  );

const publicKeyPem =
  await readFile(
    'data/device-keys/esp32-01-public.pem',
    'utf8'
  );

test(
  'accepts a valid signed ESP32 reading',
  () => {
    const reading = {
      deviceId:
        'farm-001/esp32-01',

      sequence: 1,

      timestamp:
        new Date().toISOString(),

      temperature: 24.5,

      nonce:
        'device-reading-test-001'
    };

    const signed =
      signDeviceReading(
        reading,
        privateKeyPem
      );

    assert.equal(
      verifyDeviceReading(
        signed,
        publicKeyPem
      ),
      true
    );
  }
);

test(
  'rejects a tampered ESP32 reading',
  () => {
    const reading = {
      deviceId:
        'farm-001/esp32-01',

      sequence: 2,

      timestamp:
        new Date().toISOString(),

      temperature: 24.5,

      nonce:
        'device-reading-test-002'
    };

    const signed =
      signDeviceReading(
        reading,
        privateKeyPem
      );

    signed.temperature = 99.9;

    assert.equal(
      verifyDeviceReading(
        signed,
        publicKeyPem
      ),
      false
    );
  }
);

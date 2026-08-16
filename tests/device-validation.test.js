import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  signDeviceReading
} from '../src/core/deviceSigning.js';

import {
  validateDeviceReading
} from '../src/core/deviceValidation.js';

const privateKeyPem =
  await readFile(
    'data/device-keys/esp32-01-private.pem',
    'utf8'
  );

test(
  'accepts a signed reading from a trusted ESP32',
  async () => {
    const reading = {
      deviceId:
        'farm-001/esp32-01',

      sequence: 1,

      timestamp:
        new Date().toISOString(),

      temperature: 24.5,

      nonce:
        'validation-test-001'
    };

    const signed =
      signDeviceReading(
        reading,
        privateKeyPem
      );

    const result =
      await validateDeviceReading(
        signed
      );

    assert.equal(
      result.valid,
      true
    );

    assert.equal(
      result.deviceId,
      'farm-001/esp32-01'
    );

    assert.equal(
      result.sequence,
      1
    );
  }
);

test(
  'rejects a reading from an unknown device',
  async () => {
    const reading = {
      deviceId:
        'unknown-device',

      sequence: 1,

      timestamp:
        new Date().toISOString(),

      temperature: 24.5,

      nonce:
        'validation-test-002'
    };

    const signed =
      signDeviceReading(
        reading,
        privateKeyPem
      );

    await assert.rejects(
      () =>
        validateDeviceReading(
          signed
        ),
      /Unknown device: unknown-device/
    );
  }
);

test(
  'rejects a tampered signed reading',
  async () => {
    const reading = {
      deviceId:
        'farm-001/esp32-01',

      sequence: 2,

      timestamp:
        new Date().toISOString(),

      temperature: 24.5,

      nonce:
        'validation-test-003'
    };

    const signed =
      signDeviceReading(
        reading,
        privateKeyPem
      );

    signed.temperature = 99.9;

    await assert.rejects(
      () =>
        validateDeviceReading(
          signed
        ),
      /Invalid device signature: farm-001\/esp32-01/
    );
  }
);

import {
  after,
  before,
  test
} from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  generateSigningKeyPair
} from '../src/core/signing.js';

import {
  signDeviceReading
} from '../src/core/deviceSigning.js';

import {
  validateDeviceReading
} from '../src/core/deviceValidation.js';

const {
  privateKeyPem,
  publicKeyPem
} = generateSigningKeyPair();

let fixtureDirectory;

before(async () => {
  fixtureDirectory = await mkdtemp(
    join(tmpdir(), 'trustiot-device-validation-')
  );
  const publicKeyPath = join(
    fixtureDirectory,
    'esp32-01-public.pem'
  );
  await writeFile(publicKeyPath, publicKeyPem, 'utf8');
  process.env.DEVICE_ESP32_01_PUBLIC_KEY_PATH =
    publicKeyPath;
});

after(async () => {
  delete process.env.DEVICE_ESP32_01_PUBLIC_KEY_PATH;
  await rm(fixtureDirectory, {
    recursive: true,
    force: true
  });
});

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

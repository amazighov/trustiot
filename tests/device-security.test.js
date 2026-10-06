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
  getTrustedDevice,
  isTrustedDevice
} from '../src/core/deviceRegistry.js';

let fixtureDirectory;

before(async () => {
  const { publicKeyPem } = generateSigningKeyPair();
  fixtureDirectory = await mkdtemp(
    join(tmpdir(), 'trustiot-device-registry-')
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
  'trusted device registry accepts ESP32 device',
  async () => {
    assert.equal(
      isTrustedDevice(
        'farm-001/esp32-01'
      ),
      true
    );

    const device =
      await getTrustedDevice(
        'farm-001/esp32-01'
      );

    assert.equal(
      device.deviceId,
      'farm-001/esp32-01'
    );

    assert.equal(
      device.algorithm,
      'Ed25519'
    );

    assert.equal(
      device.status,
      'ACTIVE'
    );

    assert.equal(
      Boolean(
        device.publicKeyPem
      ),
      true
    );
  }
);

test(
  'trusted device registry rejects unknown device',
  async () => {
    assert.equal(
      isTrustedDevice(
        'unknown-device'
      ),
      false
    );

    await assert.rejects(
      () =>
        getTrustedDevice(
          'unknown-device'
        ),
      /Unknown device: unknown-device/
    );
  }
);

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getTrustedDevice,
  isTrustedDevice
} from '../src/core/deviceRegistry.js';

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

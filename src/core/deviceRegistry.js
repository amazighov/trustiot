import { readFile } from 'node:fs/promises';

const trustedDevices = {
  'farm-001/esp32-01': {
    publicKeyPath:
      'data/device-keys/esp32-01-public.pem',
    algorithm: 'Ed25519',
    status: 'ACTIVE'
  }
};

export async function getTrustedDevice(
  deviceId
) {
  const device =
    trustedDevices[deviceId];

  if (!device) {
    throw new Error(
      `Unknown device: ${deviceId}`
    );
  }

  if (device.status !== 'ACTIVE') {
    throw new Error(
      `Device is not active: ${deviceId}`
    );
  }

  const publicKeyPem =
    await readFile(
      process.env.DEVICE_ESP32_01_PUBLIC_KEY_PATH ||
        device.publicKeyPath,
      'utf8'
    );

  return {
    deviceId,
    algorithm:
      device.algorithm,
    status:
      device.status,
    publicKeyPem
  };
}

export function isTrustedDevice(
  deviceId
) {
  const device =
    trustedDevices[deviceId];

  return Boolean(
    device &&
    device.status === 'ACTIVE'
  );
}

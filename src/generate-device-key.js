import {
  generateKeyPairSync
} from 'node:crypto';

import {
  mkdir,
  writeFile
} from 'node:fs/promises';

const deviceId =
  'farm-001/esp32-01';

const {
  privateKey,
  publicKey
} = generateKeyPairSync(
  'ed25519'
);

const privateKeyPem =
  privateKey.export({
    type: 'pkcs8',
    format: 'pem'
  });

const publicKeyPem =
  publicKey.export({
    type: 'spki',
    format: 'pem'
  });

await mkdir(
  'data/device-keys',
  {
    recursive: true
  }
);

await writeFile(
  'data/device-keys/esp32-01-private.pem',
  privateKeyPem,
  {
    mode: 0o600
  }
);

await writeFile(
  'data/device-keys/esp32-01-public.pem',
  publicKeyPem
);

console.log(
  `Device identity generated: ${deviceId}`
);

console.log(
  'Private key: data/device-keys/esp32-01-private.pem'
);

console.log(
  'Public key: data/device-keys/esp32-01-public.pem'
);

import { mkdir, writeFile } from 'node:fs/promises';

import {
  generateSigningKeyPair
} from './core/signing.js';

const {
  privateKeyPem,
  publicKeyPem
} = generateSigningKeyPair();

await mkdir('data/keys', {
  recursive: true
});

await writeFile(
  'data/keys/gateway-private.pem',
  privateKeyPem,
  {
    mode: 0o600
  }
);

await writeFile(
  'data/keys/gateway-public.pem',
  publicKeyPem
);

console.log(
  'Gateway signing key pair generated.'
);

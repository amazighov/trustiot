import {
  Synapse,
  calibration
} from '@filoz/synapse-sdk';

import {
  privateKeyToAccount
} from 'viem/accounts';

const privateKey =
  process.env.SYNAPSE_PRIVATE_KEY;

if (!privateKey) {
  throw new Error(
    'SYNAPSE_PRIVATE_KEY is required'
  );
}

const account =
  privateKeyToAccount(
    privateKey
  );

const synapse =
  Synapse.create({
    account,
    source: 'trustiot',
    chain: calibration,
    withCDN: false
  });

const data =
  new TextEncoder().encode(
    JSON.stringify({
      project: 'TrustIoT',
      test: 'synapse-upload',
      timestamp:
        new Date().toISOString(),
      message:
        'TrustIoT Synapse PDP test payload for Calibration storage verification',
      padding:
        'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
    })
  );

console.log(
  `Uploading ${data.length} bytes through Synapse...`
);

const result =
  await synapse.storage.upload(
    data
  );

console.log(
  JSON.stringify(
    {
      message:
        'Synapse upload completed',

      pieceCid:
        result.pieceCid?.toString?.() ??
        String(result.pieceCid),

      size:
        data.length,

      rawKeys:
        Object.keys(result)
    },
    null,
    2
  )
);

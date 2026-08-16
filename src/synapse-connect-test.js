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

console.log(
  JSON.stringify(
    {
      message:
        'Synapse SDK initialized',
      address:
        account.address,
      network:
        'calibration',
      source:
        'trustiot'
    },
    null,
    2
  )
);

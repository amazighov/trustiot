import {
  Synapse,
  calibration,
  formatUnits
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

// Similar to the small encrypted TrustIoT
// artifacts we have been uploading.
const dataSize = 5n * 1024n;

console.log(
  `Checking Synapse readiness for ${dataSize} bytes...`
);

const prep =
  await synapse.storage.prepare({
    dataSize
  });

console.log(
  JSON.stringify(
    {
      address:
        account.address,

      network:
        'calibration',

      dataSize:
        dataSize.toString(),

      ready:
        prep.costs.ready,

      depositNeededUSDFC:
        formatUnits(
          prep.costs.depositNeeded
        ),

      ratePerMonthUSDFC:
        formatUnits(
          prep.costs.rates.perMonth
        ),

      transactionRequired:
        Boolean(
          prep.transaction
        ),

      includesApproval:
        prep.transaction
          ? prep.transaction
              .includesApproval
          : false,

      depositAmountUSDFC:
        prep.transaction
          ? formatUnits(
              prep.transaction
                .depositAmount
            )
          : '0'
    },
    null,
    2
  )
);

if (prep.transaction) {
  console.log();
  console.log(
    'Preparation transaction is required.'
  );

  console.log(
    'NOT executing it in this test.'
  );
} else {
  console.log();
  console.log(
    'Account is already ready for this upload.'
  );
}

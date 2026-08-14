import { FabricLedgerAdapter }
  from './adapters/fabricLedger.js';

const [datasetId, status = 'VERIFIED'] =
  process.argv.slice(2);

if (!datasetId) {
  console.error(
    'Usage: node src/fabric-verify-status.js <datasetId> [status]'
  );
  process.exit(1);
}

const ledger = new FabricLedgerAdapter();

const updated =
  await ledger.setVerificationStatus(
    datasetId,
    status
  );

console.log(
  JSON.stringify(updated, null, 2)
);
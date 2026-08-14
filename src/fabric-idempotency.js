import { FabricLedgerAdapter }
  from './adapters/fabricLedger.js';

const fabric = new FabricLedgerAdapter();

const manifest = {
  datasetId: 'a6c50750-671e-487c-a13f-792b2eb36628',
  deviceId: 'farm-001/temp-01',
  ownerOrg: 'FarmOrg',
  cid: 'bafkreiehs3zmrpcjaz6fyx7qkckiu7id24q4n2da4uy5amleidpiefcvny',
  storageRef: 'bafkreiehs3zmrpcjaz6fyx7qkckiu7id24q4n2da4uy5amleidpiefcvny',
  ciphertextSha256:
    '8796f2c8bc49067c5c5ff050948a7d03d721c6e860e531d0316440de8214556e',
  startedAt: '2026-08-08T15:57:15.644Z',
  endedAt: '2026-08-08T15:57:39.644Z',
  readingCount: 25,
  schemaVersion: 'trustiot.batch.v1'
};

const result = await fabric.register(manifest);

console.log(
  JSON.stringify(result, null, 2)
);

import { FabricGatewayAdapter }
  from './adapters/fabricGateway.js';

const [datasetId] = process.argv.slice(2);

if (!datasetId) {
  console.error(
    'Usage: node src/fabric-read.js <datasetId>'
  );
  process.exit(1);
}

const fabric =
  new FabricGatewayAdapter();

try {
  await fabric.connect();

  const dataset =
    await fabric.readDataset(datasetId);

  console.log(
    JSON.stringify(dataset, null, 2)
  );
} finally {
  fabric.close();
}

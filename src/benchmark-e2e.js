import fs from 'fs';
import path from 'path';


// ----------------------------------------------------
// Paths
// ----------------------------------------------------

const synapseLedgerPath =
  path.resolve(
    'data/ledger/synapse-batches.jsonl'
  );

const fabricLedgerPath =
  path.resolve(
    'data/ledger/fabric-proofs.jsonl'
  );


// ----------------------------------------------------
// Helpers
// ----------------------------------------------------

function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  return fs
    .readFileSync(
      filePath,
      'utf8'
    )
    .split('\n')
    .filter(Boolean)
    .map(
      line =>
        JSON.parse(line)
    );
}


function numeric(values) {
  return values.filter(
    value =>
      Number.isFinite(value)
  );
}


function average(values) {
  const valid =
    numeric(values);

  if (
    valid.length === 0
  ) {
    return null;
  }

  return (
    valid.reduce(
      (sum, value) =>
        sum + value,
      0
    ) /
    valid.length
  );
}


function percentile(
  values,
  p
) {
  const valid =
    numeric(values)
      .slice()
      .sort(
        (a, b) =>
          a - b
      );

  if (
    valid.length === 0
  ) {
    return null;
  }

  if (
    valid.length === 1
  ) {
    return valid[0];
  }

  const index =
    (valid.length - 1) *
    p;

  const lower =
    Math.floor(index);

  const upper =
    Math.ceil(index);

  if (
    lower === upper
  ) {
    return valid[
      lower
    ];
  }

  const weight =
    index - lower;

  return (
    valid[lower] *
      (1 - weight) +
    valid[upper] *
      weight
  );
}


function round(value) {
  return value === null
    ? null
    : Math.round(
        value
      );
}


// ----------------------------------------------------
// Read ledgers
// ----------------------------------------------------

const synapseRecords =
  readJsonLines(
    synapseLedgerPath
  );

const fabricRecords =
  readJsonLines(
    fabricLedgerPath
  );

if (
  synapseRecords.length === 0
) {
  throw new Error(
    'No Synapse ledger records found'
  );
}


// ----------------------------------------------------
// Verified Synapse records
// ----------------------------------------------------

const verifiedStorage =
  synapseRecords.filter(
    record =>
      record.storageVerified ===
      true
  );


// ----------------------------------------------------
// Verified Fabric records
// ----------------------------------------------------

const verifiedFabric =
  fabricRecords.filter(
    record =>
      record.fabricVerified ===
      true
  );


// ----------------------------------------------------
// Join Synapse + Fabric by artifact
// ----------------------------------------------------

const fabricByArtifact =
  new Map();

for (
  const record
  of verifiedFabric
) {
  fabricByArtifact.set(
    record.artifact,
    record
  );
}


const endToEndRecords =
  [];

for (
  const storage
  of verifiedStorage
) {
  const fabric =
    fabricByArtifact.get(
      storage.artifact
    );

  if (!fabric) {
    continue;
  }

  const storageLatency =
    Number(
      storage.totalLatencyMs
    );

  const fabricLatency =
    Number(
      fabric.totalLatencyMs
    );

  if (
    !Number.isFinite(
      storageLatency
    ) ||
    !Number.isFinite(
      fabricLatency
    )
  ) {
    continue;
  }

  endToEndRecords.push({
    artifact:
      storage.artifact,

    readingCount:
      storage.readingCount,

    pieceCid:
      storage.pieceCid,

    proofSha256:
      fabric.proofSha256,

    synapseLatencyMs:
      storageLatency,

    fabricLatencyMs:
      fabricLatency,

    verifiedPipelineLatencyMs:
      storageLatency +
      fabricLatency,

    storageVerified:
      storage.storageVerified,

    fabricVerified:
      fabric.fabricVerified,

    alreadyExisted:
      fabric.alreadyExisted
  });
}


// ----------------------------------------------------
// Aggregate storage evidence
// ----------------------------------------------------

const uploadLatencies =
  verifiedStorage.map(
    record =>
      record.uploadLatencyMs
  );

const retrievalLatencies =
  verifiedStorage.map(
    record =>
      record.retrievalLatencyMs
  );

const storageTotalLatencies =
  verifiedStorage.map(
    record =>
      record.totalLatencyMs
  );

const fabricTotalLatencies =
  verifiedFabric.map(
    record =>
      record.totalLatencyMs
  );

const fabricSubmitLatencies =
  verifiedFabric
    .filter(
      record =>
        record.alreadyExisted ===
          false
    )
    .map(
      record =>
        record.submitLatencyMs
    );

const pipelineLatencies =
  endToEndRecords.map(
    record =>
      record
        .verifiedPipelineLatencyMs
  );


const totalSensorReadings =
  verifiedStorage.reduce(
    (sum, record) =>
      sum +
      (
        Number.isFinite(
          record.readingCount
        )
          ? record.readingCount
          : 0
      ),
    0
  );


// ----------------------------------------------------
// Summary
// ----------------------------------------------------

const summary = {
  benchmark:
    'trustiot.e2e.evidence.v1',

  storage: {
    ledgerRecords:
      synapseRecords.length,

    verifiedBatches:
      verifiedStorage.length,

    totalSensorReadings,

    verificationRate:
      synapseRecords.length === 0
        ? 0
        : verifiedStorage.length /
          synapseRecords.length,

    uploadLatencyMs: {
      average:
        round(
          average(
            uploadLatencies
          )
        ),

      p50:
        round(
          percentile(
            uploadLatencies,
            0.50
          )
        ),

      p95:
        round(
          percentile(
            uploadLatencies,
            0.95
          )
        )
    },

    retrievalLatencyMs: {
      average:
        round(
          average(
            retrievalLatencies
          )
        ),

      p50:
        round(
          percentile(
            retrievalLatencies,
            0.50
          )
        ),

      p95:
        round(
          percentile(
            retrievalLatencies,
            0.95
          )
        )
    },

    totalLatencyMs: {
      average:
        round(
          average(
            storageTotalLatencies
          )
        ),

      p50:
        round(
          percentile(
            storageTotalLatencies,
            0.50
          )
        ),

      p95:
        round(
          percentile(
            storageTotalLatencies,
            0.95
          )
        )
    }
  },

  fabric: {
    ledgerRecords:
      fabricRecords.length,

    verifiedProofs:
      verifiedFabric.length,

    newProofSubmissions:
      verifiedFabric.filter(
        record =>
          record.alreadyExisted ===
          false
      ).length,

    totalLatencyMs: {
      average:
        round(
          average(
            fabricTotalLatencies
          )
        ),

      p50:
        round(
          percentile(
            fabricTotalLatencies,
            0.50
          )
        ),

      p95:
        round(
          percentile(
            fabricTotalLatencies,
            0.95
          )
        )
    },

    newProofSubmitLatencyMs: {
      average:
        round(
          average(
            fabricSubmitLatencies
          )
        ),

      p50:
        round(
          percentile(
            fabricSubmitLatencies,
            0.50
          )
        ),

      p95:
        round(
          percentile(
            fabricSubmitLatencies,
            0.95
          )
        )
    }
  },

  endToEnd: {
    joinedVerifiedBatches:
      endToEndRecords.length,

    totalLatencyMs: {
      average:
        round(
          average(
            pipelineLatencies
          )
        ),

      p50:
        round(
          percentile(
            pipelineLatencies,
            0.50
          )
        ),

      p95:
        round(
          percentile(
            pipelineLatencies,
            0.95
          )
        )
    }
  },

  samples:
    endToEndRecords
};


console.log(
  JSON.stringify(
    summary,
    null,
    2
  )
);
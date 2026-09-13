import fs from 'fs';
import path from 'path';
import crypto from 'crypto';


// ----------------------------------------------------
// Helpers
// ----------------------------------------------------

function readJsonLines(
  filePath
) {
  if (
    !fs.existsSync(
      filePath
    )
  ) {
    return {
      ok: false,
      error:
        `Ledger not found: ${filePath}`
    };
  }

  try {
    const records =
      fs
        .readFileSync(
          filePath,
          'utf8'
        )
        .split(/\r?\n/)
        .filter(Boolean)
        .map(
          line =>
            JSON.parse(
              line
            )
        );

    return {
      ok: true,
      records
    };

  } catch (error) {
    return {
      ok: false,
      error:
        `Failed to read ledger ${filePath}: ${error.message}`
    };
  }
}


function calculateFileSha256(
  filePath
) {
  return crypto
    .createHash(
      'sha256'
    )
    .update(
      fs.readFileSync(
        filePath
      )
    )
    .digest(
      'hex'
    );
}


// ----------------------------------------------------
// Verify TrustIoT proof chain
// ----------------------------------------------------

export function verifyProofChain(
  requestedPath,
  options = {}
) {
  const artifactPath =
    path.resolve(
      requestedPath
    );


  if (
    !fs.existsSync(
      artifactPath
    )
  ) {
    return {
      ok: false,
      error:
        `Artifact not found: ${artifactPath}`
    };
  }


  // --------------------------------------------------
  // Load artifact
  // --------------------------------------------------

  let artifact;

  try {
    artifact =
      JSON.parse(
        fs.readFileSync(
          artifactPath,
          'utf8'
        )
      );

  } catch (error) {
    return {
      ok: false,
      error:
        `Invalid artifact JSON: ${error.message}`
    };
  }


  const artifactName =
    path.basename(
      artifactPath
    );


  // --------------------------------------------------
  // Ledger paths
  // --------------------------------------------------

  const synapseLedgerPath =
    path.resolve(
      options.synapseLedgerPath ??
        'data/ledger/synapse-batches.jsonl'
    );


  const fabricLedgerPath =
    path.resolve(
      options.fabricLedgerPath ??
        'data/ledger/fabric-proofs.jsonl'
    );


  // --------------------------------------------------
  // Read ledgers
  // --------------------------------------------------

  const synapseLedger =
    readJsonLines(
      synapseLedgerPath
    );


  if (
    !synapseLedger.ok
  ) {
    return {
      ok: false,
      error:
        synapseLedger.error
    };
  }


  const fabricLedger =
    readJsonLines(
      fabricLedgerPath
    );


  if (
    !fabricLedger.ok
  ) {
    return {
      ok: false,
      error:
        fabricLedger.error
    };
  }


  // --------------------------------------------------
  // Find latest Synapse receipt
  // --------------------------------------------------

  const synapseReceipt =
    [...synapseLedger.records]
      .reverse()
      .find(
        record =>
          record.artifact ===
          artifactName
      );


  if (
    !synapseReceipt
  ) {
    return {
      ok: false,
      error:
        `No Synapse receipt found for artifact: ${artifactName}`
    };
  }


  // --------------------------------------------------
  // Find latest Fabric receipt
  // --------------------------------------------------

  const fabricReceipt =
    [...fabricLedger.records]
      .reverse()
      .find(
        record =>
          record.artifact ===
          artifactName
      );


  if (
    !fabricReceipt
  ) {
    return {
      ok: false,
      error:
        `No Fabric receipt found for artifact: ${artifactName}`
    };
  }


  // --------------------------------------------------
  // Calculate artifact file hash
  // --------------------------------------------------

  const calculatedFileSha256 =
    calculateFileSha256(
      artifactPath
    );


  // --------------------------------------------------
  // Artifact -> Synapse
  // --------------------------------------------------

  const payloadLinked =
    synapseReceipt.payloadSha256 ===
    artifact.sha256;


  const fileLinked =
    synapseReceipt.fileSha256 ===
    calculatedFileSha256;


  const deviceLinked =
    synapseReceipt.deviceId ===
    artifact.deviceId;


  const sensorLinked =
    synapseReceipt.sensor ===
    artifact.sensor;


  const readingCountLinked =
    synapseReceipt.readingCount ===
    artifact.readingCount;


  const storageVerified =
    synapseReceipt.storageVerified ===
    true;


  const pieceCidPresent =
    typeof synapseReceipt.pieceCid ===
      'string' &&
    synapseReceipt.pieceCid.length >
      0;


  const artifactToStorageVerified =
    payloadLinked &&
    fileLinked &&
    deviceLinked &&
    sensorLinked &&
    readingCountLinked &&
    storageVerified &&
    pieceCidPresent;


  // --------------------------------------------------
  // Synapse -> Fabric
  // --------------------------------------------------

  const fabricVerified =
    fabricReceipt.fabricVerified ===
    true;


  const fabricPayloadLinked =
    fabricReceipt.payloadSha256 ===
    synapseReceipt.payloadSha256;


  const fabricFileLinked =
    fabricReceipt.fileSha256 ===
    synapseReceipt.fileSha256;


  const fabricPieceCidLinked =
    fabricReceipt.pieceCid ===
    synapseReceipt.pieceCid;


  const fabricDeviceLinked =
    fabricReceipt.deviceId ===
    artifact.deviceId;


  const storageToFabricVerified =
    fabricVerified &&
    fabricPayloadLinked &&
    fabricFileLinked &&
    fabricPieceCidLinked &&
    fabricDeviceLinked;


  // --------------------------------------------------
  // Overall
  // --------------------------------------------------

  const overallVerified =
    artifactToStorageVerified &&
    storageToFabricVerified;


  // --------------------------------------------------
  // Structured result
  // --------------------------------------------------

  return {
    ok:
      overallVerified,

    artifactPath,

    artifactName,

    artifact,

    calculatedFileSha256,

    synapseReceipt,

    fabricReceipt,

    artifactToStorage: {
      payloadLinked,

      fileLinked,

      deviceLinked,

      sensorLinked,

      readingCountLinked,

      storageVerified,

      pieceCidPresent,

      verified:
        artifactToStorageVerified
    },

    storageToFabric: {
      payloadLinked:
        fabricPayloadLinked,

      fileLinked:
        fabricFileLinked,

      pieceCidLinked:
        fabricPieceCidLinked,

      deviceLinked:
        fabricDeviceLinked,

      fabricVerified,

      verified:
        storageToFabricVerified
    },

    pieceCid:
      synapseReceipt.pieceCid,

    overallVerified
  };
}

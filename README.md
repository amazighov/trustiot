# TrustIoT

**TrustIoT** is an open-source secure IoT data onboarding and provenance gateway for Filecoin, with Hyperledger Fabric as an enterprise governance and audit layer.

TrustIoT separates large encrypted IoT datasets from their governance metadata:

- encrypted IoT batches are stored on Filecoin;
- **Synapse SDK / PDP** is the primary Filecoin storage path;
- Filecoin Pin remains available as an optional IPFS-oriented storage adapter;
- Hyperledger Fabric records integrity, provenance, storage and verification metadata;
- Ed25519 signatures establish gateway provenance;
- replay protection prevents reuse of signed submissions;
- ESP32 devices can send readings to the TrustIoT ingestion gateway.

## Architecture

TrustIoT separates three concerns:

1. **Edge plane** — IoT devices and gateways produce, validate and batch readings.
2. **Data plane** — encrypted datasets are stored through Filecoin-backed storage.
3. **Governance plane** — Hyperledger Fabric records provenance, integrity and verification state.

```text
ESP32 / Simulator
        |
        v
TrustIoT Gateway
        |
        +--> Device identity validation
        |
        v
Batch + AES-256-GCM
        |
        v
Storage Adapter
        |
        +--> Synapse SDK / PDP   [primary]
        +--> Filecoin Pin        [optional]
        +--> Local Storage       [development]
        |
        v
Storage Reference
(PieceCID / IPFS Root CID / local reference)
        |
        v
Signed Public Manifest
        |
        v
Hyperledger Fabric
        |
        v
Independent Retrieval
        |
        +--> signature verification
        +--> SHA-256 verification
        |
        v
VERIFIED / REJECTED
```

Raw IoT streams are intentionally kept out of Fabric state. Fabric stores compact governance and provenance metadata while Filecoin stores the encrypted datasets.

## Current status — v0.2

TrustIoT currently supports a working end-to-end vertical slice:

```text
IoT readings
→ batch
→ AES-256-GCM encryption
→ Filecoin storage
→ signed manifest
→ Hyperledger Fabric
→ independent retrieval
→ signature verification
→ SHA-256 verification
→ VERIFIED
```

The implementation has been exercised on the Filecoin Calibration network and a local Hyperledger Fabric test network.

### Filecoin

Implemented:

- Synapse SDK integration
- PDP-backed storage on Calibration
- PieceCID-based storage references
- Synapse storage readiness checks
- Synapse upload and download
- Filecoin Pin uploads
- IPFS Root CID retrieval
- local development storage
- storage-driver-independent verification

Synapse/PDP is the primary storage path for v0.2.

Filecoin Pin is retained as an optional adapter rather than removed.

### Hyperledger Fabric

Implemented:

- Fabric Gateway client
- live test-network transactions
- dataset registration and reads
- verification-status transactions
- storage-neutral metadata
- Synapse PieceCID metadata
- Ed25519 signature metadata
- persistent nonce state
- atomic replay protection
- idempotent registration
- retry and ambiguous-commit recovery
- structured transaction logging

The current TrustIoT chaincode used during development is:

```text
Version: 1.5
Sequence: 6
```

### Security and provenance

Implemented:

- AES-256-GCM dataset encryption
- ciphertext SHA-256 integrity hashes
- Ed25519 gateway signatures
- signed public manifests
- stored-signature verification
- manifest tamper detection
- timestamp validation
- nonce-based replay protection
- persistent Fabric anti-replay state
- trusted signer registry
- signer revocation policy
- trusted device registry
- signed device-reading validation
- unknown-device rejection
- tampered-reading rejection

Encryption keys are not written to Filecoin or public Fabric state.

### ESP32

An ESP32 DevKit V1 has been integrated with the development gateway.

Implemented:

```text
ESP32
→ Wi-Fi
→ HTTP
→ TrustIoT ingestion endpoint
```

The ESP32 has successfully communicated with the TrustIoT gateway over the local network.

Trusted-device and signed-reading verification are implemented on the TrustIoT side.

Still planned:

- Ed25519 signing directly on the ESP32
- physical environmental sensor integration
- persistent device-level sequence/replay protection

## Storage model

TrustIoT does not assume that every Filecoin storage mechanism exposes the same identifier.

### Synapse / PDP

```text
storageDriver  = synapse
storageNetwork = calibration | mainnet
storageRef     = PieceCID
pieceCid       = PieceCID
ipfsRootCid    = null
cid            = null
```

### Filecoin Pin

```text
storageDriver  = filecoin-pin
storageNetwork = calibration | mainnet
storageRef     = IPFS Root CID
pieceCid       = PieceCID when available
ipfsRootCid    = IPFS Root CID
cid            = IPFS Root CID
```

### Local development

```text
storageDriver  = local
storageNetwork = null
storageRef     = local file path
pieceCid       = null
ipfsRootCid    = null
cid            = null
```

This keeps the manifest and verification pipeline independent of the underlying storage mechanism.

## Verification model

Verification is independent of the upload path.

For a Fabric-governed dataset, TrustIoT:

1. reads the dataset record from Fabric;
2. resolves the trusted signer;
3. reconstructs the originally signed public manifest;
4. verifies its Ed25519 signature;
5. selects the retrieval implementation using `storageDriver`;
6. retrieves the encrypted artifact;
7. calculates SHA-256;
8. compares it with the on-chain ciphertext hash;
9. records `VERIFIED` or `REJECTED` in Fabric.

For Synapse:

```text
PieceCID
→ Synapse download
→ encrypted bytes
→ SHA-256
→ Fabric verification update
```

For Filecoin Pin:

```text
IPFS Root CID
→ IPFS retrieval
→ encrypted bytes
→ SHA-256
→ Fabric verification update
```

## Run locally

Requires Node.js 24+.

Install dependencies:

```bash
npm install
```

Run the local vertical slice:

```bash
export STORAGE_DRIVER=local
export LEDGER_DRIVER=local

npm run demo
```

## Run with Synapse / PDP

The private key must be supplied outside the repository:

```bash
export SYNAPSE_PRIVATE_KEY='0x...'
export STORAGE_DRIVER=synapse
export LEDGER_DRIVER=local

npm run demo
```

Do not commit private keys or wallet credentials.

For Fabric governance, configure the Fabric environment and use:

```bash
export STORAGE_DRIVER=synapse
export LEDGER_DRIVER=fabric

npm run demo
```

A successful Synapse/Fabric run records fields such as:

```json
{
  "storageDriver": "synapse",
  "storageNetwork": "calibration",
  "storageRef": "bafkzc...",
  "pieceCid": "bafkzc...",
  "ipfsRootCid": null,
  "verificationStatus": "UNVERIFIED"
}
```

Then verify the dataset:

```bash
npm run verify -- <datasetId>
```

A successful verification produces:

```text
Stored manifest signature: VERIFIED
Storage driver: synapse
Retrieving from Synapse: <PieceCID>
```

and finishes with:

```json
{
  "storedSignatureValid": true,
  "verificationStatus": "VERIFIED"
}
```

## Alternative storage drivers

### Filecoin Pin

```bash
export STORAGE_DRIVER=filecoin-pin
npm run demo
```

The legacy value `filecoin` is also accepted for compatibility.

### Local

```bash
export STORAGE_DRIVER=local
npm run demo
```

## Tests

Run core and security tests:

```bash
npm test
```

Run the Fabric integration test with the Fabric test network running:

```bash
npm run test:integration
```

The integration test verifies that Fabric persistently rejects reuse of the same signer nonce.

## Repository structure

```text
trustiot/
├── src/
│   ├── demo.js
│   ├── verify.js
│   ├── ingest-server.js
│   ├── core/
│   │   ├── batch.js
│   │   ├── crypto.js
│   │   ├── manifest.js
│   │   ├── signing.js
│   │   ├── signerRegistry.js
│   │   ├── replay.js
│   │   ├── retry.js
│   │   ├── deviceRegistry.js
│   │   ├── deviceSigning.js
│   │   ├── deviceValidation.js
│   │   └── storageRetrieval.js
│   └── adapters/
│       ├── synapseStorage.js
│       ├── filecoinPin.js
│       ├── localStorage.js
│       ├── fabricGateway.js
│       ├── fabricLedger.js
│       └── localLedger.js
├── chaincode/
│   ├── index.js
│   └── lib/
│       └── trustiot-contract.js
├── fabric/
│   └── collections_config.json
├── tests/
│   ├── core.test.js
│   ├── security.test.js
│   ├── device-security.test.js
│   ├── device-signing.test.js
│   ├── device-validation.test.js
│   └── fabric-replay.integration.test.js
├── docs/
├── data/
├── PROJECT_STATUS.md
└── package.json
```

## Secret management

The repository ignores runtime data and secret material, including:

```text
.env
*.env
data/*
```

with only `data/.gitkeep` retained.

Private keys, wallet credentials, encryption keys and generated encrypted datasets must not be committed.

Production deployments should replace development key files and environment variables with a dedicated KMS or secret-management system.

## Design principle

TrustIoT is not intended to put raw IoT data on a blockchain.

Its design principle is:

```text
Filecoin = encrypted data plane
Fabric   = governance and provenance plane
ESP32    = physical edge plane
```

This separation allows the storage, governance and device layers to evolve independently.

## Next steps

- execute Ed25519 device signing directly on ESP32
- integrate a physical environmental sensor
- move trusted-device governance into Fabric
- add persistent device-level replay protection
- add automated Synapse storage integration tests
- add Mainnet deployment configuration
- harden production key management
- expand architecture and deployment documentation

## License

Apache-2.0 for the prototype. Additional licensing can be evaluated as the project moves toward production and grant deployment.
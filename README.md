# TrustIoT

**TrustIoT** is an open-source verifiable IoT data provenance and storage pipeline built around physical device attestation, Filecoin-backed storage, independent verification, and optional Hyperledger Fabric governance.

TrustIoT is designed around a simple principle:

> Store IoT data in the data layer, store compact proofs and governance metadata in the ledger layer, and preserve cryptographic evidence from the physical device to independent verification.

TrustIoT v0.1.0 is a working prototype that has been exercised with physical ESP32 hardware, a BME280 environmental sensor, Filecoin Calibration through Synapse/PDP, and a local Hyperledger Fabric test network.

---

## Why TrustIoT?

IoT pipelines commonly need to answer several different questions:

- Which physical device produced this reading?
- Was the reading modified after it left the device?
- Has the same signed reading been replayed?
- Does a stored batch still match the data originally accepted?
- Can storage provenance be linked to an independently verifiable proof?
- Can large IoT datasets remain outside a blockchain while their integrity and provenance remain auditable?

TrustIoT separates these concerns rather than placing raw sensor streams directly on-chain.

---

## Architecture

TrustIoT uses four cooperating planes:

1. **Device / edge plane** — physical devices sign readings and send them to the gateway.
2. **Data plane** — batches and encrypted datasets are stored using Filecoin-backed or local storage adapters.
3. **Governance plane** — Hyperledger Fabric can record compact provenance and verification metadata.
4. **Verification plane** — independent verification checks batch integrity and the storage/proof chain.

```text
┌──────────────────────────────────────────────────────┐
│                DEVICE / EDGE PLANE                   │
│                                                      │
│ ESP32 + BME280                                      │
│      │                                               │
│      ├─ ECDSA P-256 device signature                │
│      ├─ timestamp                                    │
│      └─ persistent sequence                          │
│              │                                       │
│              ▼                                       │
│        TrustIoT Receiver                             │
│              │                                       │
│      ├─ trusted-device lookup                        │
│      ├─ signature verification                       │
│      ├─ anti-replay validation                       │
│      ├─ sensor plausibility checks                   │
│      └─ sensor-quality signal                        │
│              │                                       │
│              ▼                                       │
│        verifiable sensor batch                       │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│                   DATA PLANE                         │
│                                                      │
│ Storage abstraction                                  │
│      │                                               │
│      ├─ Synapse SDK / PDP [primary Filecoin path]   │
│      ├─ Filecoin Pin       [optional]                │
│      └─ Local storage      [development]             │
│                                                      │
│ PieceCID / storage reference + SHA-256               │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│                GOVERNANCE PLANE                      │
│                                                      │
│ Hyperledger Fabric                                   │
│      ├─ provenance metadata                          │
│      ├─ storage metadata                             │
│      ├─ integrity hashes                             │
│      ├─ replay-resistant state                       │
│      └─ verification records                         │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│                VERIFICATION PLANE                    │
│                                                      │
│ Batch verification                                   │
│      +                                               │
│ Artifact → storage linkage                           │
│      +                                               │
│ Storage → Fabric linkage                             │
│      │                                               │
│      ▼                                               │
│ VERIFIED / FAILED                                    │
└──────────────────────────────────────────────────────┘
```

Raw IoT streams are intentionally kept out of Fabric state.

---

## Current status — v0.1.0

The current prototype includes two related verification paths.

### Physical sensor provenance

```text
ESP32 + BME280
→ canonical reading
→ ECDSA P-256 signature
→ TrustIoT receiver
→ trusted-device verification
→ persistent anti-replay
→ sensor validation
→ batching
→ SHA-256
→ Synapse / Filecoin
→ Fabric proof
→ independent verification
```

### Dataset governance

```text
IoT dataset
→ batching
→ AES-256-GCM encryption
→ Filecoin-backed storage
→ signed public manifest
→ Hyperledger Fabric
→ independent retrieval
→ signature verification
→ SHA-256 verification
→ VERIFIED / REJECTED
```

These paths share the same architectural goal: preserve independently checkable provenance while keeping bulk IoT data outside the governance ledger.

---

## Physical device attestation

TrustIoT supports signed readings originating from ESP32 devices.

A canonical device reading contains:

```json
{
  "schema": "trustiot.device.attestation.v1",
  "deviceId": "esp32-01",
  "sensor": "bme280",
  "temperature": "30.55",
  "humidity": "54.46",
  "pressure": "897.64",
  "timestamp": 1788735634,
  "sequence": 123
}
```

The ESP32 signs the canonical representation using **ECDSA P-256 + SHA-256**.

The receiver then:

1. resolves the device from the trusted-device registry;
2. verifies the device signature;
3. validates the sequence number;
4. rejects replayed sequences;
5. checks basic sensor plausibility;
6. evaluates the sensor-quality signal;
7. accepts the reading into the batch.

Device public keys are configured outside source code.

Private device keys are not committed to the repository.

---

## Persistent anti-replay protection

Each trusted device maintains a monotonically increasing sequence number.

TrustIoT persists the last accepted sequence so replay protection survives process restarts.

```text
signed reading
      │
      ▼
signature verification
      │
      ▼
sequence > lastSequence ?
      │
   ┌──┴──┐
   │     │
  yes    no
   │     │
accept  REJECT
   │
persist sequence
```

Replay-state tests use an isolated temporary state file and do not modify runtime device state.

---

## Multi-device registry

Trusted devices are configured in:

```text
config/devices.json
```

Example:

```json
{
  "schema": "trustiot.device.registry.v1",
  "devices": [
    {
      "deviceId": "esp32-01",
      "sensor": "bme280",
      "publicKeyEnv": "DEVICE_ESP32_01_PUBLIC_KEY_PATH",
      "enabled": true
    }
  ]
}
```

The registry contains references to environment variables, not private keys.

---

## Sensor validation and quality

TrustIoT distinguishes between three concepts:

```text
cryptographic validity
        ≠
physical plausibility
        ≠
data quality
```

The receiver performs basic plausibility validation for environmental readings.

A separate quality detector can flag repeated identical readings as:

```text
SUSPICIOUS_STALE
```

A stale-quality signal does not automatically invalidate an otherwise authentic signed reading.

This keeps cryptographic provenance separate from sensor-quality interpretation.

---

## Verifiable sensor batches

Accepted readings are grouped into batches.

The current physical-device receiver uses batches of 60 readings.

A batch includes:

- device ID;
- sensor ID;
- start timestamp;
- end timestamp;
- reading count;
- individual readings;
- SHA-256 integrity hash.

Example schema:

```text
trustiot.sensor.batch.v1
```

The batch hash is calculated over the canonical batch payload.

---

## Filecoin storage

### Synapse / PDP

Synapse SDK / PDP is the primary Filecoin storage path used by the current prototype.

Implemented and exercised on Filecoin Calibration:

- Synapse SDK integration;
- storage readiness checks;
- PDP upload;
- PieceCID-based references;
- retrieval;
- SHA-256 verification after retrieval;
- retryable storage processing;
- benchmark measurements.

Typical metadata:

```text
storageDriver  = synapse
storageNetwork = calibration
storageRef     = PieceCID
pieceCid       = PieceCID
```

### Filecoin Pin

An optional Filecoin Pin adapter is retained for IPFS-oriented storage flows.

```text
storageDriver = filecoin-pin
storageRef    = IPFS Root CID
```

### Local storage

Local storage remains available for development and offline testing.

---

## Hyperledger Fabric

TrustIoT includes an optional Hyperledger Fabric governance layer.

Implemented functionality includes:

- Fabric Gateway client;
- test-network transactions;
- dataset registration and reads;
- verification-status updates;
- storage-neutral metadata;
- PieceCID metadata;
- idempotent registration;
- persistent nonce/replay protection;
- retry and ambiguous-commit handling;
- proof submission and read-back verification.

Fabric stores compact governance and provenance metadata rather than raw sensor streams.

---

## Gateway manifest signing

TrustIoT also supports an Ed25519-signed public-manifest path for dataset-level provenance.

This is separate from ESP32 device attestation:

```text
ESP32 device attestation
→ ECDSA P-256

Gateway / public manifest provenance
→ Ed25519
```

The dataset verification path can:

1. resolve the trusted signer;
2. reconstruct the signed manifest;
3. verify the Ed25519 signature;
4. retrieve the encrypted artifact;
5. calculate SHA-256;
6. compare it with the recorded ciphertext hash;
7. record `VERIFIED` or `REJECTED`.

---

## Independent verification

TrustIoT includes independent verification tooling for physical sensor batches.

### Batch verification

```bash
node src/verify-batch.js <artifact.json>
```

Checks include:

- artifact SHA-256;
- sequence integrity;
- device/sensor consistency;
- reading count;
- batch boundaries.

### Proof-chain verification

```bash
node src/verify-proof-chain.js <artifact.json>
```

Checks linkage across:

```text
artifact
   ↓
Synapse / Filecoin receipt
   ↓
Fabric proof
```

including:

- payload SHA-256;
- file SHA-256;
- device identity;
- sensor identity;
- reading count;
- PieceCID;
- Fabric proof state.

### Unified verification

```bash
npm run verify:trustiot -- <artifact.json>
```

The unified verifier produces both a human-readable report and structured JSON.

Example:

```json
{
  "verifier": "trustiot.independent.verifier.v1",
  "deviceId": "esp32-01",
  "batch": {
    "artifactIntegrity": true,
    "sequenceIntegrity": true,
    "batchConsistency": true,
    "verified": true
  },
  "proofChain": {
    "artifactToStorage": true,
    "storageToFabric": true,
    "pieceCid": "bafkzc...",
    "verified": true
  },
  "overallVerified": true
}
```

Tampered artifacts produce a failed verification result.

---

## Reliability

The physical-batch processing pipeline uses a persistent retry queue.

Jobs can transition through retry and recovery states when storage or proof submission temporarily fails.

Queue persistence uses temporary-file replacement rather than directly overwriting the final job file.

Malformed queue records are quarantined instead of crashing receiver startup.

This behavior is covered by an automated corruption-recovery test.

---

## Benchmarks

The repository includes benchmark tooling for Synapse/Filecoin operations.

A benchmark records fields such as:

```text
artifactSizeBytes
pieceCid
requestedCopies
uploadLatencyMs
retrievalLatencyMs
totalLatencyMs
expectedSha256
actualSha256
verified
```

Benchmark results are environment- and network-dependent and should not be interpreted as fixed performance guarantees.

---

## Requirements

- Node.js 24+
- npm
- optional ESP32 hardware for physical-device testing
- optional BME280 for environmental sensor testing
- Filecoin/Synapse credentials for live storage tests
- Hyperledger Fabric test network for Fabric integration tests

The offline security suite does not require ESP32, Filecoin, or Fabric.

---

## Install

```bash
npm install
```

---

## Offline verification suite

Run the deterministic offline suite:

```bash
npm run test:trustiot
```

It covers:

- core batch and manifest behavior;
- signed-manifest verification;
- tamper rejection;
- trusted signer policy;
- device signature verification;
- unknown-device rejection;
- device-reading tamper detection;
- replay protection;
- stale-sensor detection;
- persistent queue corruption recovery.

The offline suite uses isolated test state and does not require live infrastructure.

Individual groups can also be run with:

```bash
npm run test:unit
npm run test:attestation
npm run test:reliability
```

---

## Integration tests

Fabric integration:

```bash
npm run test:integration
```

Synapse/Filecoin integration:

```bash
npm run test:synapse
```

These tests require the corresponding external infrastructure and configuration.

---

## Local development path

```bash
export STORAGE_DRIVER=local
export LEDGER_DRIVER=local

npm run demo
```

---

## Synapse / Filecoin Calibration

Supply credentials outside the repository:

```bash
export SYNAPSE_PRIVATE_KEY='0x...'
export STORAGE_DRIVER=synapse
export LEDGER_DRIVER=local

npm run demo
```

Never commit wallet credentials or private keys.

---

## Fabric-governed dataset path

With Fabric configured:

```bash
export STORAGE_DRIVER=synapse
export LEDGER_DRIVER=fabric

npm run demo
```

Dataset verification:

```bash
npm run verify -- <datasetId>
```

---

## Repository structure

```text
trustiot/
├── receiver.js
├── config/
│   └── devices.json
├── src/
│   ├── adapters/
│   ├── core/
│   │   ├── attestation/
│   │   │   ├── canonicalDeviceReading.js
│   │   │   ├── deviceRegistry.js
│   │   │   ├── deviceRegistryLoader.js
│   │   │   ├── sensorQuality.js
│   │   │   └── verifyDeviceAttestation.js
│   │   └── verification/
│   │       ├── verifyBatch.js
│   │       └── verifyProofChain.js
│   ├── private/
│   │   └── retryQueue.js
│   ├── verify-batch.js
│   ├── verify-proof-chain.js
│   └── verify-trustiot.js
├── chaincode/
├── fabric/
├── tests/
├── docs/
├── examples/
├── PROJECT_STATUS.md
└── package.json
```

---

## Secret management

The repository excludes runtime and secret material such as:

```text
.env
*.env
data/*
artifacts/
data/private/device-keys/
```

with `data/.gitkeep` retained.

Do not commit:

- ESP32 private keys;
- wallet credentials;
- Fabric private identities;
- encryption keys;
- generated runtime artifacts;
- private device state.

Production deployments should replace development key files and environment variables with an appropriate KMS, HSM, secure element, or secrets-management system.

---

## Security model

TrustIoT v0.1.0 demonstrates:

- authenticated device-origin readings;
- signed dataset manifests;
- tamper detection;
- persistent replay protection;
- sensor plausibility checks;
- sensor-quality signaling;
- verifiable batching;
- storage integrity verification;
- Filecoin storage linkage;
- Fabric proof linkage;
- independent verification;
- crash-tolerant retry recovery.

It is a prototype and has **not** undergone a third-party security audit.

---

## Development boundaries

The current release is not presented as production-ready infrastructure.

Future hardening includes:

- secure-element-backed ESP32 private keys;
- production KMS/HSM integration;
- production wallet strategy;
- Filecoin Mainnet deployment configuration;
- production Fabric identity management;
- broader fault-injection testing;
- external security review;
- operational monitoring and dashboard tooling.

---

## Design principle

```text
Physical devices = origin evidence
Filecoin         = data plane
Fabric           = governance / provenance plane
Verifier         = independent evidence check
```

Each layer can evolve independently while preserving explicit verification boundaries.

---

## License

Apache-2.0.

See the repository license terms before production or downstream redistribution.
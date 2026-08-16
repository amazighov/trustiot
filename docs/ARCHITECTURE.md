# TrustIoT Architecture v0.2

## 1. Problem

Organizations using IoT often face several conflicting requirements:

- durable storage of growing sensor datasets;
- verifiable provenance and tamper evidence;
- authenticated device and gateway identities;
- replay resistance;
- controlled sharing between known institutions;
- independent verification of stored artifacts.

Storing full IoT payloads directly on a permissioned ledger is inefficient and creates privacy and retention problems.

TrustIoT therefore separates the physical edge, encrypted data storage, and institutional governance planes.

---

## 2. Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                    EDGE / DEVICE PLANE                       │
│                                                              │
│ ESP32 / Simulator                                            │
│       │                                                      │
│       ▼                                                      │
│ Device identity → validation → readings → batching           │
│                                      │                       │
│                                      ▼                       │
│                              AES-256-GCM                     │
└──────────────────────────────────────┬───────────────────────┘
                                       │ encrypted artifact
                                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    FILECOIN DATA PLANE                       │
│                                                              │
│                    Storage Adapter                           │
│                          │                                   │
│       ┌──────────────────┼──────────────────┐                │
│       ▼                  ▼                  ▼                │
│ Synapse SDK / PDP   Filecoin Pin        Local               │
│    [primary]         [optional]       [development]          │
│       │                  │                                   │
│       ▼                  ▼                                   │
│   PieceCID          IPFS Root CID                            │
└──────────────────────────────────────┬───────────────────────┘
                                       │
                                       │ storage metadata
                                       │ + ciphertext SHA-256
                                       │ + signed manifest
                                       ▼
┌──────────────────────────────────────────────────────────────┐
│                 FABRIC GOVERNANCE PLANE                      │
│                                                              │
│ Dataset provenance                                           │
│ Storage metadata                                             │
│ Gateway signature metadata                                   │
│ Persistent anti-replay state                                 │
│ Verification status                                          │
│ Audit / governance records                                   │
└──────────────────────────────────────┬───────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────┐
│                   VERIFICATION PLANE                         │
│                                                              │
│ Trusted signer lookup                                        │
│        ↓                                                     │
│ Ed25519 manifest verification                                │
│        ↓                                                     │
│ Storage-driver-specific retrieval                            │
│        ↓                                                     │
│ SHA-256 verification                                         │
│        ↓                                                     │
│ VERIFIED / REJECTED → Fabric                                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Architectural principle

TrustIoT uses three primary planes:

### Edge plane

Responsible for:

- physical devices;
- device identity;
- reading validation;
- batching;
- gateway processing.

### Data plane

Responsible for:

- encrypted dataset storage;
- Filecoin-backed persistence;
- PieceCID / IPFS storage references;
- independent artifact retrieval.

### Governance plane

Responsible for:

- provenance;
- organizational governance;
- signatures;
- replay protection;
- verification status;
- audit metadata.

The system intentionally avoids storing raw IoT payloads in Fabric.

---

## 4. Why Filecoin remains the data plane

TrustIoT remains useful even if Hyperledger Fabric is removed.

Filecoin performs the main storage function:

```text
IoT dataset
→ encryption
→ Filecoin-backed storage
→ independently retrievable encrypted artifact
```

Fabric adds an optional enterprise governance profile for organizations requiring:

- membership-based identities;
- endorsement policies;
- multi-party governance;
- private data collections;
- auditable verification state.

TrustIoT therefore remains a Filecoin-oriented IoT data system rather than a Fabric application with Filecoin added afterward.

---

## 5. Filecoin storage architecture

TrustIoT uses a storage abstraction rather than assuming that every Filecoin storage mechanism exposes an IPFS CID.

### 5.1 Synapse SDK / PDP

Synapse/PDP is the primary storage path in v0.2.

```text
Encrypted artifact
      ↓
Synapse SDK
      ↓
PDP storage provider
      ↓
PieceCID
```

Typical metadata:

```json
{
  "storageDriver": "synapse",
  "storageNetwork": "calibration",
  "storageRef": "bafkzc...",
  "pieceCid": "bafkzc...",
  "ipfsRootCid": null,
  "cid": null
}
```

The PieceCID is the primary storage reference for this path.

### 5.2 Filecoin Pin

Filecoin Pin remains available as an optional IPFS-oriented adapter.

```text
Encrypted artifact
      ↓
Filecoin Pin
      ↓
Filecoin-backed storage
      ↓
IPFS Root CID
```

Typical metadata:

```json
{
  "storageDriver": "filecoin-pin",
  "storageNetwork": "calibration",
  "storageRef": "bafy...",
  "pieceCid": "bafkzc...",
  "ipfsRootCid": "bafy...",
  "cid": "bafy..."
}
```

### 5.3 Local storage

Local storage is retained for development and testing.

```json
{
  "storageDriver": "local",
  "storageNetwork": null,
  "storageRef": "data/storage/...",
  "pieceCid": null,
  "ipfsRootCid": null,
  "cid": null
}
```

---

## 6. Dataset lifecycle

### Step A — Ingest

Readings originate from either the simulator or a physical ESP32.

A logical reading contains fields such as:

```json
{
  "deviceId": "farm-001/temp-01",
  "timestamp": "2026-08-16T10:00:00Z",
  "type": "temperature",
  "value": 28.4,
  "unit": "C",
  "sequence": 1452
}
```

TrustIoT also contains a trusted-device layer for authenticated device readings.

Implemented on the gateway side:

- trusted device registry;
- signed-reading validation;
- unknown-device rejection;
- tamper detection.

Direct Ed25519 signing on the ESP32 firmware is planned but is not yet part of the completed v0.2 path.

### Step B — Batch

Readings are grouped into canonical datasets.

The current batch schema is:

```text
trustiot.batch.v1
```

NDJSON is used because it is simple to inspect, stream, hash and process.

### Step C — Encrypt

The gateway generates a per-dataset encryption key and encrypts the batch using:

```text
AES-256-GCM
```

The encrypted artifact is hashed using SHA-256.

Encryption keys are not stored in Filecoin or public Fabric state.

### Step D — Store

The encrypted artifact is sent through the configured storage adapter:

```text
STORAGE_DRIVER=synapse
STORAGE_DRIVER=filecoin-pin
STORAGE_DRIVER=local
```

The adapter returns storage-neutral metadata.

### Step E — Build manifest

TrustIoT constructs a public manifest containing:

```json
{
  "datasetId": "uuid",
  "deviceId": "farm-001/temp-01",
  "ownerOrg": "FarmOrg",
  "storageDriver": "synapse",
  "storageNetwork": "calibration",
  "storageRef": "bafkzc...",
  "cid": null,
  "pieceCid": "bafkzc...",
  "ipfsRootCid": null,
  "ciphertextSha256": "...",
  "startedAt": "...",
  "endedAt": "...",
  "readingCount": 25,
  "encryption": "AES-256-GCM",
  "schemaVersion": "trustiot.batch.v1",
  "verificationStatus": "UNVERIFIED"
}
```

### Step F — Sign

The gateway signs the canonical public manifest using Ed25519.

The signed record contains:

```text
signerId
signedAt
nonce
signature
signatureAlgorithm
```

### Step G — Register

The manifest and signature metadata are submitted to Hyperledger Fabric.

Fabric also atomically records the signer nonce to prevent replay.

### Step H — Verify

Verification does not assume a specific storage technology.

```text
Fabric record
      ↓
trusted signer lookup
      ↓
reconstruct signed manifest
      ↓
Ed25519 verification
      ↓
storageDriver
      │
      ├── synapse      → PieceCID → Synapse download
      ├── filecoin-pin → IPFS Root CID → IPFS retrieval
      └── local        → filesystem
      ↓
encrypted bytes
      ↓
SHA-256
      ↓
compare with Fabric record
      ↓
VERIFIED / REJECTED
```

---

## 7. Cryptographic provenance

TrustIoT uses Ed25519 signatures for gateway provenance.

A manifest is accepted only if:

1. the signer is known;
2. the signer is ACTIVE;
3. the declared signature algorithm matches policy;
4. the signature verifies against the trusted public key;
5. the signed manifest has not been modified.

A valid cryptographic signature from a revoked signer is rejected.

---

## 8. Replay protection

TrustIoT implements two levels of replay-related controls.

### Gateway validation

Signed payloads contain:

```text
timestamp
nonce
```

Timestamp windows reject stale signed requests.

### Fabric persistent protection

Fabric stores a composite nonce key based on:

```text
signerId + nonce
```

Dataset registration and nonce consumption occur atomically in the same Fabric transaction.

Therefore:

```text
first use of signerId + nonce
→ ACCEPT

second use of signerId + nonce
→ REJECT
```

This protection survives application restarts and is shared across gateway instances using the same Fabric ledger.

---

## 9. Hyperledger Fabric model

Development organizations:

- `Org1MSP` — Data Owner / Farm
- `Org2MSP` — Auditor / Laboratory

Potential future organization:

- `Org3MSP` — Regulator / Water Authority

Current public functions include:

```text
RegisterDataset
ReadDataset
DatasetExists
SetVerificationStatus
```

The development chaincode used by TrustIoT v0.2 is currently:

```text
Version: 1.5
Sequence: 6
```

Dataset records contain storage-neutral metadata including:

```text
storageDriver
storageNetwork
storageRef
cid
pieceCid
ipfsRootCid
```

as well as provenance and verification metadata.

---

## 10. Private Data Collections

Fabric Private Data Collections remain available for sensitive governance metadata.

Potential private fields include:

- exact physical sensor/site mapping;
- private access policies;
- commercial agreements;
- customer identifiers;
- sensitive approval metadata;
- key-management references.

A core rule remains:

> Public state proves what artifact and provenance record were committed; private state contains sensitive organizational context.

Raw sensor datasets and encryption keys are not stored in public Fabric state.

---

## 11. ESP32 integration

TrustIoT has completed the first physical-device integration.

```text
ESP32 DevKit V1
      ↓
Wi-Fi
      ↓
HTTP
      ↓
TrustIoT ingestion server
```

The physical device has successfully sent HTTP readings to the gateway.

The gateway also contains:

- a trusted device registry;
- independent device key pairs;
- signed-reading verification logic;
- unknown-device rejection;
- reading tamper detection.

Still planned:

```text
Ed25519 signing directly on ESP32
physical environmental sensor
persistent device-level sequence protection
```

---

## 12. Verification independence

A major v0.2 design change is that verification no longer depends directly on IPFS.

The verifier operates on:

```text
storageDriver
```

rather than assuming:

```text
CID → IPFS gateway
```

This allows TrustIoT to support different Filecoin storage mechanisms without changing the integrity or governance layers.

For example:

```text
Synapse/PDP
PieceCID
   ↓
retrieve
   ↓
SHA-256
   ↓
Fabric verification
```

and:

```text
Filecoin Pin
IPFS Root CID
   ↓
retrieve
   ↓
SHA-256
   ↓
Fabric verification
```

share the same verification pipeline.

---

## 13. Threat model

### TrustIoT currently defends against

- modification of encrypted stored artifacts;
- manifest tampering;
- unknown gateway signers;
- revoked gateway signers;
- replayed gateway nonces;
- duplicate dataset registration;
- accidental publication of raw IoT datasets;
- storage-driver substitution assumptions;
- unknown device identities at the gateway validation layer;
- tampering with signed device readings;
- ambiguous Fabric transaction responses.

### Not fully solved yet

- compromised physical sensors;
- stolen ESP32 private keys;
- secure hardware-backed device keys;
- malicious gateway firmware;
- production key rotation;
- long-term key escrow/recovery;
- metadata side-channel inference;
- production Fabric topology;
- Mainnet operational hardening.

These limitations should remain explicit in technical and grant documentation.

---

## 14. Failure and recovery model

Fabric submissions use retry and recovery logic.

A network failure after transaction submission can be ambiguous:

```text
transaction committed
+
client lost response
```

TrustIoT therefore checks ledger state before resubmitting.

Dataset registration is idempotent, and verification status updates avoid unnecessary duplicate transactions.

Structured events record registration, recovery and verification activity.

---

## 15. Testing model

TrustIoT separates normal tests from Fabric integration tests.

Core/security tests cover:

- batch creation;
- encryption integrity;
- Ed25519 signatures;
- manifest tampering;
- timestamp expiration;
- replay protection;
- trusted signer policy;
- signer revocation;
- trusted device policy;
- device-reading signatures;
- device-reading tampering.

Fabric integration tests cover persistent nonce rejection against a running Fabric network.

---

## 16. Design differentiator

The differentiator is not simply the combination of ESP32, Filecoin and Hyperledger Fabric.

It is:

> A storage-neutral, cryptographically verifiable IoT onboarding gateway that uses Filecoin as the encrypted data plane while preserving enterprise governance, provenance and auditability.

The storage abstraction is especially important:

```text
IoT application
      ↓
TrustIoT
      ↓
Storage Adapter
      ↓
Filecoin storage mechanism
```

The application does not need to understand whether the underlying Filecoin path uses Synapse/PDP, Filecoin Pin or another compatible storage implementation.

---

## 17. Current v0.2 architecture summary

```text
Physical / Simulated IoT
          ↓
Trusted Device Layer
          ↓
TrustIoT Gateway
          ↓
Batch
          ↓
AES-256-GCM
          ↓
SHA-256
          ↓
Storage Adapter
    ┌─────┼──────────┐
    ↓     ↓          ↓
Synapse  Pin        Local
 / PDP   / IPFS
    ↓     ↓
PieceCID IPFS CID
    └─────┬──────────┘
          ↓
Signed Public Manifest
          ↓
Hyperledger Fabric
          ↓
Trusted Signer Verification
          ↓
Storage-Specific Retrieval
          ↓
SHA-256 Verification
          ↓
VERIFIED / REJECTED
```

---

## 18. Next architectural steps

- execute Ed25519 signing directly on ESP32;
- integrate a physical environmental sensor;
- move trusted-device enrollment/revocation into Fabric;
- add persistent device-level replay protection;
- add automated Synapse storage integration tests;
- add Mainnet configuration;
- introduce production KMS / secret management;
- define key rotation and recovery policies;
- design a production Fabric topology.
# TrustIoT Milestones

This document tracks the implementation roadmap for TrustIoT.

TrustIoT v0.2 evolves the original MVP into a storage-neutral, cryptographically verifiable IoT data onboarding gateway using Filecoin as the encrypted data plane and Hyperledger Fabric as the governance and provenance plane.

---

## Milestone 0 — Architecture + Runnable Local Slice

**Status: COMPLETE**

### Goal

Establish the initial TrustIoT architecture and prove that the complete data lifecycle can run locally without requiring Filecoin or Hyperledger Fabric.

### Deliverables

- [x] Repository structure
- [x] Sensor simulator
- [x] Canonical batch generation
- [x] NDJSON dataset format
- [x] AES-256-GCM encryption
- [x] Ciphertext SHA-256 integrity hash
- [x] Storage abstraction
- [x] Local storage implementation
- [x] Local ledger implementation
- [x] Initial Filecoin Pin adapter
- [x] Fabric chaincode skeleton
- [x] Public manifest model
- [x] Architecture documentation
- [x] Grant strategy
- [x] Runnable local vertical slice

### Data flow

```text
Simulated IoT readings
        ↓
Canonical batch
        ↓
AES-256-GCM encryption
        ↓
Local storage
        ↓
Public manifest
        ↓
Local governance record
```

### Exit test

```bash
npm run demo
```

Expected result:

```text
readings generated
→ encrypted dataset created
→ storage receipt generated
→ public manifest created
→ governance record written
```

**Exit test: PASSED**

---

# Milestone 1 — Filecoin Vertical Integration

**Status: COMPLETE / EVOLVED IN v0.2**

## Goal

Store encrypted TrustIoT datasets using Filecoin-backed storage while keeping the application independent from a specific storage implementation.

The original TrustIoT v0.1 implementation used Filecoin Pin as the primary storage path.

TrustIoT v0.2 evolves this design by making Synapse SDK / PDP the primary storage path while retaining Filecoin Pin as an optional adapter.

---

## 1.1 Filecoin Pin integration

### Implemented

- [x] Filecoin Pin adapter
- [x] Calibration-network uploads
- [x] encrypted TrustIoT artifact uploads
- [x] IPFS Root CID extraction
- [x] PieceCID extraction where available
- [x] provider metadata parsing
- [x] multiple storage copies
- [x] IPFS retrieval
- [x] ciphertext SHA-256 verification
- [x] Filecoin Pin storage receipts
- [x] Filecoin Pin metadata in public manifests
- [x] Filecoin Pin metadata in Fabric

### Filecoin Pin model

```text
Encrypted artifact
        ↓
Filecoin Pin
        ↓
Filecoin-backed providers
        ↓
IPFS Root CID
        +
PieceCID
```

Typical metadata:

```json
{
  "storageDriver": "filecoin-pin",
  "storageNetwork": "calibration",
  "storageRef": "bafy...",
  "cid": "bafy...",
  "pieceCid": "bafkzc...",
  "ipfsRootCid": "bafy..."
}
```

---

## 1.2 Synapse SDK / PDP integration

### Implemented

- [x] `@filoz/synapse-sdk` integration
- [x] `viem` account integration
- [x] Calibration network initialization
- [x] wallet initialization
- [x] storage readiness checks
- [x] `storage.prepare()` integration testing
- [x] deposit requirement inspection
- [x] payment readiness inspection
- [x] live Synapse uploads
- [x] PDP-backed storage
- [x] PieceCID extraction
- [x] multiple storage copies
- [x] encrypted TrustIoT artifact upload
- [x] Synapse download
- [x] PieceCID-based retrieval
- [x] SHA-256 verification after retrieval
- [x] Synapse storage adapter
- [x] Synapse metadata in public manifests
- [x] Synapse metadata in Fabric

### Synapse model

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
  "cid": null,
  "pieceCid": "bafkzc...",
  "ipfsRootCid": null
}
```

---

## 1.3 Storage abstraction

TrustIoT v0.2 supports:

```text
StorageAdapter
      |
      +── Synapse / PDP      [primary]
      |
      +── Filecoin Pin       [optional]
      |
      +── Local              [development]
```

Implemented:

- [x] storage-neutral manifest metadata
- [x] storage-driver-independent retrieval
- [x] storage-driver-independent SHA-256 verification
- [x] Synapse retrieval
- [x] Filecoin Pin / IPFS retrieval
- [x] local filesystem retrieval

### Exit test

```text
TrustIoT encrypted batch
        ↓
Synapse / PDP
        ↓
PieceCID
        ↓
retrieve by PieceCID
        ↓
SHA-256
        ↓
expected hash == actual hash
        ↓
VERIFIED
```

**Exit test: PASSED**

### Remaining production work

- [ ] Mainnet configuration
- [ ] automated Synapse integration test suite
- [ ] storage latency benchmarks
- [ ] storage cost benchmarks
- [ ] provider availability monitoring
- [ ] production payment monitoring
- [ ] production wallet strategy

---

# Milestone 2 — Hyperledger Fabric Integration

**Status: COMPLETE FOR DEVELOPMENT TEST NETWORK**

## Goal

Provide an enterprise governance and provenance layer without storing raw IoT datasets directly on the blockchain.

---

## 2.1 Fabric network

Implemented:

- [x] Hyperledger Fabric test network
- [x] Org1MSP configuration
- [x] Org2MSP configuration
- [x] Fabric channel
- [x] chaincode deployment
- [x] chaincode upgrades
- [x] Org1 approval
- [x] Org2 approval

Current development chaincode:

```text
TrustIoT
Version: 1.5
Sequence: 6
```

---

## 2.2 Fabric Gateway

Implemented:

- [x] Fabric Gateway client
- [x] Gateway connection
- [x] TLS configuration
- [x] MSP identity loading
- [x] dataset registration
- [x] dataset reads
- [x] dataset existence checks
- [x] verification-status updates
- [x] Fabric transaction IDs

---

## 2.3 Public dataset registry

Fabric stores compact provenance and integrity metadata rather than raw IoT data.

Implemented fields include:

```text
datasetId
deviceId
ownerOrg

storageDriver
storageNetwork
storageRef

cid
pieceCid
ipfsRootCid

ciphertextSha256

startedAt
endedAt
readingCount

encryption
schemaVersion
createdAt

signerId
signedAt
nonce
signature
signatureAlgorithm

verificationStatus
```

---

## 2.4 Storage-neutral Fabric records

Fabric no longer assumes every dataset has an IPFS CID.

Implemented:

- [x] local storage metadata
- [x] Filecoin Pin metadata
- [x] Synapse metadata
- [x] PieceCID support
- [x] IPFS Root CID support
- [x] storage network metadata
- [x] nullable generic CID

Synapse example:

```json
{
  "storageDriver": "synapse",
  "storageNetwork": "calibration",
  "storageRef": "bafkzc...",
  "cid": null,
  "pieceCid": "bafkzc...",
  "ipfsRootCid": null
}
```

---

## 2.5 Private Data Collections

Implemented:

- [x] Private Data Collection configuration

Planned application-level private governance:

- [ ] private dataset policy workflow
- [ ] private access approvals
- [ ] organization-specific private metadata
- [ ] private policy query API

---

## 2.6 End-to-end Synapse + Fabric flow

Successfully demonstrated:

```text
IoT batch
        ↓
AES-256-GCM
        ↓
Synapse / PDP
        ↓
PieceCID
        ↓
Signed public manifest
        ↓
Fabric RegisterDataset
        ↓
Fabric ReadDataset
        ↓
Stored signature verification
        ↓
Synapse retrieval
        ↓
SHA-256 verification
        ↓
Fabric SetVerificationStatus
        ↓
VERIFIED
```

**Core exit test: PASSED**

### Remaining production work

- [ ] production Fabric topology
- [ ] production certificate lifecycle
- [ ] expanded endorsement-policy testing
- [ ] multi-organization pilot deployment
- [ ] dataset history API
- [ ] richer governance queries
- [ ] production monitoring

---

# Milestone 3 — Reliability + Security

**Status: SUBSTANTIALLY COMPLETE**

## Goal

Ensure that TrustIoT remains correct and secure under retries, replay attempts, network failures, signer changes and ambiguous blockchain responses.

---

## 3.1 Gateway identity

Implemented:

- [x] independent gateway Ed25519 key pair
- [x] gateway signer identity
- [x] canonical manifest signing
- [x] Ed25519 signatures
- [x] signature metadata
- [x] signature verification

Gateway identity example:

```text
gateway-farm-001
        ↓
trusted public key
        ↓
Ed25519 verification
```

---

## 3.2 Manifest integrity

Implemented:

- [x] canonical signed manifest
- [x] signature verification
- [x] manifest tamper detection
- [x] ciphertext SHA-256 integrity verification
- [x] stored signature metadata on Fabric
- [x] stored signature verification before retrieval

Verification sequence:

```text
Fabric record
        ↓
Trusted signer lookup
        ↓
Reconstruct original manifest
        ↓
Ed25519 verification
        ↓
Storage retrieval
        ↓
SHA-256 verification
```

---

## 3.3 Trusted signer registry

Implemented:

- [x] trusted signer registry
- [x] ACTIVE signer state
- [x] unknown signer rejection
- [x] REVOKED signer state
- [x] revoked signer rejection
- [x] signature algorithm validation

Policy:

```text
valid signature
+
ACTIVE trusted signer
=
ACCEPT
```

while:

```text
valid signature
+
REVOKED signer
=
REJECT
```

---

## 3.4 Replay protection

Implemented:

- [x] nonce generation
- [x] timestamp validation
- [x] timestamp expiration
- [x] in-memory replay detection
- [x] persistent Fabric nonce state
- [x] atomic nonce consumption
- [x] signerId + nonce composite key
- [x] replay rejection inside chaincode

Persistent Fabric rule:

```text
first signerId + nonce
        ↓
ACCEPT

same signerId + nonce again
        ↓
REJECT
```

Persistent replay protection survives:

- application restart;
- gateway restart;
- multiple gateway instances using the same Fabric ledger.

---

## 3.5 Idempotency

Implemented:

- [x] DatasetExists check
- [x] idempotent dataset registration
- [x] already-existing dataset recovery
- [x] verification-status idempotency
- [x] statusAlreadySet handling

---

## 3.6 Retry and recovery

Implemented:

- [x] transient Fabric error classification
- [x] ECONNREFUSED handling
- [x] ECONNRESET handling
- [x] UNAVAILABLE handling
- [x] deadline failure handling
- [x] exponential retry
- [x] ambiguous transaction recovery

TrustIoT handles:

```text
transaction submitted
        ↓
Fabric commits
        ↓
client loses response
```

by checking ledger state before resubmitting.

---

## 3.7 Fault injection

Implemented:

- [x] simulated post-commit connection reset
- [x] ambiguous response-loss recovery test
- [x] recovery event logging

---

## 3.8 Structured logging

Implemented Fabric events include:

```text
FABRIC_REGISTER_START
FABRIC_REGISTER_SUCCESS
FABRIC_REGISTER_ALREADY_EXISTS
FABRIC_REGISTER_RETRY
FABRIC_REGISTER_RECOVERED
FABRIC_REGISTER_FAILED

FABRIC_STATUS_UPDATED
FABRIC_STATUS_ALREADY_SET
```

---

## 3.9 Automated security tests

Implemented tests include:

- [x] encryption integrity
- [x] valid Ed25519 signature
- [x] tampered signed manifest
- [x] replayed nonce
- [x] expired timestamp
- [x] trusted signer
- [x] unknown signer
- [x] revoked signer
- [x] trusted device
- [x] unknown device
- [x] signed device reading
- [x] tampered device reading
- [x] device validation
- [x] persistent Fabric replay integration test

### Remaining security hardening

- [ ] production KMS/HSM integration
- [ ] gateway key rotation
- [ ] production secret management
- [ ] persistent job queue
- [ ] operational metrics
- [ ] formal incident response procedure
- [ ] key recovery policy
- [ ] formal external security review

---

# Milestone 4 — Real Device + Device Identity

**Status: IN PROGRESS**

## Goal

Move TrustIoT from simulated IoT data toward authenticated physical devices.

---

## 4.1 ESP32 hardware bring-up

Hardware:

```text
ESP32 DevKit V1
ESP32-D0WD-V3
```

Implemented:

- [x] USB-C connection
- [x] CP2102 USB-to-UART driver
- [x] COM port detection
- [x] Arduino ESP32 core
- [x] firmware compilation
- [x] firmware upload
- [x] Serial Monitor
- [x] basic firmware test
- [x] Wi-Fi initialization
- [x] Wi-Fi connectivity
- [x] local IP acquisition

---

## 4.2 ESP32 → TrustIoT communication

Implemented:

```text
ESP32
        ↓
Wi-Fi
        ↓
HTTP POST
        ↓
Windows host
        ↓
port forwarding
        ↓
WSL
        ↓
TrustIoT ingestion server
```

Successful response:

```json
{
  "accepted": true
}
```

Implemented:

- [x] HTTP ingestion server
- [x] `/api/readings`
- [x] JSON ingestion
- [x] ESP32 HTTP client
- [x] ESP32 → TrustIoT communication

---

## 4.3 Device identity

TrustIoT uses a separate identity for physical devices.

Example:

```text
farm-001/esp32-01
```

This identity is intentionally separate from the gateway identity:

```text
Gateway:
gateway-farm-001

Device:
farm-001/esp32-01
```

Implemented:

- [x] independent device Ed25519 key pair
- [x] trusted device registry
- [x] ACTIVE device policy
- [x] unknown-device rejection
- [x] signed device-reading model
- [x] device-reading verification
- [x] reading tamper detection
- [x] authenticated gateway ingestion validation

---

## 4.4 Signed device reading model

Current logical signed-reading model:

```json
{
  "deviceId": "farm-001/esp32-01",
  "sequence": 1,
  "timestamp": "2026-08-16T12:00:00.000Z",
  "temperature": 24.5,
  "nonce": "...",
  "signature": "...",
  "signatureAlgorithm": "Ed25519"
}
```

Implemented on TrustIoT:

- [x] canonical reading payload
- [x] Ed25519 signing model
- [x] signature verification
- [x] trusted-device lookup
- [x] tamper rejection

Still planned:

- [ ] Ed25519 signing directly inside ESP32 firmware
- [ ] secure private-key storage on ESP32
- [ ] hardware-backed device keys

---

## 4.5 Device-level replay protection

Current status:

- [x] sequence field defined
- [x] nonce field defined
- [x] timestamp field defined

Still planned:

- [ ] persistent device sequence state
- [ ] duplicate sequence rejection
- [ ] persistent device nonce state
- [ ] device replay state in Fabric
- [ ] cross-gateway device replay protection

---

## 4.6 Physical sensor integration

Current state:

```text
ESP32 hardware operational
sensor not yet integrated
```

Planned:

- [ ] environmental sensor
- [ ] real temperature measurement
- [ ] real humidity measurement
- [ ] real pressure measurement
- [ ] sensor health checks
- [ ] physical readings replacing simulator values

Target path:

```text
Physical sensor
        ↓
ESP32
        ↓
authenticated reading
        ↓
TrustIoT Gateway
```

---

# Milestone 5 — Developer SDK + Operational Integration

**Status: PLANNED**

## Goal

Make TrustIoT easy for external developers and organizations to deploy and integrate.

### Deliverables

- [ ] stable ingestion API
- [ ] TrustIoT client SDK
- [ ] improved TrustIoT CLI
- [ ] storage-driver configuration
- [ ] standardized device enrollment
- [ ] standardized device revocation
- [ ] verification API
- [ ] dataset query API
- [ ] health endpoint
- [ ] readiness endpoint
- [ ] metrics endpoint
- [ ] structured operational logs
- [ ] Dockerized TrustIoT Gateway
- [ ] reproducible developer environment
- [ ] environment validation tooling
- [ ] one-command development startup

### Target developer flow

```text
clone repository
        ↓
configure environment
        ↓
start local dependencies
        ↓
start TrustIoT
        ↓
ingest sample/device data
        ↓
store through Synapse
        ↓
register in Fabric
        ↓
verify dataset
```

### Exit test

A new developer can reproduce the complete TrustIoT development environment without manual architecture knowledge.

---

# Milestone 6 — Mainnet + Pilot Proof

**Status: PLANNED**

## Goal

Move TrustIoT from development infrastructure toward a real Filecoin-backed IoT pilot
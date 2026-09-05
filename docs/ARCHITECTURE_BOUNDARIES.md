# TrustIoT Architecture Boundaries

## Purpose

TrustIoT follows an Open Core architecture with a private enterprise layer.

The goal is to enable public adoption, reproducible demonstrations, grants,
and ecosystem integrations without exposing the complete commercial
implementation.

---

## 1. Open Core

Components intended to be potentially public:

- TrustIoT sensor schemas
- Artifact and batch schemas
- Basic SHA-256 verification primitives
- Storage adapter interfaces
- Basic Filecoin/Synapse integration examples
- ESP32 reference examples
- BME280 reference integration
- Basic artifact creation
- Public verification APIs
- Hyperledger Fabric proof interfaces
- Minimal proof/receipt chaincode
- Developer documentation

The Open Core should be sufficient to:

- understand the protocol
- integrate a device
- create a TrustIoT artifact
- verify artifact integrity
- reproduce a basic demonstration

It should NOT contain the complete enterprise operating system.

---

## 2. Private Enterprise Engine

Commercially sensitive components remain private.

Examples:

- Persistent processing queues
- Fault-tolerant orchestration
- Retry and recovery policies
- Deployment automation
- Fleet orchestration
- Advanced monitoring
- Alerting
- Advanced policy engine
- Trust/risk scoring
- Anomaly and fraud detection logic
- Enterprise security logic
- Secret-management integration
- Enterprise connectors
- Cost/storage optimization strategies
- Commercial administration features

Current private component:

`src/private/retryQueue.js`

Future sensitive components should preferably live behind private modules
with narrow interfaces to the Open Core.

---

## 3. Hyperledger Fabric Boundary

Hyperledger Fabric acts primarily as a proof and audit layer.

Fabric may contain:

- artifact hashes
- batch hashes
- device identifiers or pseudonymous identifiers
- timestamps
- PieceCID/storage references
- verification receipts
- verification status
- policy result identifiers

Fabric should NOT contain:

- private keys
- API secrets
- proprietary trust algorithms
- advanced enterprise policy logic
- orchestration logic
- commercially sensitive security logic

Sensitive data should use appropriate privacy mechanisms when required.

The enterprise engine computes sensitive decisions.
Fabric records the minimum verifiable proof necessary to audit them.

---

## 4. Filecoin / Synapse Boundary

Filecoin/Synapse stores verifiable artifacts and batches.

TrustIoT records:

- payload SHA-256
- artifact SHA-256
- PieceCID
- network
- replication status
- retrieval verification
- storage state

Possible storage states include:

- PENDING
- PROCESSING
- STORE_FAILED
- STORED_NOT_COMMITTED
- PARTIAL
- COMMITTED
- VERIFIED

Storage-provider failures must not cause sensor artifacts to be lost.

---

## 5. Public Evidence

Evidence may be published without publishing the Private Enterprise Engine.

Examples:

- architecture diagrams
- benchmark results
- PieceCIDs
- artifact hashes
- retrieval verification results
- latency measurements
- replication results
- screenshots
- demo videos
- sample artifacts
- reproducible public demonstrations

Public Evidence demonstrates that TrustIoT works without exposing all
commercial implementation details.

---

## 6. Repository Policy

The current development repository remains private.

Do not make the entire development repository public.

If a public repository is required for a grant, hackathon, ecosystem program,
or developer adoption:

1. Create a separate public repository.
2. Export only approved Open Core components.
3. Add approved Public Evidence.
4. Exclude Private Enterprise Engine code.
5. Exclude secrets, runtime state, private configuration, and credentials.
6. Review licensing requirements before publication.

A GitHub repository must never contain:

- private keys
- seed phrases
- wallet secrets
- passwords
- production credentials
- `.env` secrets

---

## 7. Feature Classification Rule

Before implementing a significant new feature, classify it as:

OPEN_CORE

PRIVATE_ENTERPRISE

PUBLIC_EVIDENCE

If classification is unclear, default to PRIVATE_ENTERPRISE until reviewed.

---

## 8. Current Architecture

BME280
  |
  v
ESP32
  |
  | HTTP / JSON
  v
TrustIoT Receiver
  |
  v
60-reading Batch
  |
  +--> SHA-256 verification
  |
  v
Private Persistent Processing
  |
  v
Synapse / Filecoin
  |
  +--> storage
  +--> retrieval
  +--> verification
  |
  v
TrustIoT Ledger
  |
  v
Hyperledger Fabric Proof Layer (planned)

---

## Principle

Open enough to integrate and verify.

Private enough to preserve commercial differentiation.

Verifiable enough that users do not need to blindly trust TrustIoT.

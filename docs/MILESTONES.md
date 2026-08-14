# Milestones

## Milestone 0 — Architecture + runnable local slice
**Status: started**

Deliverables:
- repository structure
- sensor simulator
- batch generation
- AES-256-GCM encryption
- storage abstraction
- local storage implementation
- local ledger implementation
- Filecoin Pin CLI adapter
- Fabric chaincode skeleton
- architecture and grant strategy

Exit test:
- `npm run demo` produces an encrypted dataset plus governance record.

## Milestone 1 — Filecoin vertical integration

Deliverables:
- Calibration-network upload using Filecoin Pin
- robust CID/dataset-ID parsing
- retry-safe pending state
- retrieval + ciphertext integrity verification
- Filecoin storage status command
- benchmark: size, upload latency, cost metadata where available

Exit test:
- 100 generated batches can be uploaded/reconciled without losing manifests.

## Milestone 2 — Hyperledger Fabric integration

Deliverables:
- Fabric 2.5 LTS test network
- TrustIoT chaincode deployment
- Fabric Gateway TypeScript client
- public dataset registry
- Private Data Collection for sensitive policy metadata
- endorsement policy tests

Exit test:
- Org1 registers a Filecoin dataset, Org2 independently verifies the public record, and private policy fields remain invisible to unauthorized peers.

## Milestone 3 — Reliability + security

Deliverables:
- device keypair identity
- signed readings
- anti-replay sequence checks
- persistent job queue
- idempotent Filecoin/Fabric writes
- key-management abstraction
- metrics and structured logs
- threat-model review

## Milestone 4 — Real device + SDK

Deliverables:
- ESP32 example
- MQTT/HTTP ingestion adapter
- TrustIoT SDK or CLI
- end-to-end demo
- developer documentation

## Milestone 5 — Grant/pilot proof

Deliverables:
- agriculture/water reference deployment
- reproducible demo dataset
- one-command local developer setup
- benchmark report
- grant submission package

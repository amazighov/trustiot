# TrustIoT Architecture v0.1

## 1. Problem

Organizations using IoT often face three conflicting needs:

- long-term storage of growing sensor datasets;
- verifiable provenance and tamper evidence;
- controlled sharing between known institutions.

Storing full IoT payloads directly on a permissioned ledger is inefficient and makes privacy and retention harder. Storing everything in an ordinary cloud bucket does not provide the same decentralized, content-addressed persistence story.

TrustIoT separates storage from governance.

## 2. Architecture

```text
┌────────────────────────────────────────────────────────────┐
│                      EDGE / DEVICE PLANE                   │
│                                                            │
│ Sensors → Device identity → validation → batching          │
│                                      │                     │
│                                      ▼                     │
│                              AES-256-GCM encrypt            │
└──────────────────────────────────────┬─────────────────────┘
                                       │ encrypted batch
                                       ▼
┌────────────────────────────────────────────────────────────┐
│                     FILECOIN DATA PLANE                    │
│                                                            │
│ Filecoin Pin / FOC → CID → storage proof lifecycle         │
└──────────────────────────────────────┬─────────────────────┘
                                       │ CID + cipher hash
                                       ▼
┌────────────────────────────────────────────────────────────┐
│                 FABRIC GOVERNANCE PLANE                    │
│                                                            │
│ Public state:                                              │
│ datasetId, deviceId, ownerOrg, CID, cipherHash, timestamps │
│                                                            │
│ Private Data Collections:                                  │
│ sensitive metadata, approvals, private policy references  │
└──────────────────────────────────────┬─────────────────────┘
                                       │
                                       ▼
                             API / audit dashboard
```

## 3. Why Filecoin is the center

The proposal must be valuable even if Fabric is removed. Filecoin is responsible for the main economic and technical function: durable storage of encrypted IoT datasets.

Fabric adds an enterprise governance profile for organizations that need:

- membership-based identity;
- endorsement policies;
- private data collections;
- auditable multi-party approvals.

This avoids presenting the grant as a Fabric project with Filecoin bolted on.

## 4. Dataset lifecycle

### Step A — Ingest

A reading is accepted only if it passes schema checks:

```json
{
  "deviceId": "farm-001/temp-01",
  "timestamp": "2026-08-08T10:00:00Z",
  "type": "temperature",
  "value": 28.4,
  "unit": "C",
  "sequence": 1452
}
```

Later versions add device signatures and anti-replay checks.

### Step B — Batch

Readings are grouped by device and time window. The canonical batch format is NDJSON for the MVP because it is simple to inspect, stream and hash.

### Step C — Encrypt

The gateway generates/obtains a per-dataset data encryption key and encrypts the batch with AES-256-GCM.

The MVP keeps key management local. A production design replaces this with a KMS/HSM integration.

### Step D — Store

The encrypted artifact is sent to Filecoin Pin. The returned CID becomes the storage address.

### Step E — Register

The gateway submits a public record to Fabric:

```json
{
  "datasetId": "uuid",
  "deviceId": "pseudonymous-device-id",
  "ownerOrg": "FarmOrg",
  "cid": "bafy...",
  "cipherSha256": "...",
  "startedAt": "...",
  "endedAt": "...",
  "readingCount": 100,
  "schemaVersion": "trustiot.batch.v1"
}
```

### Step F — Verify

An auditor retrieves the encrypted object using its CID, recomputes the ciphertext hash, and compares it with the governance record.

An authorized owner can additionally decrypt the payload and verify private metadata.

## 5. Privacy boundary

A key design rule is:

> Public state proves **what artifact** was committed; private state explains **sensitive context** about it.

We should not put raw sensor data on Fabric. We should also avoid public hashes of low-entropy sensitive fields when those hashes could enable guessing attacks.

## 6. Hyperledger Fabric model

MVP organizations:

- `Org1MSP` — Data Owner / Farm
- `Org2MSP` — Auditor / Laboratory

Later:

- `Org3MSP` — Regulator / Water Authority

Public chaincode functions:

- `RegisterDataset`
- `ReadDataset`
- `DatasetExists`
- `SetVerificationStatus`
- `GetDatasetHistory` (milestone 2)

Private-data functions (milestone 2):

- `PutPrivateDatasetPolicy`
- `ReadPrivateDatasetPolicy`
- `ApproveDatasetAccess`

## 7. Threat model

### We defend against

- modification of a stored encrypted artifact;
- accidental public disclosure of raw IoT payloads;
- duplicate dataset identifiers;
- unauthorized public-state mutation, subject to Fabric policy;
- mixing storage and governance responsibilities.

### Not solved in MVP

- compromised physical sensors;
- stolen device signing keys;
- malicious gateway firmware;
- side-channel inference from timestamps/metadata;
- long-term key escrow/recovery;
- production-grade Fabric topology.

These become later milestones and should be explicitly acknowledged in a grant proposal.

## 8. Differentiator

The differentiator is **not** "three technologies in one project."

It is:

> A reusable policy-controlled gateway that helps enterprise IoT systems onboard encrypted datasets to Filecoin while preserving institutional governance and audit requirements.

That positioning is much stronger for a Filecoin grant.

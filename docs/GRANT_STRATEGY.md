# Grant Strategy

## Project title

**TrustIoT — Enterprise IoT Data Onboarding Gateway for Filecoin**

## One-line pitch

An open-source gateway that encrypts, batches and stores IoT datasets on Filecoin while optionally using Hyperledger Fabric for multi-organization identity, governance and private policy metadata.

## Why it matters to Filecoin

TrustIoT should be presented as a **data onboarding + developer tooling + integration** project.

The project creates a repeatable path for a new category of data — enterprise IoT telemetry — to enter Filecoin-backed storage.

## What NOT to say

Avoid pitching it as:

- "a Hyperledger Fabric blockchain project";
- "a multi-chain experiment";
- "a smart farming dashboard";
- "a generic IoT application".

Those framings make Filecoin look secondary.

## What to emphasize

- reusable SDK/gateway, not a single demo;
- Filecoin storage consumption grows with sensor history;
- encrypted data at rest;
- verifiable CID + ciphertext integrity;
- enterprise governance is optional;
- open-source integration examples;
- measurable onboarding metrics.

## Proposed success metrics

MVP:

- 10 virtual devices
- 100,000+ generated readings
- deterministic batching
- encrypted storage artifacts
- Filecoin CID returned for each batch
- Fabric public record for each Filecoin object
- integrity verification command
- one real ESP32 integration after the software flow is stable

Pilot target:

- 3 data-owner organizations represented in Fabric
- 1 million synthetic/real readings onboarded
- >99% successful batch processing in test runs
- documented recovery for failed upload/ledger-write steps

## Critical design decision

Use a two-phase commit-like workflow at the application layer:

1. create encrypted batch;
2. upload to Filecoin;
3. receive CID;
4. register CID in Fabric;
5. if Fabric registration fails, retain the pending manifest and retry.

Do not delete the local batch until both storage and governance registration have completed.

This is important because Filecoin and Fabric do not participate in one atomic distributed transaction.

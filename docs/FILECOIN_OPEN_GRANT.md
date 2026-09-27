# Open Grant Proposal: TrustIoT — Verifiable Real-World Data Infrastructure for Filecoin

## Project

**Project Name:** TrustIoT

**Proposal Category:** Developer and Data Tooling

**Individual or Entity Name:** Hamid

**Proposer:** @amazighov

**Project Repo(s):**
https://github.com/amazighov/trustiot

**(Optional) Filecoin ecosystem affiliations:** None

**(Optional) Technical Sponsor:** None

**Do you agree to open source all work you do on behalf of this grant under the MIT/Apache-2 dual-license?:** Yes

**Reference Release:** v0.1.0-rc2

**Requested Funding:** USD 20,000


## Project Summary

TrustIoT is an open-source infrastructure layer for onboarding authenticated
real-world IoT data to Filecoin.

IoT and DePIN systems can generate valuable datasets from environmental
sensors, industrial equipment, scientific instruments, agriculture and other
physical infrastructure. However, decentralized storage alone cannot establish
whether a dataset actually originated from an expected physical device,
whether individual readings were modified before storage, or whether replayed
data was introduced into the dataset.

TrustIoT addresses this provenance gap before data reaches storage.

Physical devices cryptographically attest sensor readings. TrustIoT validates
those readings, protects the ingestion pipeline against replay, groups accepted
readings into verifiable batches, encrypts datasets, and stores them through
Filecoin-backed infrastructure.

Independent verification tooling can later validate dataset integrity and
Filecoin storage references.

A working reference implementation already exists and has been exercised with:

- ESP32 physical hardware;
- BME280 environmental sensing;
- ECDSA P-256 device-origin attestation;
- persistent anti-replay protection;
- sensor plausibility and quality checks;
- verifiable sensor batching;
- AES-256-GCM dataset encryption;
- SHA-256 integrity verification;
- Synapse/PDP integration on Filecoin Calibration;
- PieceCID-based storage references;
- retrieval verification;
- independent verification tooling;
- automated security and reliability tests.

The grant will not fund this work retroactively.

The proposed work is the next stage: turning the existing reference
implementation into reusable Filecoin data-onboarding and verification
infrastructure that other IoT and DePIN developers can reproduce and integrate.


## Why Filecoin

Filecoin provides the decentralized data layer for TrustIoT.

TrustIoT complements Filecoin by addressing provenance before storage and
independent verification after storage.

The goal is not to generate synthetic storage volume. The goal is to make
real-world datasets easier to onboard to Filecoin while preserving evidence
about their physical origin and integrity.

Potential use cases include:

- DePIN networks;
- environmental monitoring;
- scientific sensing;
- agriculture;
- industrial IoT;
- physical-world datasets used by analytics and AI systems.


## Existing Implementation

The public v0.1.0-rc2 reference implementation already provides:

- trusted physical-device identity;
- signed device readings;
- unknown-device rejection;
- tamper rejection;
- persistent per-device sequence state;
- replay protection;
- sensor plausibility validation;
- stale-data quality detection;
- canonical verifiable batches;
- encrypted dataset generation;
- Synapse/PDP Filecoin storage integration;
- PieceCID handling;
- storage retrieval;
- SHA-256 verification;
- independent batch and proof-chain verification;
- persistent retry/recovery handling;
- hostile-input HTTP security testing.

Repository:

https://github.com/amazighov/trustiot


## Impact on the Filecoin Ecosystem

TrustIoT aims to expand the types of real-world datasets that developers can
reliably onboard to Filecoin.

The grant-funded work will reduce integration friction by providing:

- a reproducible IoT-to-Filecoin reference pipeline;
- reusable Filecoin onboarding and verification tooling;
- public reference datasets and artifacts;
- structured verification reports;
- Filecoin upload/retrieval benchmarks;
- developer documentation and tutorials;
- a lightweight developer-facing verification console.

The current ESP32/BME280 deployment is a reference implementation, not the
target market or the architectural limit of TrustIoT.

Initial target users include developers working on DePIN, environmental
monitoring, scientific sensing, agriculture and industrial IoT.


## Adoption, Reach, and Growth Strategy

TrustIoT will initially target developers building DePIN, environmental
monitoring, scientific sensing, agriculture, and industrial IoT systems.

The adoption strategy begins with reproducibility rather than large
user-count claims.

During the grant period, TrustIoT will:

- publish a clean IoT-to-Filecoin reference workflow;
- publish real-world Filecoin-backed sample datasets;
- provide tutorials and integration examples;
- work with at least two external developers to independently reproduce
  the pipeline;
- document onboarding friction and improve the tooling based on that
  feedback;
- demonstrate at least one sensor or use case beyond the ESP32/BME280
  reference.

Early adoption will be measured through independent deployments, datasets
onboarded, successful Filecoin retrievals, and independent verification
rather than GitHub stars or synthetic storage volume.

The longer-term objective is to make TrustIoT reusable by organizations
that need durable Filecoin storage for authenticated physical-world datasets.

## Success Metrics

Grant success will be measured through reproducibility and meaningful Filecoin
usage rather than repository activity alone.

Targets:

- at least 2 independent external reproductions of the pipeline;
- at least 2 real-world Filecoin-backed reference datasets;
- at least 1 additional sensor or IoT use case beyond the ESP32/BME280 reference;
- published Filecoin upload, retrieval and verification benchmarks;
- 100% of published reference artifacts independently verifiable;
- reproducible clean-environment setup documentation;
- documented feedback from external onboarding attempts.


## Milestone 1 — Reproducible IoT-to-Filecoin Onboarding

**Funding:** USD 6,000
**Timeline:** Weeks 1–6

**Team:** Hamid — Project Lead and Developer
### Goal

Turn the existing reference implementation into a workflow that an external
developer can reproduce from a clean environment.

### Deliverables

- documented Synapse/PDP setup;
- reproducible IoT-to-Filecoin Calibration tutorial;
- public authenticated IoT sample dataset;
- automated upload → PieceCID → retrieval → verification workflow;
- setup and troubleshooting documentation;
- clean-environment reproduction instructions.

### Acceptance Criteria

A clean environment can:

1. install TrustIoT;
2. ingest a reference dataset;
3. upload it through Synapse/PDP;
4. obtain the Filecoin storage reference;
5. retrieve the stored artifact;
6. independently verify its integrity and provenance.


## Milestone 2 — Filecoin Verification Toolkit and Developer Console

**Funding:** USD 8,000
**Timeline:** Weeks 7–14

**Team:** Hamid — Project Lead and Developer
### Goal

Make Filecoin-backed IoT verification reusable and easier for developers.

### Deliverables

- reusable Filecoin verification toolkit;
- CLI/API-accessible structured verification results;
- PieceCID and storage-reference inspection;
- human-readable verification reports;
- machine-readable verification reports;
- lightweight TrustIoT Developer Console;
- automated integration and security tests;
- developer documentation and examples.

The Developer Console will remain a thin interface over TrustIoT's verification
core. It will not become an independent trust decision layer and will not
expose private device keys or wallet credentials.

### Acceptance Criteria

A user can select a reference artifact, inspect its Filecoin storage reference,
run independent verification, and receive a clear VERIFIED or FAILED result
with a structured explanation.


## Milestone 3 — Public Reference Deployments and Adoption

**Funding:** USD 6,000
**Timeline:** Weeks 15–20

**Team:** Hamid — Project Lead and Developer
### Goal

Demonstrate that the Filecoin integration is reusable beyond the original
reference device.

### Deliverables

- at least 2 real-world Filecoin-backed reference datasets;
- at least 1 additional sensor or IoT use case;
- published upload/retrieval/verification benchmark report;
- integration tutorials;
- documented onboarding work with at least 2 external developers or projects;
- published reproduction instructions;
- documented onboarding blockers, feedback, and resulting improvements.

### Acceptance Criteria

- ≥2 real-world Filecoin-backed reference datasets;
- ≥1 additional sensor/use case;
- benchmark results publicly available;
- reproduction instructions publicly available;
- documented onboarding sessions or attempts with ≥2 external developers or projects;
- published reference artifacts independently verifiable.

### Adoption Target

The project will target at least 2 successful independent external
reproductions during the grant period. This is an adoption success target,
rather than a milestone payment dependency, because successful reproduction
also depends on external participants.

## Budget

| Milestone | Timeline | Funding |
| --- | --- | ---: |
| Reproducible IoT-to-Filecoin onboarding | Weeks 1–6 | $6,000 |
| Filecoin Verification Toolkit + Developer Console | Weeks 7–14 | $8,000 |
| Public reference deployments and adoption | Weeks 15–20 | $6,000 |
| **Total** | **20 weeks** | **$20,000** |

The requested funding is for new grant-period work. Existing TrustIoT
development is presented as evidence of execution capability and is not
being requested for retroactive reimbursement.


## Team

### Hamid — Project Lead and Developer

Hamid is the creator and current primary developer of TrustIoT.

He has built the existing reference implementation across the physical-device,
provenance, storage, verification and security-testing layers.

TrustIoT is currently maintained as an open-source project. Grant support will
allow focused development of the Filecoin-specific onboarding and verification
tooling required to make the reference implementation easier for external
developers to reproduce and adopt.


## Maintenance and Sustainability

TrustIoT will remain open source under its MIT OR Apache-2.0 dual-license model.

After the grant period, maintenance will focus on:

- compatibility with supported Filecoin/Synapse interfaces;
- security and dependency updates;
- bug fixes;
- community-reported issues;
- maintaining reproducible reference examples;
- reviewing additional sensor and IoT integrations;
- preserving backwards-compatible verification formats where practical.

Longer-term sustainability may include ecosystem funding and integration or
support work for organizations deploying TrustIoT in real-world IoT
environments.


## Risks and Mitigations

### Early-stage adoption

TrustIoT has a working reference implementation but limited external adoption.

The grant directly addresses this through reproducible onboarding and external
reproduction milestones.

### Small individual IoT payloads

Individual environmental sensor readings are small.

TrustIoT therefore measures early success through meaningful real-world dataset
onboarding and repeatable integrations rather than synthetic storage volume.

### Device key security

The current reference implementation demonstrates cryptographic device
identity but does not claim production-grade hardware-backed key protection.

Secure-element-backed key storage remains a production-hardening path.

### External infrastructure dependencies

Live Filecoin tests depend on external network and storage infrastructure.

TrustIoT maintains deterministic offline security tests and retry/recovery
mechanisms separately from live integration testing.


## Evidence

### Public Repository

https://github.com/amazighov/trustiot

### Reference Release

v0.1.0-rc2

### Reproducible Security and Reliability Suite

```bash
npm run test:trustiot
```

The suite covers core security, device attestation, tamper rejection,
persistent replay protection, sensor-quality behavior, corrupted retry-queue
recovery and hostile HTTP input handling.

### Independent Verification Tooling

The repository includes:

- `src/verify-batch.js`
- `src/verify-proof-chain.js`
- `src/verify-trustiot.js`

### Filecoin Integration and Benchmark Tooling

The repository includes:

- `src/adapters/synapseStorage.js`
- `src/synapse-benchmark.js`
- `src/benchmark-e2e.js`

The project documentation describes the Filecoin Calibration / Synapse/PDP
storage path and PieceCID-based retrieval model.

A public grant-period benchmark artifact will be published as part of the
proposed milestones rather than presenting environment-specific measurements
as fixed performance guarantees.

### Public Filecoin Calibration Evidence

The repository includes sanitized evidence from successful Filecoin
Calibration runs performed through the Synapse/PDP storage path.

Storage evidence:

`evidence/filecoin-calibration-proof.json`

This record includes:

- Filecoin Calibration network;
- a real PieceCID returned by the storage workflow;
- 2 requested copies;
- successful completion with zero failed attempts;
- measured upload and retrieval latency;
- successful storage verification.

Independent retrieval evidence:

`evidence/filecoin-retrieval-verification.json`

This record demonstrates a Synapse retrieval where the independently
calculated SHA-256 exactly matches the expected SHA-256 and the resulting
verification status is `VERIFIED`.

These records are published as evidence of the existing implementation.
Grant-period benchmarks will expand this into a reproducible benchmark
report rather than treating a single development run as a performance
guarantee.

## Open Source Commitment

TrustIoT is publicly available and dual-licensed under:

- MIT
- Apache License 2.0

Grant-funded work will remain open source in the public TrustIoT repository.

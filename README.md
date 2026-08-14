# TrustIoT

**TrustIoT** is an open-source enterprise IoT data onboarding gateway for Filecoin with an optional Hyperledger Fabric governance layer.

The design deliberately keeps **Filecoin at the center**:

- IoT payloads are batched, encrypted and stored using Filecoin-backed storage.
- Public integrity metadata (CID, ciphertext hash, device ID, time range) is recorded in the governance layer.
- Sensitive metadata can be kept in Fabric Private Data Collections (PDCs).
- Fabric is optional: the gateway can run without it, which keeps the Filecoin integration reusable for other IoT projects.

## Why this architecture?

Raw IoT streams grow quickly and are a poor fit for permissioned-ledger state. TrustIoT separates:

1. **Data plane** — encrypted IoT datasets on Filecoin.
2. **Governance plane** — identities, permissions, approvals and audit metadata in Hyperledger Fabric.
3. **Edge plane** — device/gateway logic that signs, validates, batches, encrypts and uploads readings.

This creates a reusable bridge between enterprise IoT systems and Filecoin rather than a one-off demo.

## MVP status

Version `0.1.0` includes a runnable local vertical slice:

`simulated sensor -> batch -> AES-256-GCM encryption -> storage adapter -> public manifest -> ledger adapter`

The local adapters need no blockchain network, so the flow can be tested immediately.

A Filecoin Pin adapter is included. It invokes the official `filecoin-pin` CLI when `STORAGE_DRIVER=filecoin`.

The Fabric smart contract skeleton is included in `chaincode/`. The live Fabric Gateway client is intentionally left for the next milestone so we can validate the domain model before locking the network integration.

## Run the local demo

Requires Node.js 24+.

```bash
npm run demo
```

Expected output includes:

- generated readings
- an encrypted dataset file
- a storage reference
- a public dataset manifest
- a local ledger record

Artifacts are written under `data/`.

## Try the Filecoin adapter later

After configuring the official Filecoin Pin CLI in your own development environment:

```bash
STORAGE_DRIVER=filecoin FILECOIN_NETWORK=calibration npm run demo
```

TrustIoT does not store wallet secrets in its repository. Filecoin credentials stay outside the project and are inherited by the CLI process.

## Security model

### Public metadata

Safe-to-publish fields:

- dataset ID
- device pseudonymous ID
- organization ID
- Filecoin CID
- ciphertext SHA-256
- time range
- reading count
- encryption algorithm
- schema version

### Private metadata

Should **not** be placed in public Fabric state:

- plaintext data hashes when they create inference risk
- exact sensor/site mapping
- encryption-key material
- customer identifiers
- commercial terms
- access-control details that reveal sensitive relationships

These belong in Fabric PDCs or an external KMS/secret manager.

### Data encryption

The MVP uses AES-256-GCM before storage. Filecoin stores ciphertext, not raw sensor data.

Encryption keys are never stored on Filecoin or in public Fabric state.

## Repository structure

```text
trustiot/
├── src/
│   ├── demo.js
│   ├── core/
│   │   ├── batch.js
│   │   ├── crypto.js
│   │   ├── manifest.js
│   │   └── simulator.js
│   └── adapters/
│       ├── filecoinPin.js
│       ├── localLedger.js
│       └── localStorage.js
├── chaincode/
│   ├── index.js
│   ├── package.json
│   └── lib/trustiot-contract.js
├── fabric/
│   └── collections_config.json
├── docs/
│   ├── ARCHITECTURE.md
│   ├── GRANT_STRATEGY.md
│   └── MILESTONES.md
└── data/
```

## First grant-facing demo

The first public demo should prove five things:

1. Ten virtual IoT devices generate readings.
2. The gateway validates and batches the readings.
3. Each batch is encrypted before leaving the gateway.
4. The encrypted batch is stored on Filecoin and returns a CID.
5. The CID + integrity hash are registered in Fabric and can later be verified.

Then we replace one virtual sensor with an ESP32 without changing the rest of the architecture.

## License

Apache-2.0 for this prototype. A grant submission can add MIT dual licensing if required.

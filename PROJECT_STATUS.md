# Project Status — TrustIoT v0.2

TrustIoT v0.2 extends the original MVP with live Filecoin storage,
Hyperledger Fabric governance, cryptographic provenance, replay
protection, trusted device identity, and ESP32 ingestion.

## Core Data Pipeline

- [x] Sensor simulator
- [x] NDJSON batching
- [x] Canonical batch model
- [x] AES-256-GCM encryption
- [x] Ciphertext SHA-256 integrity hash
- [x] Public manifest model
- [x] Storage-neutral manifest metadata
- [x] Local vertical slice

## Filecoin Storage

- [x] Storage adapter abstraction
- [x] Local storage adapter
- [x] Filecoin Pin adapter
- [x] Live Filecoin Pin Calibration uploads
- [x] IPFS Root CID retrieval and verification
- [x] Synapse SDK integration
- [x] Synapse Calibration account initialization
- [x] Synapse storage readiness / payment preparation check
- [x] Live Synapse PDP uploads
- [x] PieceCID-based storage references
- [x] Synapse retrieval by PieceCID
- [x] SHA-256 verification after Synapse retrieval
- [x] Synapse SDK / PDP as primary storage path
- [x] Filecoin Pin retained as optional storage path
- [x] Local storage retained for development

## Hyperledger Fabric Governance

- [x] Fabric chaincode
- [x] Fabric Gateway client
- [x] Live Fabric test-network transactions
- [x] Dataset registration
- [x] Dataset reads
- [x] Verification status updates
- [x] Idempotent registration
- [x] Retry and ambiguous-commit recovery
- [x] Structured Fabric event logging
- [x] Persistent anti-replay nonce state
- [x] Atomic nonce consumption during registration
- [x] Fabric replay integration test
- [x] Storage-neutral metadata on-chain
- [x] Synapse PieceCID metadata on-chain
- [x] Fabric chaincode v1.5 / Sequence 6
- [x] Private Data Collection configuration

## Cryptographic Provenance

- [x] Ed25519 gateway signing
- [x] Signed public manifests
- [x] Signature verification
- [x] Manifest tamper detection
- [x] Timestamp validation
- [x] Nonce-based replay protection
- [x] Trusted signer registry
- [x] Unknown signer rejection
- [x] Signer revocation policy
- [x] Stored on-chain signature verification before retrieval
- [x] Automated security tests

## ESP32 / Device Layer

- [x] ESP32 DevKit V1 hardware bring-up
- [x] USB / Serial communication
- [x] ESP32 firmware upload
- [x] Wi-Fi connectivity
- [x] HTTP ingestion endpoint
- [x] ESP32 → TrustIoT Gateway communication
- [x] Trusted device registry
- [x] Independent ESP32 device key pair
- [x] Signed device-reading model in TrustIoT
- [x] Device-reading signature verification
- [x] Unknown device rejection
- [x] Tampered device-reading rejection
- [ ] Ed25519 signing executed directly on ESP32
- [ ] Physical sensor integration
- [ ] Real sensor readings replacing simulated values

## Verification Flow

- [x] Storage-driver-independent retrieval
- [x] Local artifact retrieval
- [x] Filecoin Pin / IPFS retrieval
- [x] Synapse / PDP retrieval
- [x] Trusted signer verification before retrieval
- [x] Ciphertext SHA-256 verification
- [x] Fabric VERIFIED / REJECTED governance update
- [x] End-to-end Synapse + Fabric verification

## Testing

- [x] Core unit tests
- [x] Cryptographic security tests
- [x] Trusted signer tests
- [x] Trusted device tests
- [x] Device signing / tamper tests
- [x] Device validation tests
- [x] Fabric persistent anti-replay integration test

## Current Architecture

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
        +--> Synapse SDK / PDP (primary)
        +--> Filecoin Pin (optional)
        +--> Local (development)
        |
        v
Signed Public Manifest
        |
        v
Hyperledger Fabric
        |
        v
Independent Retrieval + Signature + SHA-256 Verification

## Next Steps

- [ ] Move device signing onto the ESP32 itself
- [ ] Integrate a physical temperature/environment sensor
- [ ] Add persistent device-level sequence / replay protection
- [ ] Move trusted device registry into Fabric governance
- [ ] Add device enrollment and revocation transactions
- [ ] Add Synapse storage integration tests
- [ ] Add Mainnet deployment configuration
- [ ] Harden secret and key management for production
- [ ] Update architecture and deployment documentation
# World Mobile Chain integration

See `docs/WMC_TESTNET_EVIDENCE.md` for the verified public-testnet deployment,
physical-device registration, and first real telemetry commitment.

TrustIoT can anchor device identity and telemetry-batch integrity on World
Mobile Chain (WMC), an EVM-compatible network. This integration is a separate
ledger path: it does not upload or retrieve data, depend on Filecoin or OORT,
or use the legacy storage SHA-256 field.

## What is written on-chain

| Item | On-chain value | Raw value kept off-chain |
|---|---|---|
| Device identity | `keccak256(deviceId)` | Human-readable device ID |
| Device key | Key fingerprint | Public/private key material |
| Device metadata | Metadata hash | Metadata document |
| Telemetry batch | Keccak-256 commitment, time range, count | Individual readings |

The WMC commitment code explicitly excludes top-level storage-only fields such
as `sha256`, `cid`, `pieceCid`, `storage`, `filecoin`, and `oort`. It commits to
the telemetry payload itself with Ethereum-compatible Keccak-256.

## Components

- `wmc/contracts/TrustIoTDeviceRegistry.sol` — owner-controlled device
  enrollment, controller/key rotation, and active/revoked status.
- `wmc/contracts/TrustIoTTelemetryCommitments.sol` — authorized, idempotent
  telemetry commitments for active devices.
- `src/adapters/wmcLedger.js` — viem-based read/write adapter with receipt
  confirmation and conflict detection.
- `src/core/wmcCommitment.js` — canonical commitment derivation.
- `src/core/verification/verifyWmcCommitment.js` — independent device and
  commitment verification.

## WMC public testnet

The current public testnet is chain `323432`, uses `WOMOX` test gas, and is
separate from WMC mainnet chain `869`. Start from the checked-in template:

```powershell
Copy-Item config/wmc-testnet.env.example .env
npm run wmc:testnet-check
```

The check refuses a non-testnet chain and prints the live block number. When
`WMC_DEPLOYER_ADDRESS` is configured, it also prints the WOMOX balance without
requiring or reading the private key. Fund a dedicated test wallet from
`https://testnet-faucet.worldmobile.net/`; never reuse a production wallet.
Because this checkout is inside OneDrive, do not save `WMC_PRIVATE_KEY` in
`.env` or anywhere under the project directory.

## Network configuration

Copy `config/wmc-testnet.env.example` to `.env` and replace all placeholders
and secrets. Mainnet defaults are deliberately limited to chain metadata;
the RPC URL and both deployed contract addresses remain configuration.

```dotenv
WMC_RPC_URL=https://worldmobilechain-mainnet.g.alchemy.com/public
WMC_CHAIN_ID=869
WMC_DEVICE_REGISTRY_ADDRESS=0x...
WMC_TELEMETRY_COMMITMENTS_ADDRESS=0x...
WMC_CONFIRMATIONS=1
```

For a test network or a private WMC-compatible endpoint, set `WMC_CHAIN_ID`,
`WMC_CHAIN_NAME`, and `WMC_RPC_URL` explicitly. Do not assume mainnet values.

## Deploy the contracts on testnet

Compile and run the guarded deployment command:

```powershell
npm run compile:wmc
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-wmc-testnet-secure.ps1
```

The PowerShell helper prompts for the key with hidden input, runs the guarded
deployment, and clears the plaintext process environment immediately afterward.
For WSL, the equivalent sequence is:

```bash
npm run compile:wmc
read -rsp "WMC test-wallet private key: " WMC_PRIVATE_KEY; echo
export WMC_PRIVATE_KEY
npm run wmc:deploy-testnet
unset WMC_PRIVATE_KEY
```

Deployment requires `WMC_DEPLOY_CONFIRM=WMC_TESTNET_323432`, verifies the RPC
chain ID again, rejects a zero-balance wallet, deploys both contracts in order,
and reads their owner/linkage back from the chain. It writes a non-secret
receipt under `artifacts/wmc/deployments/`. Copy the two printed contract
addresses into `.env`; the script never writes or prints the private key. The
hidden `read` command above keeps the key out of shell history and the final
`unset` removes it from the session environment.

Verify the saved deployment receipt independently without a private key:

```powershell
npm run wmc:verify-deployment -- artifacts/wmc/deployments/wmc-testnet-<timestamp>.json
```

This checks both transaction receipts, deployed bytecode, both owner values,
and the commitments contract's immutable registry link against live RPC data.

For mainnet, use a separately reviewed deployment process. This testnet command
intentionally refuses mainnet chain `869`.

### Contract order

Compile with Solidity 0.8.24 or newer using the Solidity toolchain of your
choice. Deploy in this order:

1. `TrustIoTDeviceRegistry(initialOwner)`.
2. `TrustIoTTelemetryCommitments(initialOwner, registryAddress)`.
3. Put both deployed addresses in `.env`.
4. Grant gateways separately for each device with
   `setAuthorizedDeviceSubmitter(deviceId, gateway, true)`.

Both contracts use two-step owner transfer. Use an operational multisig as
owner for production deployments. The commitments contract accepts submissions
from its owner, the registered device controller, or a gateway explicitly
authorized for that exact device. Authorization for device A never grants
authority over device B.

The physical receiver verifies the ESP32 P-256 signature before creating a
batch. The current on-chain contract enforces device-scoped administrative
authorization; it does not verify the P-256 signature on-chain because the
ESP32 signs individual readings, while WMC receives one aggregate batch
commitment. Direct cryptographic device-to-contract proof requires a future
batch-signature protocol and must not be claimed by this version.

## Register a device

The CLI accepts public-key material, derives a Keccak-256 fingerprint locally,
and writes only that fingerprint to WMC.

For the physical reference device, use the secure helper. It reads the public
key from disk, rejects private-key material, prompts for the test-wallet key
with hidden input, and clears it after the transaction:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\register-esp32-01-wmc-testnet-secure.ps1
```

```powershell
npm run wmc:register-device -- `
  device-001 `
  0xControllerAddress `
  "device-public-key-material" `
  '{"fleet":"pilot"}'
```

## Commit a telemetry batch

Prepare and inspect a commitment locally before configuring a wallet or
performing any network write:

```powershell
npm run wmc:prepare-batch -- artifacts/batches/example.json
```

The command accepts both ISO-8601 and Unix-second batch boundaries. It writes
an artifact under `artifacts/wmc/` with `networkWritePerformed: false`; it does
not need `WMC_PRIVATE_KEY`, RPC access, or deployed contract addresses.

To keep collecting physical-device batches without invoking the existing
Synapse/Fabric pipeline, start the receiver with:

```powershell
$env:TRUSTIOT_AUTO_SYNAPSE_FABRIC="false"
node receiver.js
```

In Bash or WSL:

```bash
export TRUSTIOT_AUTO_SYNAPSE_FABRIC=false
node receiver.js
```

The batch and persistent queue job remain on disk as `PENDING` for later
processing. No storage credential is required in this mode.

After contracts are deployed and the write environment is configured, submit
the source batch explicitly:

```powershell
npm run wmc:commit-batch -- examples/wmc-sample-batch.json
```

For the first physical `esp32-01` testnet batch, use the hidden-input helper:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\commit-esp32-01-batch-wmc-testnet-secure.ps1
```

The command first checks `batchExists`. An identical existing commitment is
returned as an idempotent success; a conflicting record is rejected.

## Automatic physical-device commitments

Start the receiver with a hidden-input test-wallet prompt:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-receiver-wmc-testnet-secure.ps1
```

When operating from WSL, run the receiver inside WSL to avoid Windows/WSL port
mirroring conflicts:

```bash
bash scripts/start-receiver-wmc-testnet-secure.sh
```

The wrapper enables `TRUSTIOT_AUTO_WMC=true` and deliberately disables the
separate Synapse/Fabric pipeline. Each newly completed 60-reading batch is
written locally first, persisted to the independent private WMC retry queue,
then committed idempotently. Failed WMC submissions use exponential backoff
and recover after receiver restart. The wallet key remains only in the running
process environment and is removed when the receiver exits.

The checked-in environment template keeps both automatic pipelines disabled by
default. `node receiver.js` therefore preserves batches locally without trying
Synapse or WMC. The secure launcher supplies the explicit process-environment
override that enables WMC only.

To commit any already-created batch securely:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\commit-wmc-batch-secure.ps1 `
  -BatchPath .\artifacts\batches\<batch-file>.json
```

## Verify independently

Verification needs RPC and contract addresses but no private key:

```powershell
npm run wmc:verify -- examples/wmc-sample-batch.json
```

The result is successful only when the device is active and every locally
derived field matches the WMC record: device key, commitment, schema hash,
time range, and reading count.

## Tests

```powershell
npm run test:wmc
```

The WMC suite covers Ethereum Keccak vectors, deterministic canonicalization,
telemetry mutation, separation from storage/SHA-256 metadata, fixed-size
on-chain writes, replay/idempotency, device registration, revoked-device
rejection, commitment mismatch detection, and executable EVM authorization
tests proving that a gateway for one device cannot submit for another.

## Production checklist

- Audit the Solidity contracts before production deployment.
- Use a multisig contract owner and a dedicated, low-balance gateway signer.
- Protect `WMC_PRIVATE_KEY` in a secrets manager; it is never needed to verify.
- Pin chain ID and RPC provider in deployment configuration.
- Record deployment transaction hashes and verified contract source.
- Monitor failed/reverted transactions and device-revocation events.
- Run the WMC suite and the existing TrustIoT regression suites before release.

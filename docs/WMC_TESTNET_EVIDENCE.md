# TrustIoT WMC testnet evidence

## Result

TrustIoT completed an end-to-end World Mobile Chain public-testnet reference
flow using physical ESP32/BME280 measurements. The receiver authenticated the
device-origin readings, created a 60-reading local batch, and anchored only the
fixed-size integrity and provenance commitment on WMC.

- Date: 2026-10-05
- Network: World Mobile Chain Testnet
- Chain ID: `323432`
- Test gas token: `WOMOX`

## Contract deployment

| Contract | Address | Deployment evidence |
|---|---|---|
| TrustIoT Device Registry | `0xD633AC3d02473A6eA88b712aD072Faf314d91095` | [Transaction `0x81dd...44d1`](https://testnet-explorer.worldmobile.net/tx/0x81ddb57df65c43f12197816d16e37edfeb11c17eca5f2c71d1bbb0600b4444d1), block `7843665` |
| TrustIoT Telemetry Commitments | `0x35c22CD7B312925e3dD1215c3fc0a710eb0EE752` | [Transaction `0x4d5e...f89d`](https://testnet-explorer.worldmobile.net/tx/0x4d5ec2b4e105befcbff5409a26b52c48bb7a09b63ea97b7cf8fc11b7101cf89d), block `7843666` |

Independent post-deployment checks confirmed both successful receipts, deployed
bytecode at both addresses, the expected owner, and the commitments contract's
immutable link to the registry.

## Physical device registration

- Device: `esp32-01`
- Sensor: `BME280`
- Controller: `0x5a02D6268fCf95676BDBe2a735602Cd3d639345D`
- Device key: `0x75292aff5c43102f4b87f3a2016aa97ec41554f4a00dcc2eb69fea26e9ad18a2`
- Public-key fingerprint: `0x17c707f38ad2739ae59b7bcb7eb652b80b972baee36467d3de28bae21d4bcf09`
- Metadata hash: `0x0b3eb7a10e4c9875c62a61334b5d86bd44b9978f4decc120df6be5427d03ff44`
- Status: `Active`

Registration: [transaction `0x944e...fd78`](https://testnet-explorer.worldmobile.net/tx/0x944ef98d46b359eb041da318ec66b4b930cc1ca3ee1b92144544c0ba698dfd78),
block `7843721`.

Only a Keccak-256 fingerprint and metadata hash were registered. No private or
public key material was written on-chain.

## First real telemetry commitment

- Readings: `60`
- Batch start: `1791236131`
- Batch end: `1791236450`
- Batch ID: `0x2c117f125ed4a27556438d3a46a99a0509dcec8dfd525d05cd23c3f782893928`
- Commitment: `0x3a4751d1df0801c0678f750a4f08ae4b8cecce4a2fc9122ffb78ed685cd2d5df`
- Schema hash: `0xda9efba7ab4624b034ad4c4b5c4e3e11b7fbd11333d75af1828148f0cf622c04`

Commitment: [transaction `0xe7f3...85ab`](https://testnet-explorer.worldmobile.net/tx/0xe7f35386e589297069acf4eb17190d4ca14e29f63ddb25b689e8feb4f59a85ab),
block `7843738`, gas used `150974`.

Independent verification re-derived the commitment from the local batch and
confirmed all seven relevant checks: active device, device key, commitment,
schema hash, start time, end time, and reading count.

## Second real telemetry commitment

- Readings: `60`
- Batch start: `1791270164`
- Batch end: `1791270483`
- Batch ID: `0x9c4f7602463eeda969e7c43ec8fa2f6f343a262b319df1bce9ab4ece8f381437`
- Commitment: `0xadbe1cea8e9792c7c1d5a771be7d1213a1c0168eafd237e195968abd3f2acc9b`
- Schema hash: `0xda9efba7ab4624b034ad4c4b5c4e3e11b7fbd11333d75af1828148f0cf622c04`

Commitment: [transaction `0x73bc...f052`](https://testnet-explorer.worldmobile.net/tx/0x73bc55bb9af7649485156ba0c0e8d2582c7846cc7c37bf545b7a9e5759a1f052),
block `7844823`, gas used `150974`.

Independent verification again passed all seven checks against the original
physical-device batch. This second transaction demonstrates repeatable WMC
usage rather than a single deployment-only proof.

## First automatic telemetry commitment

This batch was created by the running physical-device receiver and submitted
through the independent persistent WMC queue without a manual commit command.
The separate Synapse/Fabric pipeline remained disabled.

- Readings: `60`
- Batch start: `1791271947`
- Batch end: `1791272265`
- Batch ID: `0x4fcb797ebd089e00ea796632e4439ed855b3ad172cf4fc35b44e6c7f12494216`
- Commitment: `0xeaad026fcb9ca355628a10498f5d8a595b44261893d8876acc7484b2b19c7745`
- Schema hash: `0xda9efba7ab4624b034ad4c4b5c4e3e11b7fbd11333d75af1828148f0cf622c04`

Automatic commitment: [transaction `0x7328...99c1`](https://testnet-explorer.worldmobile.net/tx/0x732891971c0898a15dfe663f8cbe870ab80c36e261176aa550bf2193eae999c1),
block `7844854`.

Independent verification passed the active-device check and all six batch
field comparisons. The persistent WMC queue removed its completed job only
after the transaction receipt succeeded.

## Automation and reliability

The WMC path is independent from the existing storage and Fabric paths. New
physical-device batches can be committed through a dedicated persistent WMC
queue with exponential retry, restart recovery, and idempotent on-chain replay.
The secure receiver wrapper prompts once for the dedicated test-wallet key and
does not save it under the OneDrive-backed project directory. The key is passed
only to the WMC child process, not to Synapse or Fabric processes.

Run the automated WMC receiver:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-receiver-wmc-testnet-secure.ps1
```

Verification commands:

```powershell
npm run wmc:verify-deployment -- artifacts/wmc/deployments/wmc-testnet-1791239191537.json
npm run wmc:verify -- artifacts/batches/esp32-01-batch-1791236131-1791236450-f6b038e9a02d.json
npm run test:wmc
```

Verified test totals at this checkpoint: 20 JavaScript tests and 9 executable
Solidity/EVM tests.

## Security and scope boundaries

- Raw telemetry remains off-chain; WMC stores fixed-size commitments only.
- The receiver verifies the ESP32 P-256 signature before accepting each
  reading. The current contracts do not claim on-chain P-256 verification.
- Gateway authorization is device-scoped; authorization for one device cannot
  submit for another.
- The current owner is a dedicated testnet EOA. It is not a production wallet
  or multisig and must not be reused for mainnet.
- The contracts have automated security tests but no independent third-party
  audit. This deployment is testnet evidence, not a production release.
- Filecoin remains a separate backend. This WMC work covers identity and
  telemetry commitments and does not duplicate Filecoin-funded storage work.

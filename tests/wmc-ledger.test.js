import test from "node:test";
import assert from "node:assert/strict";
import {
  WMC_MAINNET,
  WMC_TESTNET,
  WmcLedgerAdapter,
  normalizeWmcPrivateKey,
  resolveWmcNetwork,
} from "../src/adapters/wmcLedger.js";
import { createWmcBatchCommitment } from "../src/core/wmcCommitment.js";

const registryAddress = `0x${"1".repeat(40)}`;
const commitmentsAddress = `0x${"2".repeat(40)}`;
const controller = `0x${"3".repeat(40)}`;
const transactionHash = `0x${"4".repeat(64)}`;
const batch = {
  deviceId: "device-001",
  batchStartedAt: "2026-10-04T12:00:00.000Z",
  batchEndedAt: "2026-10-04T12:00:10.000Z",
  readings: [{ value: 10 }, { value: 11 }],
};

test("resolves the current WMC testnet without inheriting mainnet metadata", () => {
  const network = resolveWmcNetwork({ WMC_CHAIN_ID: "323432" });
  assert.equal(network.id, WMC_TESTNET.id);
  assert.equal(network.nativeCurrency.symbol, "WOMOX");
  assert.equal(
    network.blockExplorers.default.url,
    "https://testnet-explorer.worldmobile.net",
  );
  assert.notEqual(network.id, WMC_MAINNET.id);
});

test("rejects an invalid configured WMC chain id", () => {
  assert.throws(
    () => resolveWmcNetwork({ WMC_CHAIN_ID: "not-a-chain" }),
    /positive integer/,
  );
});

test("normalizes common 32-byte private-key export formats", () => {
  const raw = "a".repeat(64);
  assert.equal(normalizeWmcPrivateKey(raw), `0x${raw}`);
  assert.equal(normalizeWmcPrivateKey(`0x${raw}`), `0x${raw}`);
  assert.throws(() => normalizeWmcPrivateKey("0x1234"), /64 hexadecimal/);
});

test("writes only fixed-size commitment metadata to WMC", async () => {
  const writes = [];
  const publicClient = {
    async readContract(request) {
      assert.equal(request.functionName, "batchExists");
      return false;
    },
    async waitForTransactionReceipt({ hash, confirmations }) {
      assert.equal(hash, transactionHash);
      assert.equal(confirmations, 2);
      return { status: "success", blockNumber: 123n };
    },
  };
  const walletClient = {
    async writeContract(request) {
      writes.push(request);
      return transactionHash;
    },
  };
  const adapter = new WmcLedgerAdapter({
    publicClient, walletClient, registryAddress, commitmentsAddress, confirmations: 2,
  });

  const result = await adapter.commitBatch(batch);
  assert.equal(result.idempotent, false);
  assert.equal(result.transactionHash, transactionHash);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].functionName, "commitBatch");
  assert.equal(writes[0].args.length, 7);
  assert.equal(writes[0].args.every((item) => typeof item !== "object"), true);
  assert.equal(writes[0].args.map(String).join("|").includes("value"), false);
});

test("returns idempotently when an identical commitment is already anchored", async () => {
  const expected = createWmcBatchCommitment(batch);
  const publicClient = {
    async readContract({ functionName }) {
      if (functionName === "batchExists") return true;
      if (functionName === "getBatch") {
        return {
          deviceId: expected.deviceKey,
          commitment: expected.commitment,
          schemaHash: expected.schemaHash,
          submitter: controller,
          startedAt: BigInt(expected.startedAt),
          endedAt: BigInt(expected.endedAt),
          committedAt: 1n,
          readingCount: BigInt(expected.readingCount),
        };
      }
      throw new Error(`unexpected call ${functionName}`);
    },
  };
  const adapter = new WmcLedgerAdapter({
    publicClient, registryAddress, commitmentsAddress,
  });

  const result = await adapter.commitBatch(batch);
  assert.equal(result.idempotent, true);
  assert.equal(result.transactionHash, null);
});

test("rejects an existing batch id with conflicting on-chain values", async () => {
  const expected = createWmcBatchCommitment(batch);
  const adapter = new WmcLedgerAdapter({
    publicClient: {
      async readContract({ functionName }) {
        if (functionName === "batchExists") return true;
        return {
          deviceId: expected.deviceKey,
          commitment: `0x${"f".repeat(64)}`,
          schemaHash: expected.schemaHash,
          submitter: controller,
          startedAt: BigInt(expected.startedAt),
          endedAt: BigInt(expected.endedAt),
          committedAt: 1n,
          readingCount: BigInt(expected.readingCount),
        };
      },
    },
    registryAddress,
    commitmentsAddress,
  });

  await assert.rejects(() => adapter.commitBatch(batch), /different values/);
});

test("registers a hashed device identity and key fingerprint", async () => {
  let write;
  const adapter = new WmcLedgerAdapter({
    publicClient: {
      readContract() {},
      async waitForTransactionReceipt() { return { status: "success", blockNumber: 9n }; },
    },
    walletClient: {
      async writeContract(request) { write = request; return transactionHash; },
    },
    registryAddress,
    commitmentsAddress,
  });
  const keyFingerprint = `0x${"a".repeat(64)}`;
  await adapter.registerDevice({
    deviceId: "private-device-name",
    controller,
    keyFingerprint,
    metadata: { model: "generic" },
  });
  assert.equal(write.functionName, "registerDevice");
  assert.match(write.args[0], /^0x[0-9a-f]{64}$/);
  assert.equal(write.args[1], controller);
  assert.equal(write.args[2], keyFingerprint);
  assert.notEqual(write.args[0], "private-device-name");
});

test("scopes gateway authorization to one hashed device identity", async () => {
  let write;
  const adapter = new WmcLedgerAdapter({
    publicClient: {
      readContract() {},
      async waitForTransactionReceipt() { return { status: "success", blockNumber: 10n }; },
    },
    walletClient: {
      async writeContract(request) { write = request; return transactionHash; },
    },
    registryAddress,
    commitmentsAddress,
  });

  const gateway = `0x${"5".repeat(40)}`;
  await adapter.setAuthorizedDeviceSubmitter("device-001", gateway, true);

  assert.equal(write.functionName, "setAuthorizedDeviceSubmitter");
  assert.equal(write.args.length, 3);
  assert.equal(write.args[0], createWmcBatchCommitment(batch).deviceKey);
  assert.equal(write.args[1], gateway);
  assert.equal(write.args[2], true);
});

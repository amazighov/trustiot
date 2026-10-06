import {
  assertBytes32,
  createWmcBatchCommitment,
  deviceIdToBytes32,
  metadataToBytes32,
} from "../core/wmcCommitment.js";
import { deviceRegistryAbi, telemetryCommitmentsAbi } from "./wmcAbi.js";

export const WMC_MAINNET = Object.freeze({
  id: 869,
  name: "World Mobile Chain",
  nativeCurrency: { name: "World Mobile Token", symbol: "WMTX", decimals: 18 },
  blockExplorers: {
    default: { name: "WMC Explorer", url: "https://explorer.worldmobile.io" },
  },
});

export const WMC_TESTNET = Object.freeze({
  id: 323432,
  name: "World Mobile Chain Testnet",
  nativeCurrency: { name: "World Mobile Test Token", symbol: "WOMOX", decimals: 18 },
  blockExplorers: {
    default: {
      name: "WMC Testnet Explorer",
      url: "https://testnet-explorer.worldmobile.net",
    },
  },
});

export function resolveWmcNetwork(env = process.env) {
  const chainId = Number(env.WMC_CHAIN_ID ?? WMC_MAINNET.id);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new Error("WMC_CHAIN_ID must be a positive integer");
  }

  const knownNetwork = chainId === WMC_TESTNET.id ? WMC_TESTNET : WMC_MAINNET;
  const explorerUrl = env.WMC_EXPLORER_URL?.trim();
  return {
    ...knownNetwork,
    id: chainId,
    name: env.WMC_CHAIN_NAME?.trim() || knownNetwork.name,
    blockExplorers: explorerUrl
      ? { default: { name: "WMC Explorer", url: explorerUrl } }
      : knownNetwork.blockExplorers,
  };
}

function required(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

export function normalizeWmcPrivateKey(value) {
  const candidate = required(value, "WMC_PRIVATE_KEY");
  const normalized = /^[0-9a-fA-F]{64}$/.test(candidate)
    ? `0x${candidate}`
    : candidate;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error(
      "WMC_PRIVATE_KEY must contain exactly 64 hexadecimal characters, optionally prefixed with 0x",
    );
  }
  return normalized;
}

function address(value, name) {
  const candidate = required(value, name);
  if (!/^0x[0-9a-fA-F]{40}$/.test(candidate)) {
    throw new Error(`${name} must be a 20-byte 0x-prefixed address`);
  }
  if (/^0x0{40}$/i.test(candidate)) throw new Error(`${name} must not be the zero address`);
  return candidate;
}

function asNumber(value) {
  return typeof value === "bigint" ? Number(value) : Number(value);
}

function normalizeDeviceRecord(record) {
  const value = Array.isArray(record)
    ? {
      controller: record[0], keyFingerprint: record[1], metadataHash: record[2],
      registeredAt: record[3], updatedAt: record[4], status: record[5],
    }
    : record;
  return {
    controller: value.controller,
    keyFingerprint: value.keyFingerprint?.toLowerCase(),
    metadataHash: value.metadataHash?.toLowerCase(),
    registeredAt: asNumber(value.registeredAt),
    updatedAt: asNumber(value.updatedAt),
    status: asNumber(value.status),
  };
}

function normalizeBatchRecord(record) {
  const value = Array.isArray(record)
    ? {
      deviceId: record[0], commitment: record[1], schemaHash: record[2],
      submitter: record[3], startedAt: record[4], endedAt: record[5],
      committedAt: record[6], readingCount: record[7],
    }
    : record;
  return {
    deviceId: value.deviceId?.toLowerCase(),
    commitment: value.commitment?.toLowerCase(),
    schemaHash: value.schemaHash?.toLowerCase(),
    submitter: value.submitter,
    startedAt: asNumber(value.startedAt),
    endedAt: asNumber(value.endedAt),
    committedAt: asNumber(value.committedAt),
    readingCount: asNumber(value.readingCount),
  };
}

function sameCommitment(expected, actual) {
  return expected.deviceKey === actual.deviceId
    && expected.commitment === actual.commitment
    && expected.schemaHash === actual.schemaHash
    && expected.startedAt === actual.startedAt
    && expected.endedAt === actual.endedAt
    && expected.readingCount === actual.readingCount;
}

export class WmcLedgerAdapter {
  constructor({
    publicClient,
    walletClient = null,
    account = null,
    registryAddress,
    commitmentsAddress,
    confirmations = 1,
  }) {
    if (!publicClient || typeof publicClient.readContract !== "function") {
      throw new Error("publicClient with readContract() is required");
    }
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.account = account;
    this.registryAddress = address(registryAddress, "WMC_DEVICE_REGISTRY_ADDRESS");
    this.commitmentsAddress = address(
      commitmentsAddress,
      "WMC_TELEMETRY_COMMITMENTS_ADDRESS",
    );
    this.confirmations = Number(confirmations);
    if (!Number.isInteger(this.confirmations) || this.confirmations < 1) {
      throw new Error("confirmations must be a positive integer");
    }
  }

  static async fromEnv({ env = process.env, write = false } = {}) {
    const rpcUrl = required(env.WMC_RPC_URL, "WMC_RPC_URL");
    const network = resolveWmcNetwork(env);

    const { createPublicClient, createWalletClient, defineChain, http } = await import("viem");
    const chain = defineChain({
      ...network,
      rpcUrls: { default: { http: [rpcUrl] } },
    });
    const transport = http(rpcUrl);
    const publicClient = createPublicClient({ chain, transport });
    let walletClient = null;
    let account = null;

    if (write) {
      const privateKey = normalizeWmcPrivateKey(env.WMC_PRIVATE_KEY);
      const { privateKeyToAccount } = await import("viem/accounts");
      account = privateKeyToAccount(privateKey);
      walletClient = createWalletClient({ account, chain, transport });
    }

    return new WmcLedgerAdapter({
      publicClient,
      walletClient,
      account,
      registryAddress: env.WMC_DEVICE_REGISTRY_ADDRESS,
      commitmentsAddress: env.WMC_TELEMETRY_COMMITMENTS_ADDRESS,
      confirmations: env.WMC_CONFIRMATIONS ?? 1,
    });
  }

  async registerDevice({ deviceId, controller, keyFingerprint, metadata }) {
    const deviceKey = deviceIdToBytes32(deviceId);
    const fingerprint = assertBytes32(keyFingerprint, "keyFingerprint");
    const metadataHash = metadataToBytes32(metadata);
    const receipt = await this.writeAndWait({
      address: this.registryAddress,
      abi: deviceRegistryAbi,
      functionName: "registerDevice",
      args: [deviceKey, address(controller, "controller"), fingerprint, metadataHash],
    });
    return { deviceKey, keyFingerprint: fingerprint, metadataHash, ...receipt };
  }

  async setDeviceStatus(deviceId, status) {
    if (![1, 2].includes(Number(status))) throw new Error("status must be 1 (active) or 2 (revoked)");
    return this.writeAndWait({
      address: this.registryAddress,
      abi: deviceRegistryAbi,
      functionName: "setDeviceStatus",
      args: [deviceIdToBytes32(deviceId), Number(status)],
    });
  }

  async getDevice(deviceId) {
    return this.getDeviceByKey(deviceIdToBytes32(deviceId));
  }

  async getDeviceByKey(deviceKey) {
    const record = await this.publicClient.readContract({
      address: this.registryAddress,
      abi: deviceRegistryAbi,
      functionName: "getDevice",
      args: [assertBytes32(deviceKey, "deviceKey")],
    });
    return normalizeDeviceRecord(record);
  }

  async setAuthorizedDeviceSubmitter(deviceId, submitter, authorized) {
    if (typeof authorized !== "boolean") {
      throw new Error("authorized must be a boolean");
    }
    return this.writeAndWait({
      address: this.commitmentsAddress,
      abi: telemetryCommitmentsAbi,
      functionName: "setAuthorizedDeviceSubmitter",
      args: [
        deviceIdToBytes32(deviceId),
        address(submitter, "submitter"),
        authorized,
      ],
    });
  }

  async commitBatch(batch) {
    const expected = createWmcBatchCommitment(batch);
    const exists = await this.publicClient.readContract({
      address: this.commitmentsAddress,
      abi: telemetryCommitmentsAbi,
      functionName: "batchExists",
      args: [expected.batchId],
    });

    if (exists) {
      const actual = await this.getBatch(expected.batchId);
      if (!sameCommitment(expected, actual)) {
        throw new Error(`WMC batch ${expected.batchId} already exists with different values`);
      }
      return { ...expected, idempotent: true, transactionHash: null };
    }

    const receipt = await this.writeAndWait({
      address: this.commitmentsAddress,
      abi: telemetryCommitmentsAbi,
      functionName: "commitBatch",
      args: [
        expected.batchId,
        expected.deviceKey,
        expected.commitment,
        expected.schemaHash,
        BigInt(expected.startedAt),
        BigInt(expected.endedAt),
        expected.readingCount,
      ],
    });
    return { ...expected, idempotent: false, ...receipt };
  }

  async getBatch(batchId) {
    const record = await this.publicClient.readContract({
      address: this.commitmentsAddress,
      abi: telemetryCommitmentsAbi,
      functionName: "getBatch",
      args: [assertBytes32(batchId, "batchId")],
    });
    return normalizeBatchRecord(record);
  }

  async writeAndWait(request) {
    if (!this.walletClient || typeof this.walletClient.writeContract !== "function") {
      throw new Error("a write-enabled WMC adapter is required for this operation");
    }
    const hash = await this.walletClient.writeContract({
      ...request,
      ...(this.account ? { account: this.account } : {}),
    });
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash,
      confirmations: this.confirmations,
    });
    if (receipt.status !== "success") throw new Error(`WMC transaction ${hash} reverted`);
    return {
      transactionHash: hash,
      blockNumber: receipt.blockNumber?.toString() ?? null,
    };
  }
}

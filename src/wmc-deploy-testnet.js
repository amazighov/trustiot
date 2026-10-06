import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  getAddress,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  WMC_TESTNET,
  normalizeWmcPrivateKey,
  resolveWmcNetwork,
} from "./adapters/wmcLedger.js";

function required(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

async function loadArtifact(relativeUrl) {
  const path = fileURLToPath(new URL(relativeUrl, import.meta.url));
  const artifact = JSON.parse(await readFile(path, "utf8"));
  if (!Array.isArray(artifact.abi) || !/^0x[0-9a-f]+$/i.test(artifact.bytecode)) {
    throw new Error(`Invalid or missing compiled contract artifact: ${path}`);
  }
  return artifact;
}

if (process.env.WMC_DEPLOY_CONFIRM !== "WMC_TESTNET_323432") {
  throw new Error(
    "Refusing deployment: set WMC_DEPLOY_CONFIRM=WMC_TESTNET_323432 after checking the network",
  );
}

const rpcUrl = required(process.env.WMC_RPC_URL, "WMC_RPC_URL");
const network = resolveWmcNetwork(process.env);
if (network.id !== WMC_TESTNET.id) {
  throw new Error(
    `Refusing deployment: expected WMC testnet ${WMC_TESTNET.id}, configured ${network.id}`,
  );
}

const privateKey = normalizeWmcPrivateKey(process.env.WMC_PRIVATE_KEY);

const account = privateKeyToAccount(privateKey);
const configuredAddress = process.env.WMC_DEPLOYER_ADDRESS?.trim();
if (configuredAddress && getAddress(configuredAddress) !== account.address) {
  throw new Error("WMC_DEPLOYER_ADDRESS does not match WMC_PRIVATE_KEY");
}

const chain = defineChain({
  ...network,
  rpcUrls: { default: { http: [rpcUrl] } },
});
const transport = http(rpcUrl);
const publicClient = createPublicClient({ chain, transport });
const walletClient = createWalletClient({ account, chain, transport });

const remoteChainId = await publicClient.getChainId();
if (remoteChainId !== WMC_TESTNET.id) {
  throw new Error(
    `RPC chain mismatch: expected ${WMC_TESTNET.id}, received ${remoteChainId}`,
  );
}

const balance = await publicClient.getBalance({ address: account.address });
if (balance === 0n) {
  throw new Error(
    `Deployer ${account.address} has zero WOMOX; fund it from the WMC testnet faucet first`,
  );
}

const registryArtifact = await loadArtifact(
  "../.hardhat/artifacts/wmc/contracts/TrustIoTDeviceRegistry.sol/TrustIoTDeviceRegistry.json",
);
const commitmentsArtifact = await loadArtifact(
  "../.hardhat/artifacts/wmc/contracts/TrustIoTTelemetryCommitments.sol/TrustIoTTelemetryCommitments.json",
);

console.log(`Deploying from ${account.address} with ${formatEther(balance)} WOMOX`);

const registryTxHash = await walletClient.deployContract({
  account,
  abi: registryArtifact.abi,
  bytecode: registryArtifact.bytecode,
  args: [account.address],
});
const registryReceipt = await publicClient.waitForTransactionReceipt({
  hash: registryTxHash,
  confirmations: Number(process.env.WMC_CONFIRMATIONS || 1),
});
if (registryReceipt.status !== "success" || !registryReceipt.contractAddress) {
  throw new Error(`Device registry deployment failed: ${registryTxHash}`);
}

const commitmentsTxHash = await walletClient.deployContract({
  account,
  abi: commitmentsArtifact.abi,
  bytecode: commitmentsArtifact.bytecode,
  args: [account.address, registryReceipt.contractAddress],
});
const commitmentsReceipt = await publicClient.waitForTransactionReceipt({
  hash: commitmentsTxHash,
  confirmations: Number(process.env.WMC_CONFIRMATIONS || 1),
});
if (commitmentsReceipt.status !== "success" || !commitmentsReceipt.contractAddress) {
  throw new Error(`Telemetry commitments deployment failed: ${commitmentsTxHash}`);
}

const [registryOwner, commitmentsOwner, linkedRegistry] = await Promise.all([
  publicClient.readContract({
    address: registryReceipt.contractAddress,
    abi: registryArtifact.abi,
    functionName: "owner",
  }),
  publicClient.readContract({
    address: commitmentsReceipt.contractAddress,
    abi: commitmentsArtifact.abi,
    functionName: "owner",
  }),
  publicClient.readContract({
    address: commitmentsReceipt.contractAddress,
    abi: commitmentsArtifact.abi,
    functionName: "deviceRegistry",
  }),
]);

if (
  getAddress(registryOwner) !== account.address
  || getAddress(commitmentsOwner) !== account.address
  || getAddress(linkedRegistry) !== getAddress(registryReceipt.contractAddress)
) {
  throw new Error("Post-deployment contract linkage verification failed");
}

const explorer = network.blockExplorers.default.url.replace(/\/$/, "");
const deployment = {
  schema: "trustiot.wmc.deployment.v1",
  network: network.name,
  chainId: remoteChainId,
  nativeCurrency: network.nativeCurrency.symbol,
  deployer: account.address,
  deployedAt: new Date().toISOString(),
  deviceRegistry: {
    address: registryReceipt.contractAddress,
    transactionHash: registryTxHash,
    blockNumber: registryReceipt.blockNumber.toString(),
    explorer: `${explorer}/tx/${registryTxHash}`,
  },
  telemetryCommitments: {
    address: commitmentsReceipt.contractAddress,
    transactionHash: commitmentsTxHash,
    blockNumber: commitmentsReceipt.blockNumber.toString(),
    explorer: `${explorer}/tx/${commitmentsTxHash}`,
  },
  verification: {
    registryOwner,
    commitmentsOwner,
    linkedRegistry,
  },
};

const outputDirectory = fileURLToPath(
  new URL("../artifacts/wmc/deployments/", import.meta.url),
);
await mkdir(outputDirectory, { recursive: true });
const outputPath = join(outputDirectory, `wmc-testnet-${Date.now()}.json`);
await writeFile(outputPath, `${JSON.stringify(deployment, null, 2)}\n`, {
  encoding: "utf8",
  flag: "wx",
});

console.log(JSON.stringify({ ...deployment, outputPath }, null, 2));
console.log("Add these non-secret values to .env:");
console.log(`WMC_DEVICE_REGISTRY_ADDRESS=${registryReceipt.contractAddress}`);
console.log(`WMC_TELEMETRY_COMMITMENTS_ADDRESS=${commitmentsReceipt.contractAddress}`);

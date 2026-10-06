import "dotenv/config";
import { readFile } from "node:fs/promises";
import {
  createPublicClient,
  defineChain,
  getAddress,
  http,
} from "viem";
import { resolveWmcNetwork } from "./adapters/wmcLedger.js";

const [deploymentPath] = process.argv.slice(2);
if (!deploymentPath) {
  throw new Error(
    "Usage: npm run wmc:verify-deployment -- <deployment-artifact.json>",
  );
}

const deployment = JSON.parse(await readFile(deploymentPath, "utf8"));
const rpcUrl = process.env.WMC_RPC_URL?.trim();
if (!rpcUrl) throw new Error("WMC_RPC_URL is required");

const network = resolveWmcNetwork(process.env);
if (Number(deployment.chainId) !== network.id) {
  throw new Error(
    `Deployment chain ${deployment.chainId} does not match configured chain ${network.id}`,
  );
}

const chain = defineChain({
  ...network,
  rpcUrls: { default: { http: [rpcUrl] } },
});
const client = createPublicClient({ chain, transport: http(rpcUrl) });

const registryAddress = getAddress(deployment.deviceRegistry.address);
const commitmentsAddress = getAddress(deployment.telemetryCommitments.address);
const expectedOwner = getAddress(deployment.deployer);

const ownerAbi = [{
  type: "function",
  name: "owner",
  stateMutability: "view",
  inputs: [],
  outputs: [{ name: "", type: "address" }],
}];
const linkedRegistryAbi = [{
  type: "function",
  name: "deviceRegistry",
  stateMutability: "view",
  inputs: [],
  outputs: [{ name: "", type: "address" }],
}];

const [
  remoteChainId,
  registryReceipt,
  commitmentsReceipt,
  registryCode,
  commitmentsCode,
  registryOwner,
  commitmentsOwner,
  linkedRegistry,
] = await Promise.all([
  client.getChainId(),
  client.getTransactionReceipt({ hash: deployment.deviceRegistry.transactionHash }),
  client.getTransactionReceipt({ hash: deployment.telemetryCommitments.transactionHash }),
  client.getCode({ address: registryAddress }),
  client.getCode({ address: commitmentsAddress }),
  client.readContract({ address: registryAddress, abi: ownerAbi, functionName: "owner" }),
  client.readContract({ address: commitmentsAddress, abi: ownerAbi, functionName: "owner" }),
  client.readContract({
    address: commitmentsAddress,
    abi: linkedRegistryAbi,
    functionName: "deviceRegistry",
  }),
]);

const checks = {
  chainMatches: remoteChainId === network.id,
  registryTransactionSucceeded: registryReceipt.status === "success",
  commitmentsTransactionSucceeded: commitmentsReceipt.status === "success",
  registryAddressMatches:
    registryReceipt.contractAddress
    && getAddress(registryReceipt.contractAddress) === registryAddress,
  commitmentsAddressMatches:
    commitmentsReceipt.contractAddress
    && getAddress(commitmentsReceipt.contractAddress) === commitmentsAddress,
  registryCodePresent: typeof registryCode === "string" && registryCode !== "0x",
  commitmentsCodePresent:
    typeof commitmentsCode === "string" && commitmentsCode !== "0x",
  registryOwnerMatches: getAddress(registryOwner) === expectedOwner,
  commitmentsOwnerMatches: getAddress(commitmentsOwner) === expectedOwner,
  registryLinkMatches: getAddress(linkedRegistry) === registryAddress,
};
const ok = Object.values(checks).every(Boolean);

console.log(JSON.stringify({
  ok,
  chainId: remoteChainId,
  deploymentPath,
  registryAddress,
  commitmentsAddress,
  expectedOwner,
  checks,
}, null, 2));

if (!ok) process.exitCode = 1;

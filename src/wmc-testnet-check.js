import "dotenv/config";
import {
  createPublicClient,
  defineChain,
  formatEther,
  getAddress,
  http,
} from "viem";
import { WMC_TESTNET, resolveWmcNetwork } from "./adapters/wmcLedger.js";

const rpcUrl = process.env.WMC_RPC_URL?.trim()
  || "https://worldmobile-testnet.g.alchemy.com/public";
const network = resolveWmcNetwork({
  ...process.env,
  WMC_CHAIN_ID: process.env.WMC_CHAIN_ID || String(WMC_TESTNET.id),
});

if (network.id !== WMC_TESTNET.id) {
  throw new Error(
    `Refusing testnet check: expected chain ${WMC_TESTNET.id}, configured ${network.id}`,
  );
}

const chain = defineChain({
  ...network,
  rpcUrls: { default: { http: [rpcUrl] } },
});
const client = createPublicClient({ chain, transport: http(rpcUrl) });

const [remoteChainId, blockNumber] = await Promise.all([
  client.getChainId(),
  client.getBlockNumber(),
]);

if (remoteChainId !== WMC_TESTNET.id) {
  throw new Error(
    `RPC chain mismatch: expected ${WMC_TESTNET.id}, received ${remoteChainId}`,
  );
}

const result = {
  ok: true,
  chainId: remoteChainId,
  chainName: network.name,
  nativeCurrency: network.nativeCurrency.symbol,
  latestBlock: blockNumber.toString(),
  explorer: network.blockExplorers.default.url,
};

const deployer = process.env.WMC_DEPLOYER_ADDRESS?.trim();
if (deployer) {
  const address = getAddress(deployer);
  const balance = await client.getBalance({ address });
  result.deployer = address;
  result.balanceWei = balance.toString();
  result.balanceWomox = formatEther(balance);
  result.readyToDeploy = balance > 0n;
}

console.log(JSON.stringify(result, null, 2));

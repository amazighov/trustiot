import { defineConfig } from "hardhat/config";

export default defineConfig({
  paths: {
    sources: "./wmc/contracts",
    tests: {
      solidity: "./wmc/test",
    },
    cache: "./.hardhat/cache",
    artifacts: "./.hardhat/artifacts",
  },
  solidity: {
    version: "0.8.24",
    preferWasm: true,
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "generic",
      chainId: 869,
    },
  },
});

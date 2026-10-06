import "dotenv/config";
import { readFile } from "node:fs/promises";
import { WmcLedgerAdapter } from "./adapters/wmcLedger.js";
import { fingerprintDeviceKey } from "./core/wmcCommitment.js";

const [deviceId, controllerSource, publicKeySource, metadataSource] = process.argv.slice(2);
if (!deviceId || !controllerSource || !publicKeySource) {
  console.error(
    "Usage: npm run wmc:register-device -- <device-id> <controller-address|@deployer> <public-key|@public-key-file> [metadata-json]",
  );
  process.exitCode = 2;
} else {
  try {
    const controller = controllerSource === "@deployer"
      ? process.env.WMC_DEPLOYER_ADDRESS
      : controllerSource;
    const publicKey = publicKeySource.startsWith("@")
      ? await readFile(publicKeySource.slice(1), "utf8")
      : publicKeySource;
    if (/PRIVATE KEY/.test(publicKey)) {
      throw new Error("Refusing device registration: public-key input contains private-key material");
    }
    if (!/-----BEGIN PUBLIC KEY-----/.test(publicKey)) {
      throw new Error("Device registration requires a PEM public key");
    }
    const metadataJson = metadataSource?.startsWith("@")
      ? await readFile(metadataSource.slice(1), "utf8")
      : metadataSource;

    const adapter = await WmcLedgerAdapter.fromEnv({ write: true });
    const result = await adapter.registerDevice({
      deviceId,
      controller,
      keyFingerprint: fingerprintDeviceKey(publicKey),
      metadata: metadataJson ? JSON.parse(metadataJson) : null,
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

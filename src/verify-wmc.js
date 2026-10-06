import "dotenv/config";
import { readFile } from "node:fs/promises";
import { WmcLedgerAdapter } from "./adapters/wmcLedger.js";
import { verifyWmcCommitment } from "./core/verification/verifyWmcCommitment.js";

const [artifactPath] = process.argv.slice(2);
if (!artifactPath) {
  console.error("Usage: npm run wmc:verify -- <telemetry-batch.json>");
  process.exitCode = 2;
} else {
  try {
    const batch = JSON.parse(await readFile(artifactPath, "utf8"));
    const adapter = await WmcLedgerAdapter.fromEnv({ write: false });
    const result = await verifyWmcCommitment(batch, adapter);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

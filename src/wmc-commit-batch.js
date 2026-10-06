import "dotenv/config";
import { readFile } from "node:fs/promises";
import { WmcLedgerAdapter } from "./adapters/wmcLedger.js";

const [artifactPath] = process.argv.slice(2);
if (!artifactPath) {
  console.error("Usage: npm run wmc:commit-batch -- <telemetry-batch.json>");
  process.exitCode = 2;
} else {
  try {
    const batch = JSON.parse(await readFile(artifactPath, "utf8"));
    const adapter = await WmcLedgerAdapter.fromEnv({ write: true });
    const result = await adapter.commitBatch(batch);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

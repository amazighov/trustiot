import fs from "node:fs";
import path from "node:path";
import { createWmcBatchCommitment } from "./core/wmcCommitment.js";

const inputArgument = process.argv[2];
const outputArgument = process.argv[3];

if (!inputArgument) {
  console.error(
    "Usage: npm run wmc:prepare-batch -- <telemetry-batch.json> [output.json]",
  );
  process.exitCode = 1;
} else {
  try {
    const inputPath = path.resolve(inputArgument);
    const batch = JSON.parse(fs.readFileSync(inputPath, "utf8"));
    const commitment = createWmcBatchCommitment(batch);

    const outputPath = outputArgument
      ? path.resolve(outputArgument)
      : path.resolve(
        "artifacts/wmc",
        `${path.basename(inputPath, path.extname(inputPath))}-wmc-commitment.json`,
      );

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const artifact = {
      artifactSchema: "trustiot.wmc.prepared-commitment.v1",
      createdAt: new Date().toISOString(),
      sourceBatch: path.basename(inputPath),
      networkWritePerformed: false,
      ...commitment,
    };

    fs.writeFileSync(
      outputPath,
      `${JSON.stringify(artifact, null, 2)}\n`,
      "utf8",
    );

    console.log(JSON.stringify({
      prepared: true,
      networkWritePerformed: false,
      input: inputPath,
      output: outputPath,
      deviceKey: commitment.deviceKey,
      batchId: commitment.batchId,
      commitment: commitment.commitment,
      readingCount: commitment.readingCount,
    }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

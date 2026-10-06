import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { WmcAutoCommitPipeline } from "../src/private/wmcAutoCommitPipeline.js";

const silentLogger = { log() {}, error() {} };

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "trustiot-wmc-queue-"));
  const batchPath = path.join(root, "batch.json");
  await writeFile(batchPath, "{}", "utf8");
  return { root, batchPath, queueDir: path.join(root, "queue") };
}

test("persists and removes a successful automatic WMC job", async () => {
  const value = await fixture();
  const calls = [];
  try {
    const pipeline = new WmcAutoCommitPipeline({
      queueDir: value.queueDir,
      runCommit: async filePath => {
        calls.push(filePath);
        return { code: 0, error: null };
      },
      logger: silentLogger,
    });
    pipeline.enqueue(value.batchPath);
    await pipeline.waitForIdle();

    assert.deepEqual(calls, [value.batchPath]);
    assert.equal(pipeline.persistentQueue.list().length, 0);
  }
  finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

test("retries a failed WMC commit and succeeds idempotently", async () => {
  const value = await fixture();
  let attempts = 0;
  try {
    const pipeline = new WmcAutoCommitPipeline({
      queueDir: value.queueDir,
      runCommit: async () => {
        attempts += 1;
        return { code: attempts === 1 ? 1 : 0, error: null };
      },
      retryDelayMs: 1,
      schedule: callback => queueMicrotask(callback),
      logger: silentLogger,
    });
    pipeline.enqueue(value.batchPath);
    await pipeline.waitForIdle();

    assert.equal(attempts, 2);
    assert.equal(pipeline.persistentQueue.list().length, 0);
  }
  finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

test("keeps an exhausted WMC job as FAILED evidence", async () => {
  const value = await fixture();
  try {
    const pipeline = new WmcAutoCommitPipeline({
      queueDir: value.queueDir,
      runCommit: async () => ({ code: 1, error: null }),
      maxRetries: 2,
      retryDelayMs: 1,
      schedule: callback => queueMicrotask(callback),
      logger: silentLogger,
    });
    pipeline.enqueue(value.batchPath);
    await pipeline.waitForIdle();

    const [job] = pipeline.persistentQueue.list();
    assert.equal(job.status, "FAILED");
    assert.equal(job.attempt, 1);
    assert.match(job.lastError, /WMC_EXIT_1/);
    assert.equal(JSON.parse(await readFile(
      path.join(value.queueDir, `${job.id}.json`),
      "utf8",
    )).status, "FAILED");
  }
  finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

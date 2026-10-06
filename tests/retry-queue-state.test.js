import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PersistentRetryQueue } from "../src/private/retryQueue.js";

test("persistent retry queue supports every state transition", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "trustiot-retry-queue-"));

  try {
    const queueDir = path.join(root, "queue");
    const batchPath = path.join(root, "batch.json");
    fs.writeFileSync(batchPath, "{}", "utf8");

    const queue = new PersistentRetryQueue({ queueDir });
    const pending = queue.enqueue(batchPath);
    assert.equal(pending.status, "PENDING");

    const processing = queue.markProcessing(pending.id);
    assert.equal(processing.status, "PROCESSING");
    assert.equal(processing.filePath, pending.filePath);
    assert.equal(processing.createdAt, pending.createdAt);

    const retrying = queue.scheduleRetry(pending.id, {
      attempt: 1,
      delayMs: 1000,
      error: "temporary failure",
    });
    assert.equal(retrying.status, "RETRY_WAIT");
    assert.equal(retrying.attempt, 1);
    assert.equal(retrying.lastError, "temporary failure");

    const failed = queue.markFailed(pending.id, "terminal failure");
    assert.equal(failed.status, "FAILED");
    assert.equal(failed.lastError, "terminal failure");

    assert.equal(queue.markSuccess(pending.id), true);
    assert.equal(queue.get(pending.id), null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

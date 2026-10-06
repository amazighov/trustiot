import fs from "node:fs";
import path from "node:path";
import { PersistentRetryQueue } from "./retryQueue.js";

export class WmcAutoCommitPipeline {
  constructor({
    queueDir = path.resolve("data/private/wmc-queue"),
    runCommit,
    maxRetries = 5,
    retryDelayMs = 30_000,
    schedule = (callback, delay) => setTimeout(callback, delay),
    logger = console,
  } = {}) {
    if (typeof runCommit !== "function") {
      throw new Error("runCommit function is required");
    }
    if (!Number.isInteger(maxRetries) || maxRetries < 1) {
      throw new Error("maxRetries must be a positive integer");
    }

    this.persistentQueue = new PersistentRetryQueue({ queueDir });
    this.runCommit = runCommit;
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;
    this.schedule = schedule;
    this.logger = logger;
    this.queue = [];
    this.activePromise = null;
    this.pendingTimers = 0;
  }

  enqueue(filePath, attempt = 0) {
    const job = this.persistentQueue.enqueue(filePath, attempt);
    this.queue.push({
      filePath: job.filePath,
      attempt: job.attempt ?? attempt,
      jobId: job.id,
    });
    this.logger.log(
      "Batch queued for automatic WMC commitment:",
      path.basename(job.filePath),
      `attempt=${(job.attempt ?? attempt) + 1}`,
    );
    this._start();
    return job;
  }

  recover() {
    const jobs = this.persistentQueue.recoverPending();
    for (const job of jobs) {
      if (!fs.existsSync(job.filePath)) {
        this.persistentQueue.markFailed(
          job.id,
          "Batch artifact missing during WMC recovery",
        );
        continue;
      }
      this.queue.push({
        filePath: job.filePath,
        attempt: job.attempt ?? 0,
        jobId: job.id,
      });
    }
    if (jobs.length > 0) {
      this.logger.log(`Recovering ${jobs.length} WMC queue job(s)`);
    }
    this._start();
    return jobs.length;
  }

  async waitForIdle() {
    while (
      this.activePromise
      || this.pendingTimers > 0
      || this.queue.length > 0
    ) {
      if (this.activePromise) {
        await this.activePromise;
      }
      else {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
  }

  _start() {
    if (this.activePromise || this.queue.length === 0) return;
    this.activePromise = this._processNext()
      .finally(() => {
        this.activePromise = null;
        if (this.queue.length > 0) this._start();
      });
  }

  async _processNext() {
    const job = this.queue.shift();
    if (!job) return;

    if (!fs.existsSync(job.filePath)) {
      this.persistentQueue.markFailed(job.jobId, "Batch artifact missing");
      return;
    }

    this.persistentQueue.markProcessing(job.jobId);
    this.logger.log(
      "Starting automatic WMC commitment:",
      path.basename(job.filePath),
    );

    let result;
    try {
      result = await this.runCommit(job.filePath);
    }
    catch (error) {
      result = { code: null, error };
    }

    if (!result?.error && result?.code === 0) {
      this.persistentQueue.markSuccess(job.jobId);
      this.logger.log(
        "Automatic WMC commitment verified:",
        path.basename(job.filePath),
      );
      return;
    }

    const errorMessage = result?.error
      ? `WMC_START_FAILED: ${result.error.message}`
      : `WMC_EXIT_${result?.code ?? "UNKNOWN"}`;
    const nextAttempt = job.attempt + 1;
    if (nextAttempt >= this.maxRetries) {
      this.persistentQueue.markFailed(job.jobId, errorMessage);
      this.logger.error(
        "Maximum WMC retries reached:",
        path.basename(job.filePath),
      );
      return;
    }

    const delay = this.retryDelayMs * Math.pow(2, job.attempt);
    this.persistentQueue.scheduleRetry(job.jobId, {
      attempt: nextAttempt,
      delayMs: delay,
      error: errorMessage,
    });
    this.pendingTimers += 1;
    this.schedule(() => {
      this.pendingTimers -= 1;
      this.queue.unshift({ ...job, attempt: nextAttempt });
      this._start();
    }, delay);
  }
}

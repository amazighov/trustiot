import fs from 'fs';
import path from 'path';

const DEFAULT_QUEUE_DIR =
  path.resolve('data/private/queue');

export class PersistentRetryQueue {
  constructor({
    queueDir = DEFAULT_QUEUE_DIR
  } = {}) {
    this.queueDir = queueDir;

    fs.mkdirSync(
      this.queueDir,
      {
        recursive: true
      }
    );
  }

  // --------------------------------------------------
  // Internal helpers
  // --------------------------------------------------

  _jobPath(id) {
    return path.join(
      this.queueDir,
      `${id}.json`
    );
  }

  _makeId(filePath) {
    return path
      .basename(filePath)
      .replace(
        /[^a-zA-Z0-9._-]/g,
        '_'
      );
  }

  _write(job) {
    fs.writeFileSync(
      this._jobPath(job.id),
      JSON.stringify(
        job,
        null,
        2
      )
    );

    return job;
  }

  _update(
    id,
    patch
  ) {
    const current =
      this.get(id);

    if (!current) {
      throw new Error(
        `Queue job not found: ${id}`
      );
    }

    const updated = {
      ...current,
      ...patch
    };

    this._write(
      updated
    );

    return updated;
  }


  // --------------------------------------------------
  // Create / read jobs
  // --------------------------------------------------

  enqueue(
    filePath,
    attempt = 0
  ) {
    const id =
      this._makeId(
        filePath
      );

    const existing =
      this.get(id);

    if (existing) {
      return existing;
    }

    const now =
      new Date()
        .toISOString();

    const job = {
      id,

      filePath:
        path.resolve(
          filePath
        ),

      attempt,

      status:
        'PENDING',

      createdAt:
        now,

      updatedAt:
        now,

      nextAttemptAt:
        null,

      lastError:
        null
    };

    this._write(
      job
    );

    return job;
  }

  get(id) {
    const file =
      this._jobPath(id);

    if (
      !fs.existsSync(
        file
      )
    ) {
      return null;
    }

    return JSON.parse(
      fs.readFileSync(
        file,
        'utf8'
      )
    );
  }

  list() {
    return fs
      .readdirSync(
        this.queueDir
      )
      .filter(
        file =>
          file.endsWith(
            '.json'
          )
      )
      .map(file => {
        const fullPath =
          path.join(
            this.queueDir,
            file
          );

        return JSON.parse(
          fs.readFileSync(
            fullPath,
            'utf8'
          )
        );
      })
      .sort(
        (a, b) =>
          new Date(
            a.createdAt
          ).getTime() -
          new Date(
            b.createdAt
          ).getTime()
      );
  }


  // --------------------------------------------------
  // Startup recovery
  // --------------------------------------------------

  recoverPending() {
    const now =
      Date.now();

    return this
      .list()
      .filter(job => {
        // PENDING jobs have never finished.
        if (
          job.status ===
          'PENDING'
        ) {
          return true;
        }

        // If the process stopped while a job was
        // PROCESSING, it must be recovered on restart.
        if (
          job.status ===
          'PROCESSING'
        ) {
          return true;
        }

        // Retry only when the scheduled delay expired.
        if (
          job.status ===
          'RETRY_WAIT'
        ) {
          if (
            !job.nextAttemptAt
          ) {
            return true;
          }

          const nextAttempt =
            new Date(
              job.nextAttemptAt
            ).getTime();

          return (
            Number.isFinite(
              nextAttempt
            ) &&
            nextAttempt <= now
          );
        }

        return false;
      });
  }


  // --------------------------------------------------
  // State transitions
  // --------------------------------------------------

  markProcessing(id) {
    return this._update(
      id,
      {
        status:
          'PROCESSING',

        nextAttemptAt:
          null,

        updatedAt:
          new Date()
            .toISOString()
      }
    );
  }

  scheduleRetry(
    id,
    {
      attempt,
      delayMs,
      error = null
    }
  ) {
    const nextAttemptAt =
      new Date(
        Date.now() +
        delayMs
      ).toISOString();

    return this._update(
      id,
      {
        attempt,

        status:
          'RETRY_WAIT',

        nextAttemptAt,

        lastError:
          error,

        updatedAt:
          new Date()
            .toISOString()
      }
    );
  }

  markSuccess(id) {
    const job =
      this.get(id);

    if (!job) {
      return false;
    }

    fs.rmSync(
      this._jobPath(id),
      {
        force: true
      }
    );

    return true;
  }

  markFailed(
    id,
    error = null
  ) {
    return this._update(
      id,
      {
        status:
          'FAILED',

        nextAttemptAt:
          null,

        lastError:
          error,

        updatedAt:
          new Date()
            .toISOString()
      }
    );
  }
}
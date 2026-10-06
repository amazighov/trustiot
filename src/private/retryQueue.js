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
  const finalPath =
    this._jobPath(
      job.id
    );

  const tempPath =
    `${finalPath}.tmp`;

  const serialized =
    JSON.stringify(
      job,
      null,
      2
    );

  try {
    fs.writeFileSync(
      tempPath,
      serialized,
      {
        encoding: 'utf8',
        flag: 'w'
      }
    );

    // Validate what was actually written
    // before replacing the current job.
    JSON.parse(
      fs.readFileSync(
        tempPath,
        'utf8'
      )
    );

    fs.renameSync(
      tempPath,
      finalPath
    );

  } catch (error) {
    try {
      if (
        fs.existsSync(
          tempPath
        )
      ) {
        fs.unlinkSync(
          tempPath
        );
      }
    } catch {
      // Preserve original error.
    }

    throw error;
  }

  return job;
}

  _update(
    id,
    changes
  ) {
    const job =
      this.get(id);

    if (!job) {
      return null;
    }

    return this._write({
      ...job,
      ...changes,

      // Queue identity and source artifact are immutable.
      id:
        job.id,

      filePath:
        job.filePath,

      createdAt:
        job.createdAt
    });
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
    this._jobPath(
      id
    );

  if (
    !fs.existsSync(
      file
    )
  ) {
    return null;
  }

  try {
    return JSON.parse(
      fs.readFileSync(
        file,
        'utf8'
      )
    );

  } catch (error) {
    this._quarantineFile(
      file,
      error.message
    );

    return null;
  }
}
list() {
  const jobs =
    [];

  const files =
    fs
      .readdirSync(
        this.queueDir
      )
      .filter(
        file =>
          file.endsWith(
            '.json'
          )
      );

  for (
    const file
    of files
  ) {
    const fullPath =
      path.join(
        this.queueDir,
        file
      );

    try {
      const raw =
        fs.readFileSync(
          fullPath,
          'utf8'
        );

      const job =
        JSON.parse(
          raw
        );

      jobs.push(
        job
      );

    } catch (error) {
      this._quarantineFile(
        fullPath,
        error.message
      );

      // One damaged job must never prevent
      // recovery of the remaining queue.
      continue;
    }
  }

  return jobs.sort(
    (a, b) =>
      new Date(
        a.createdAt
      ).getTime() -
      new Date(
        b.createdAt
      ).getTime()
  );
}
_quarantineFile(
  fullPath,
  reason
) {
  const quarantineDir =
    path.join(
      this.queueDir,
      'quarantine'
    );

  fs.mkdirSync(
    quarantineDir,
    {
      recursive: true
    }
  );

  const originalName =
    path.basename(
      fullPath
    );

  const quarantineName =
    `${Date.now()}-${originalName}`;

  const quarantinePath =
    path.join(
      quarantineDir,
      quarantineName
    );

  try {
    fs.renameSync(
      fullPath,
      quarantinePath
    );

    console.error(
      'QUEUE_JOB_QUARANTINED',
      originalName,
      `reason=${reason}`
    );

    return quarantinePath;

  } catch (error) {
    console.error(
      'QUEUE_QUARANTINE_FAILED',
      originalName,
      error.message
    );

    return null;
  }
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

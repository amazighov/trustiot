import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  spawnSync
} from 'child_process';


// ----------------------------------------------------
// Isolated persistent state
// ----------------------------------------------------

const tempDir =
  fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      'trustiot-replay-test-'
    )
  );

const statePath =
  path.join(
    tempDir,
    'device-state.json'
  );


// ----------------------------------------------------
// Run replay test in isolated process
// ----------------------------------------------------

const result =
  spawnSync(
    process.execPath,
    [
      'test-device-replay-worker.js'
    ],
    {
      stdio:
        'inherit',

      env: {
        ...process.env,

        TRUSTIOT_DEVICE_STATE_PATH:
          statePath
      }
    }
  );


// ----------------------------------------------------
// Cleanup
// ----------------------------------------------------

fs.rmSync(
  tempDir,
  {
    recursive: true,
    force: true
  }
);


// ----------------------------------------------------
// Result
// ----------------------------------------------------

if (
  result.error
) {
  throw result.error;
}


if (
  result.status !== 0
) {
  process.exitCode =
    result.status ?? 1;
}
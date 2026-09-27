import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  spawn
} from 'node:child_process';


// ----------------------------------------------------
// Temporary isolated environment
// ----------------------------------------------------

const tempRoot =
  fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      'trustiot-receiver-hardening-'
    )
  );

const registryPath =
  path.join(
    tempRoot,
    'devices.json'
  );

const statePath =
  path.join(
    tempRoot,
    'device-state.json'
  );

const queueDir =
  path.join(
    tempRoot,
    'queue'
  );

const batchesDir =
  path.join(
    tempRoot,
    'batches'
  );

const publicKeyPath =
  path.join(
    tempRoot,
    'test-public.pem'
  );


// ----------------------------------------------------
// Test device key
// ----------------------------------------------------

const {
  privateKey,
  publicKey
} =
  crypto.generateKeyPairSync(
    'ec',
    {
      namedCurve:
        'prime256v1'
    }
  );


fs.writeFileSync(
  publicKeyPath,
  publicKey.export({
    type:
      'spki',

    format:
      'pem'
  }),
  'utf8'
);


// ----------------------------------------------------
// Test-only device registry
// ----------------------------------------------------

fs.writeFileSync(
  registryPath,
  JSON.stringify(
    {
      schema:
        'trustiot.device.registry.v1',

      devices: [
        {
          deviceId:
            'security-test-device',

          sensor:
            'bme280',

          publicKeyEnv:
            'TRUSTIOT_TEST_PUBLIC_KEY_PATH',

          enabled:
            true
        }
      ]
    },
    null,
    2
  ),
  'utf8'
);


// ----------------------------------------------------
// Test server
// ----------------------------------------------------

const PORT =
  31991;

let receiver;

let receiverOutput =
  '';


function startReceiver() {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      receiver =
        spawn(
          process.execPath,
          [
            path.resolve(
              'receiver.js'
            )
          ],
          {
            env: {
              ...process.env,

              PORT:
                String(
                  PORT
                ),

              TRUSTIOT_DEVICE_STATE_PATH:
                statePath,

              TRUSTIOT_RETRY_QUEUE_DIR:
                queueDir,

              TRUSTIOT_DEVICE_REGISTRY_PATH:
                registryPath,

              TRUSTIOT_BATCHES_DIR:
                batchesDir,

              TRUSTIOT_TEST_PUBLIC_KEY_PATH:
                publicKeyPath
            },

            stdio: [
              'ignore',
              'pipe',
              'pipe'
            ]
          }
        );


      const timeout =
        setTimeout(
          () => {
            reject(
              new Error(
                `Receiver startup timeout\n${receiverOutput}`
              )
            );
          },
          10000
        );


      const inspectOutput =
        chunk => {
          const text =
            chunk.toString(
              'utf8'
            );

          receiverOutput +=
            text;

          if (
            receiverOutput.includes(
              `listening on port ${PORT}`
            )
          ) {
            clearTimeout(
              timeout
            );

            resolve();
          }
        };


      receiver.stdout.on(
        'data',
        inspectOutput
      );

      receiver.stderr.on(
        'data',
        inspectOutput
      );


      receiver.once(
        'exit',
        code => {
          clearTimeout(
            timeout
          );

          if (
            code !== null &&
            !receiverOutput.includes(
              `listening on port ${PORT}`
            )
          ) {
            reject(
              new Error(
                `Receiver exited during startup: ${code}\n${receiverOutput}`
              )
            );
          }
        }
      );
    }
  );
}


// ----------------------------------------------------
// HTTP helper
// ----------------------------------------------------

async function postRaw(
  body,
  headers = {
    'Content-Type':
      'application/json'
  }
) {
  return fetch(
    `http://127.0.0.1:${PORT}/sensor`,
    {
      method:
        'POST',

      headers,

      body
    }
  );
}


// ----------------------------------------------------
// Canonical device reading
// Must match TrustIoT canonical representation.
// ----------------------------------------------------

function canonicalReading(
  reading
) {
  return JSON.stringify({
    schema:
      'trustiot.device.attestation.v1',

    deviceId:
      reading.deviceId,

    sensor:
      reading.sensor,

    temperature:
      Number(
        reading.temperature
      ).toFixed(
        2
      ),

    humidity:
      Number(
        reading.humidity
      ).toFixed(
        2
      ),

    pressure:
      Number(
        reading.pressure
      ).toFixed(
        2
      ),

    timestamp:
      reading.timestamp,

    sequence:
      reading.sequence
  });
}


function signedPayload(
  {
    sequence,
    timestamp =
      Math.floor(
        Date.now() / 1000
      )
  }
) {
  const reading = {
    deviceId:
      'security-test-device',

    sensor:
      'bme280',

    temperature:
      25.25,

    humidity:
      50.50,

    pressure:
      1000.25,

    timestamp,

    sequence
  };


  const signature =
    crypto
      .sign(
        'sha256',

        Buffer.from(
          canonicalReading(
            reading
          ),
          'utf8'
        ),

        {
          key:
            privateKey,

          dsaEncoding:
            'der'
        }
      )
      .toString(
        'base64'
      );


  return {
    ...reading,
    signature
  };
}


// ----------------------------------------------------
// Tests
// ----------------------------------------------------

test(
  'receiver hardening rejects hostile input and remains available',
  async t => {
    await startReceiver();


    t.after(
      () => {
        if (
          receiver &&
          !receiver.killed
        ) {
          receiver.kill(
            'SIGTERM'
          );
        }

        fs.rmSync(
          tempRoot,
          {
            recursive:
              true,

            force:
              true
          }
        );
      }
    );


    // ------------------------------------------------
    // Oversized request
    // ------------------------------------------------

    {
      const response =
        await postRaw(
          JSON.stringify({
            junk:
              'A'.repeat(
                20000
              )
          })
        );

      assert.equal(
        response.status,
        413
      );
    }


    // ------------------------------------------------
    // Malformed JSON
    // ------------------------------------------------

    {
      const response =
        await postRaw(
          '{"broken":'
        );

      assert.equal(
        response.status,
        400
      );
    }


    // ------------------------------------------------
    // Missing fields
    // ------------------------------------------------

    {
      const response =
        await postRaw(
          '{}'
        );

      assert.equal(
        response.status,
        400
      );
    }

    // ------------------------------------------------
// Unknown device
// ------------------------------------------------

{
  const payload =
    signedPayload({
      sequence:
        1
    });

  payload.deviceId =
    'unknown-device';

  const response =
    await postRaw(
      JSON.stringify(
        payload
      )
    );

  assert.equal(
    response.status,
    400
  );

  const result =
    await response.json();

  assert.equal(
    result.ok,
    false
  );

  assert.match(
    result.error,
    /Unknown device/
  );
}


// ------------------------------------------------
// Tampered signed reading
// ------------------------------------------------

{
  const payload =
    signedPayload({
      sequence:
        1
    });

  // Signature was generated for 25.25.
  // Modify the reading after signing.
  payload.temperature =
    26.25;

  const response =
    await postRaw(
      JSON.stringify(
        payload
      )
    );

  assert.equal(
    response.status,
    400
  );

  const result =
    await response.json();

  assert.equal(
    result.ok,
    false
  );

  assert.match(
    result.error,
    /Invalid device signature/
  );
}

    // ------------------------------------------------
    // Future timestamp
    // ------------------------------------------------

    {
      const payload =
        signedPayload({
          sequence:
            1,

          timestamp:
            Math.floor(
              Date.now() / 1000
            ) +
            3600
        });

      const response =
        await postRaw(
          JSON.stringify(
            payload
          )
        );

      assert.equal(
        response.status,
        400
      );
    }


    // ------------------------------------------------
    // Valid fresh reading
    // ------------------------------------------------

    const validPayload =
      signedPayload({
        sequence:
          1
      });

    {
      const response =
        await postRaw(
          JSON.stringify(
            validPayload
          )
        );

      assert.equal(
        response.status,
        200
      );

      const result =
        await response.json();

      assert.equal(
        result.ok,
        true
      );

      assert.equal(
        result.deviceOriginVerified,
        true
      );
    }


    // ------------------------------------------------
    // Replay
    // ------------------------------------------------

    {
      const response =
        await postRaw(
          JSON.stringify(
            validPayload
          )
        );

      assert.equal(
        response.status,
        400
      );

      const result =
        await response.json();

      assert.equal(
        result.ok,
        false
      );

      assert.match(
        result.error,
        /Replay detected/
      );
    }


    // ------------------------------------------------
    // Receiver must still be alive.
    // Send another fresh sequence.
    // ------------------------------------------------

    {
      const payload =
        signedPayload({
          sequence:
            2
        });

      const response =
        await postRaw(
          JSON.stringify(
            payload
          )
        );

      assert.equal(
        response.status,
        200
      );
    }


    assert.equal(
      receiver.exitCode,
      null
    );
  }
);

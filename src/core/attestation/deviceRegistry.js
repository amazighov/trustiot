import fs from 'fs';
import path from 'path';


// ----------------------------------------------------
// Persistent device state
// ----------------------------------------------------

const stateDir =
  path.resolve(
    'data/private'
  );

const statePath =
  process.env.TRUSTIOT_DEVICE_STATE_PATH
    ? path.resolve(
        process.env.TRUSTIOT_DEVICE_STATE_PATH
      )
    : path.join(
        stateDir,
        'device-state.json'
      );

fs.mkdirSync(
  path.dirname(
    statePath
  ),
  {
    recursive: true
  }
);


// ----------------------------------------------------
// Runtime device registry
// ----------------------------------------------------

const devices =
  new Map();


// ----------------------------------------------------
// Load persistent state
// ----------------------------------------------------

function loadPersistentState() {
  if (
    !fs.existsSync(
      statePath
    )
  ) {
    return {
      schema:
        'trustiot.device.state.v1',

      devices:
        {}
    };
  }

  try {
    const content =
      fs.readFileSync(
        statePath,
        'utf8'
      );

    const parsed =
      JSON.parse(
        content
      );

    if (
      !parsed ||
      typeof parsed !==
        'object'
    ) {
      throw new Error(
        'Invalid persistent device state'
      );
    }

    if (
      !parsed.devices ||
      typeof parsed.devices !==
        'object'
    ) {
      throw new Error(
        'Invalid persistent device state: devices missing'
      );
    }

    return parsed;

  } catch (error) {
    throw new Error(
      `Failed to load device state: ${error.message}`
    );
  }
}


// ----------------------------------------------------
// Persist current sequence state
// ----------------------------------------------------

function savePersistentState() {
  const persistentDevices =
    {};

  for (
    const [
      deviceId,
      device
    ]
    of devices
  ) {
    persistentDevices[
      deviceId
    ] = {
      lastSequence:
        device.lastSequence
    };
  }

  const state = {
    schema:
      'trustiot.device.state.v1',

    updatedAt:
      new Date()
        .toISOString(),

    devices:
      persistentDevices
  };

  const temporaryPath =
    `${statePath}.tmp`;

  fs.writeFileSync(
    temporaryPath,

    JSON.stringify(
      state,
      null,
      2
    ),

    {
      encoding:
        'utf8',

      mode:
        0o600
    }
  );

  try {
    fs.renameSync(
      temporaryPath,
      statePath
    );

  } catch (error) {
    // Windows may occasionally refuse replacement
    // of an existing file.

    if (
      fs.existsSync(
        statePath
      )
    ) {
      fs.unlinkSync(
        statePath
      );
    }

    fs.renameSync(
      temporaryPath,
      statePath
    );
  }
}


// ----------------------------------------------------
// State loaded once when module starts
// ----------------------------------------------------

const persistentState =
  loadPersistentState();


// ----------------------------------------------------
// Register trusted device
// ----------------------------------------------------

export function registerDevice({
  deviceId,
  publicKey
}) {
  if (!deviceId) {
    throw new Error(
      'deviceId is required'
    );
  }

  if (!publicKey) {
    throw new Error(
      'publicKey is required'
    );
  }

  if (
    devices.has(
      deviceId
    )
  ) {
    throw new Error(
      `Device already registered: ${deviceId}`
    );
  }


  const storedDevice =
    persistentState
      .devices[
        deviceId
      ];


  let lastSequence =
    -1;


  if (
    storedDevice &&
    Number.isInteger(
      storedDevice.lastSequence
    ) &&
    storedDevice.lastSequence >=
      -1
  ) {
    lastSequence =
      storedDevice.lastSequence;
  }


  devices.set(
    deviceId,
    {
      deviceId,

      publicKey,

      lastSequence
    }
  );


  return true;
}


// ----------------------------------------------------
// Get registered device
// ----------------------------------------------------

export function getDevice(
  deviceId
) {
  return (
    devices.get(
      deviceId
    ) ??
    null
  );
}


// ----------------------------------------------------
// Verify sequence freshness
// ----------------------------------------------------

export function assertFreshSequence(
  deviceId,
  sequence
) {
  const device =
    getDevice(
      deviceId
    );

  if (!device) {
    throw new Error(
      `Unknown device: ${deviceId}`
    );
  }


  if (
    !Number.isInteger(
      sequence
    ) ||
    sequence < 0
  ) {
    throw new Error(
      `Invalid sequence: ${sequence}`
    );
  }


  if (
    sequence <=
    device.lastSequence
  ) {
    throw new Error(
      `Replay detected for ${deviceId}: sequence=${sequence}, lastSequence=${device.lastSequence}`
    );
  }


  return true;
}


// ----------------------------------------------------
// Commit accepted sequence
// ----------------------------------------------------

export function commitSequence(
  deviceId,
  sequence
) {
  const device =
    getDevice(
      deviceId
    );

  if (!device) {
    throw new Error(
      `Unknown device: ${deviceId}`
    );
  }


  if (
    !Number.isInteger(
      sequence
    ) ||
    sequence < 0
  ) {
    throw new Error(
      `Invalid sequence: ${sequence}`
    );
  }


  // Defensive check:
  // commitSequence itself must never move backwards.
  if (
    sequence <=
    device.lastSequence
  ) {
    throw new Error(
      `Cannot commit stale sequence for ${deviceId}: sequence=${sequence}, lastSequence=${device.lastSequence}`
    );
  }


  device.lastSequence =
    sequence;


  // Keep the in-memory representation used for
  // registration in sync too.
  persistentState.devices[
    deviceId
  ] = {
    lastSequence:
      sequence
  };


  savePersistentState();


  return true;
}
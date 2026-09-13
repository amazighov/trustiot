import fs from 'fs';
import path from 'path';

import {
  registerDevice
} from './deviceRegistry.js';


const DEFAULT_CONFIG_PATH =
  path.resolve(
    'config/devices.json'
  );


export function loadDeviceRegistry(
  configPath = DEFAULT_CONFIG_PATH
) {
  if (
    !fs.existsSync(
      configPath
    )
  ) {
    throw new Error(
      `Device registry config not found: ${configPath}`
    );
  }

  let config;

  try {
    config =
      JSON.parse(
        fs.readFileSync(
          configPath,
          'utf8'
        )
      );
  } catch (error) {
    throw new Error(
      `Failed to load device registry config: ${error.message}`
    );
  }


  if (
    config.schema !==
    'trustiot.device.registry.v1'
  ) {
    throw new Error(
      `Unsupported device registry schema: ${config.schema}`
    );
  }


  if (
    !Array.isArray(
      config.devices
    )
  ) {
    throw new Error(
      'Device registry devices must be an array'
    );
  }


  const seenDeviceIds =
    new Set();

  let registeredCount =
    0;


  for (
    const entry
    of config.devices
  ) {
    if (
      !entry ||
      typeof entry !==
        'object'
    ) {
      throw new Error(
        'Invalid device registry entry'
      );
    }


    if (
      typeof entry.deviceId !==
        'string' ||
      entry.deviceId.length ===
        0
    ) {
      throw new Error(
        'Device registry entry requires deviceId'
      );
    }


    if (
      seenDeviceIds.has(
        entry.deviceId
      )
    ) {
      throw new Error(
        `Duplicate deviceId in registry: ${entry.deviceId}`
      );
    }

    seenDeviceIds.add(
      entry.deviceId
    );


    if (
      entry.enabled ===
      false
    ) {
      console.log(
        'Trusted device disabled:',
        entry.deviceId
      );

      continue;
    }


    if (
      typeof entry.publicKeyEnv !==
        'string' ||
      entry.publicKeyEnv.length ===
        0
    ) {
      throw new Error(
        `publicKeyEnv is required for ${entry.deviceId}`
      );
    }


    const publicKeyPath =
      process.env[
        entry.publicKeyEnv
      ];


    if (!publicKeyPath) {
      throw new Error(
        `${entry.publicKeyEnv} is required for ${entry.deviceId}`
      );
    }


    if (
      !fs.existsSync(
        publicKeyPath
      )
    ) {
      throw new Error(
        `Public key not found for ${entry.deviceId}: ${publicKeyPath}`
      );
    }


    const publicKey =
      fs.readFileSync(
        publicKeyPath,
        'utf8'
      );


    registerDevice({
      deviceId:
        entry.deviceId,

      publicKey
    });


    registeredCount++;


    console.log(
      'Registered trusted device:',
      entry.deviceId
    );
  }


  if (
    registeredCount ===
    0
  ) {
    throw new Error(
      'No enabled trusted devices registered'
    );
  }


  return {
    schema:
      config.schema,

    registeredCount
  };
}

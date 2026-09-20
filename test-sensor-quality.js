import {
  inspectSensorQuality,
  resetSensorQualityState
} from './src/core/attestation/sensorQuality.js';

resetSensorQualityState();

const baseReading = {
  deviceId:
    'esp32-test',

  sensor:
    'bme280',

  temperature:
    21.31,

  humidity:
    95.94,

  pressure:
    712.80
};

for (
  let i = 1;
  i <= 12;
  i++
) {
  const result =
    inspectSensorQuality(
      {
        ...baseReading
      },
      {
        staleThreshold:
          10
      }
    );

  console.log(
    i,
    result.status,
    `identicalCount=${result.identicalCount}`
  );
}

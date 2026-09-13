export function canonicalDeviceReading(
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
      ).toFixed(2),

    humidity:
      Number(
        reading.humidity
      ).toFixed(2),

    pressure:
      Number(
        reading.pressure
      ).toFixed(2),

    timestamp:
      reading.timestamp,

    sequence:
      reading.sequence
  });
}
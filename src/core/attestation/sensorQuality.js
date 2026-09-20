const deviceHistory =
  new Map();

const DEFAULT_STALE_THRESHOLD =
  10;


function sameValues(
  a,
  b
) {
  return (
    a.temperature === b.temperature &&
    a.humidity === b.humidity &&
    a.pressure === b.pressure
  );
}


export function inspectSensorQuality(
  reading,
  options = {}
) {
  const staleThreshold =
    options.staleThreshold ??
    DEFAULT_STALE_THRESHOLD;

  const previous =
    deviceHistory.get(
      reading.deviceId
    );


  let identicalCount =
    1;


  if (
    previous &&
    sameValues(
      previous.reading,
      reading
    )
  ) {
    identicalCount =
      previous.identicalCount + 1;
  }


  deviceHistory.set(
    reading.deviceId,
    {
      reading: {
        temperature:
          reading.temperature,

        humidity:
          reading.humidity,

        pressure:
          reading.pressure
      },

      identicalCount
    }
  );


  const stale =
    identicalCount >=
    staleThreshold;


  return {
    status:
      stale
        ? 'SUSPICIOUS_STALE'
        : 'NORMAL',

    stale,

    identicalCount,

    threshold:
      staleThreshold
  };
}


export function resetSensorQualityState(
  deviceId = null
) {
  if (
    deviceId === null
  ) {
    deviceHistory.clear();

    return;
  }

  deviceHistory.delete(
    deviceId
  );
}

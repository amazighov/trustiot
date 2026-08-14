const usedNonces = new Map();

export function validateReplayProtection(
  signedManifest,
  {
    maxAgeMs = 5 * 60 * 1000,
    now = Date.now()
  } = {}
) {
  const {
    signerId,
    timestamp,
    nonce
  } = signedManifest;

  if (!signerId || !timestamp || !nonce) {
    return {
      valid: false,
      reason: 'missing replay-protection fields'
    };
  }

  const signedAt =
    Date.parse(timestamp);

  if (Number.isNaN(signedAt)) {
    return {
      valid: false,
      reason: 'invalid timestamp'
    };
  }

  const ageMs =
    now - signedAt;

  if (
    ageMs < 0 ||
    ageMs > maxAgeMs
  ) {
    return {
      valid: false,
      reason: 'timestamp outside allowed window'
    };
  }

  const nonceKey =
    `${signerId}:${nonce}`;

  if (usedNonces.has(nonceKey)) {
    return {
      valid: false,
      reason: 'nonce already used'
    };
  }

  usedNonces.set(
    nonceKey,
    signedAt
  );

  cleanupExpiredNonces(
    now,
    maxAgeMs
  );

  return {
    valid: true,
    reason: null
  };
}

function cleanupExpiredNonces(
  now,
  maxAgeMs
) {
  for (
    const [key, signedAt]
    of usedNonces.entries()
  ) {
    if (
      now - signedAt >
      maxAgeMs
    ) {
      usedNonces.delete(key);
    }
  }
}

export function clearReplayCache() {
  usedNonces.clear();
}


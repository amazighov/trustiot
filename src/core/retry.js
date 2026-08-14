export async function withRetry(
  operation,
  {
    attempts = 3,
    baseDelayMs = 500,
    shouldRetry = () => true,
    label = 'operation'
  } = {}
) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const retryable =
        attempt < attempts &&
        shouldRetry(error);

      if (!retryable) {
        throw error;
      }

      const delayMs =
        baseDelayMs * (2 ** (attempt - 1));

      console.warn(
        `[retry] ${label} failed ` +
        `(attempt ${attempt}/${attempts}). ` +
        `Retrying in ${delayMs}ms...`
      );

      await new Promise((resolve) =>
        setTimeout(resolve, delayMs)
      );
    }
  }

  throw lastError;
}

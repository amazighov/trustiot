import { FabricGatewayAdapter } from './fabricGateway.js';
import { withRetry } from '../core/retry.js';
import { logEvent } from '../core/logger.js';

function isTransientFabricError(error) {
  const text =
    `${error?.message ?? ''} ${error?.cause?.message ?? ''}`
      .toLowerCase();

  return (
    text.includes('unavailable') ||
    text.includes('econnrefused') ||
    text.includes('connection refused') ||
    text.includes('deadline exceeded') ||
    text.includes('connection reset') ||
    text.includes('econnreset')
  );
}

export class FabricLedgerAdapter {
  constructor(options = {}) {
    this.options = options;
  }

  async register(manifest) {
    logEvent('FABRIC_REGISTER_START', {
      datasetId: manifest.datasetId
    });

    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const fabric =
        new FabricGatewayAdapter(this.options);

      try {
        await withRetry(
          () => fabric.connect(),
          {
            attempts: 3,
            baseDelayMs: 500,
            shouldRetry: isTransientFabricError,
            label: 'Fabric connect'
          }
        );

        const exists =
          await fabric.datasetExists(
            manifest.datasetId
          );

        if (exists) {
          const record =
            await fabric.readDataset(
              manifest.datasetId
            );

          logEvent(
            'FABRIC_REGISTER_ALREADY_EXISTS',
            {
              datasetId: record.datasetId,
              recoveredAfterRetry:
                attempt > 1
            }
          );

          return {
            driver: 'fabric',
            transactionId: null,
            datasetId: record.datasetId,
            alreadyExists: true,
            recoveredAfterRetry:
              attempt > 1,
            record
          };
        }

        const result =
          await fabric.registerDataset(
            manifest
          );
if (
  process.env.TRUSTIOT_FAULT_AFTER_FABRIC_COMMIT === '1'
) {
  const simulatedError =
    new Error(
      'Simulated connection reset after Fabric commit'
    );

  simulatedError.code = 'ECONNRESET';

  throw simulatedError;
}
        logEvent(
          'FABRIC_REGISTER_SUCCESS',
          {
            datasetId:
              result.record.datasetId,
            transactionId:
              result.transactionId
          }
        );

        return {
          driver: 'fabric',
          transactionId:
            result.transactionId,
          datasetId:
            result.record.datasetId,
          alreadyExists: false,
          recoveredAfterRetry: false,
          record: result.record
        };
      } catch (error) {
        if (!isTransientFabricError(error)) {
          logEvent(
            'FABRIC_REGISTER_FAILED',
            {
              datasetId:
                manifest.datasetId,
              error:
                error?.message ??
                String(error)
            }
          );

          throw error;
        }

        try {
          const recovery =
            new FabricGatewayAdapter(
              this.options
            );

          try {
            await recovery.connect();

            const exists =
              await recovery.datasetExists(
                manifest.datasetId
              );

            if (exists) {
              const record =
                await recovery.readDataset(
                  manifest.datasetId
                );

              logEvent(
                'FABRIC_REGISTER_RECOVERED',
                {
                  datasetId:
                    record.datasetId
                }
              );

              return {
                driver: 'fabric',
                transactionId: null,
                datasetId:
                  record.datasetId,
                alreadyExists: true,
                recoveredAfterRetry: true,
                record
              };
            }
          } finally {
            recovery.close();
          }
        } catch (recoveryError) {
          if (
            !isTransientFabricError(
              recoveryError
            )
          ) {
            throw recoveryError;
          }
        }

        if (attempt >= maxAttempts) {
          logEvent(
            'FABRIC_REGISTER_FAILED',
            {
              datasetId:
                manifest.datasetId,
              attempts: maxAttempts,
              error:
                error?.message ??
                String(error)
            }
          );

          throw error;
        }

        const delayMs =
          500 * (2 ** (attempt - 1));

        logEvent('FABRIC_REGISTER_RETRY', {
          datasetId:
            manifest.datasetId,
          attempt,
          maxAttempts,
          delayMs
        });

        console.warn(
          `[retry] Fabric register failed ` +
          `(attempt ${attempt}/${maxAttempts}). ` +
          `Dataset not found after recovery check. ` +
          `Retrying in ${delayMs}ms...`
        );

        await new Promise((resolve) =>
          setTimeout(resolve, delayMs)
        );
      } finally {
        fabric.close();
      }
    }

    throw new Error(
      `Unable to register dataset ${manifest.datasetId}`
    );
  }

  async read(datasetId) {
    const fabric =
      new FabricGatewayAdapter(
        this.options
      );

    try {
      await withRetry(
        () => fabric.connect(),
        {
          attempts: 3,
          baseDelayMs: 500,
          shouldRetry:
            isTransientFabricError,
          label: 'Fabric connect'
        }
      );

      return await withRetry(
        () =>
          fabric.readDataset(
            datasetId
          ),
        {
          attempts: 3,
          baseDelayMs: 500,
          shouldRetry:
            isTransientFabricError,
          label: 'Fabric read'
        }
      );
    } finally {
      fabric.close();
    }
  }

  async setVerificationStatus(
    datasetId,
    status
  ) {
    const maxAttempts = 3;

    for (
      let attempt = 1;
      attempt <= maxAttempts;
      attempt++
    ) {
      const fabric =
        new FabricGatewayAdapter(
          this.options
        );

      try {
        await withRetry(
          () => fabric.connect(),
          {
            attempts: 3,
            baseDelayMs: 500,
            shouldRetry:
              isTransientFabricError,
            label: 'Fabric connect'
          }
        );

        const current =
          await fabric.readDataset(
            datasetId
          );

        if (
          current.verificationStatus ===
          status
        ) {
          logEvent(
            'FABRIC_STATUS_ALREADY_SET',
            {
              datasetId,
              status
            }
          );

          return {
            ...current,
            statusAlreadySet: true,
            recoveredAfterRetry:
              attempt > 1
          };
        }

        const updated =
          await fabric
            .setVerificationStatus(
              datasetId,
              status
            );

        logEvent(
          'FABRIC_STATUS_UPDATED',
          {
            datasetId,
            status
          }
        );

        return {
          ...updated,
          statusAlreadySet: false,
          recoveredAfterRetry: false
        };
      } catch (error) {
        if (
          !isTransientFabricError(error)
        ) {
          logEvent(
            'FABRIC_STATUS_FAILED',
            {
              datasetId,
              status,
              error:
                error?.message ??
                String(error)
            }
          );

          throw error;
        }

        try {
          const recovery =
            new FabricGatewayAdapter(
              this.options
            );

          try {
            await recovery.connect();

            const current =
              await recovery.readDataset(
                datasetId
              );

            if (
              current.verificationStatus ===
              status
            ) {
              logEvent(
                'FABRIC_STATUS_RECOVERED',
                {
                  datasetId,
                  status
                }
              );

              return {
                ...current,
                statusAlreadySet: true,
                recoveredAfterRetry: true
              };
            }
          } finally {
            recovery.close();
          }
        } catch (recoveryError) {
          if (
            !isTransientFabricError(
              recoveryError
            )
          ) {
            throw recoveryError;
          }
        }

        if (attempt >= maxAttempts) {
          logEvent(
            'FABRIC_STATUS_FAILED',
            {
              datasetId,
              status,
              attempts: maxAttempts,
              error:
                error?.message ??
                String(error)
            }
          );

          throw error;
        }

        const delayMs =
          500 * (2 ** (attempt - 1));

        logEvent(
          'FABRIC_STATUS_RETRY',
          {
            datasetId,
            status,
            attempt,
            maxAttempts,
            delayMs
          }
        );

        console.warn(
          `[retry] Fabric verification update failed ` +
          `(attempt ${attempt}/${maxAttempts}). ` +
          `Requested status not confirmed. ` +
          `Retrying in ${delayMs}ms...`
        );

        await new Promise((resolve) =>
          setTimeout(resolve, delayMs)
        );
      } finally {
        fabric.close();
      }
    }

    throw new Error(
      `Unable to update verification status for ${datasetId}`
    );
  }
}
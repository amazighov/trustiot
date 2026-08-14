import { spawn } from 'node:child_process';

export class FilecoinPinAdapter {
  constructor({
    binary = process.env.FILECOIN_PIN_BIN || 'filecoin-pin',
    network = process.env.FILECOIN_NETWORK || 'calibration'
  } = {}) {
    this.binary = binary;
    this.network = network;
  }

  async store(filePath) {
    const output = await run(this.binary, [
      'add',
      filePath,
      '--network',
      this.network
    ]);

    // Keep the full CLI output because filecoin-pin output can evolve.
    // Extract known identifiers when present.
    const ipfsRootCid =
     output.match(/(?:IPFS\s+)?Root CID:\s*(baf[a-z0-9]+)/i)?.[1] ?? null;

    const pieceCid =
      output.match(/Piece CID:\s*(baf[a-z0-9]+)/i)?.[1] ?? null;

    const datasetIds = [
      ...output.matchAll(/Data Set ID:\s*(\d+)/gi)
    ].map((match) => match[1]);

    const datasetId = datasetIds[0] ?? null;

    // Compatibility field for the current TrustIoT manifest.
    // Prefer IPFS Root CID when available; otherwise use Piece CID.
    const cid = ipfsRootCid ?? pieceCid;

    if (!cid) {
      throw new Error(
        'Filecoin Pin completed successfully, but no recognized CID was found in the CLI output.'
      );
    }

    return {
      driver: 'filecoin-pin',
      ref: cid,
      cid,
      ipfsRootCid,
      pieceCid,
      datasetId,
      datasetIds,
      raw: {
        network: this.network,
        cliOutput: output
      }
    };
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    let child;

    if (process.platform === 'win32' && command.toLowerCase().endsWith('.cmd')) {
      child = spawn(
        process.env.ComSpec || 'cmd.exe',
        ['/d', '/s', '/c', command, ...args],
        {
          env: process.env,
          stdio: ['ignore', 'pipe', 'pipe']
        }
      );
    } else {
      child = spawn(command, args, {
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe']
      });
    }

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', reject);

    child.on('close', (code) => {
      const combined = `${stdout}\n${stderr}`.trim();

      if (code === 0) {
        resolve(combined);
        return;
      }

      reject(
        new Error(
          `${command} exited with code ${code}: ${combined}`
        )
      );
    });
  });
}
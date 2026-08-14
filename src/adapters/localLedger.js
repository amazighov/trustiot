import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export class LocalLedgerAdapter {
  constructor(file = 'data/local-ledger.jsonl') {
    this.file = file;
  }

  async register(manifest) {
    await mkdir(path.dirname(this.file), { recursive: true });
    await appendFile(this.file, JSON.stringify(manifest) + '\n', 'utf8');
    return {
      driver: 'local',
      transactionId: `local-${manifest.datasetId}`
    };
  }
}

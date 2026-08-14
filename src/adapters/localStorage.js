import { createHash } from 'node:crypto';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export class LocalStorageAdapter {
  constructor(baseDir = 'data/storage') {
    this.baseDir = baseDir;
  }

  async store(filePath) {
    await mkdir(this.baseDir, { recursive: true });
    const content = await import('node:fs/promises').then((fs) => fs.readFile(filePath));
    const digest = createHash('sha256').update(content).digest('hex');
    const target = path.join(this.baseDir, `${digest}.enc.json`);
    await copyFile(filePath, target);

    return {
      driver: 'local',
      ref: target,
      cid: null,
      raw: { sha256: digest }
    };
  }
}

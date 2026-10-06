import { createPrivateKey, createPublicKey } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fingerprintDeviceKey } from "../src/core/wmcCommitment.js";

const sourcePath = resolve(
  process.argv[2] || "data/device-keys/esp32-01-public.pem",
);
const backupPath = resolve(
  process.argv[3] || "data/private/device-keys/esp32-01-private-backup.pem",
);

const original = await readFile(sourcePath, "utf8");
const begin = "-----BEGIN EC PRIVATE KEY-----";
const end = "-----END EC PRIVATE KEY-----";
const start = original.indexOf(begin);
const stop = original.indexOf(end, start);
if (start < 0 || stop < 0) {
  throw new Error("Source does not contain a complete EC private-key block");
}

const privateBlock = original.slice(start, stop + end.length);
const publicPem = createPublicKey(createPrivateKey(privateBlock)).export({
  type: "spki",
  format: "pem",
});
if (!publicPem.startsWith("-----BEGIN PUBLIC KEY-----")) {
  throw new Error("Failed to derive a public-only SPKI key");
}

await mkdir(dirname(backupPath), { recursive: true });
await writeFile(backupPath, original, {
  encoding: "utf8",
  flag: "wx",
  mode: 0o600,
});

try {
  await writeFile(sourcePath, publicPem, {
    encoding: "utf8",
    flag: "w",
    mode: 0o644,
  });
}
catch (error) {
  await writeFile(sourcePath, original, { encoding: "utf8", flag: "w" });
  throw error;
}

console.log(JSON.stringify({
  publicKeyPath: sourcePath,
  privateBackupPath: backupPath,
  publicKeyFingerprint: fingerprintDeviceKey(publicPem),
  publicOnly: true,
}, null, 2));

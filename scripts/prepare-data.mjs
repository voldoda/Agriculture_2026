import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const bundleDir = path.join(root, 'data/groundwater-2025');
const manifest = JSON.parse(fs.readFileSync(path.join(bundleDir, 'manifest.json'), 'utf8'));
const outputOption = process.argv.indexOf('--output');
if (outputOption >= 0 && !process.argv[outputOption + 1]) throw new Error('--output requires a file path');
const target = outputOption < 0 ? path.join(root, 'src/data/groundwater_data.json') : path.resolve(process.argv[outputOption + 1]);
const verifyOnly = process.argv.includes('--verify');
const fileHash = async file => {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
};

if (manifest.format !== 'gzip-parts-v1' || !Array.isArray(manifest.parts) || !manifest.parts.length ||
    !Number.isSafeInteger(manifest.bytes) || manifest.bytes <= 0 || !/^[0-9a-f]{64}$/.test(manifest.sha256)) {
  throw new Error('Invalid groundwater data manifest');
}

if (!verifyOnly && fs.existsSync(target) && fs.statSync(target).size === manifest.bytes && await fileHash(target) === manifest.sha256) {
  console.log('Groundwater data is ready (verified original SHA-256).');
} else {
  if (!verifyOnly && fs.existsSync(target)) {
    throw new Error('Local groundwater data differs from the packaged source. Back up your changes and repackage them, or remove the local file before restoring.');
  }
  async function* compressedParts() {
    for (let index = 0; index < manifest.parts.length; index++) {
      const part = manifest.parts[index];
      const expectedName = `groundwater-2025.json.gz.part-${String(index + 1).padStart(3, '0')}`;
      if (part.file !== expectedName || !Number.isSafeInteger(part.bytes) || part.bytes <= 0 || !/^[0-9a-f]{64}$/.test(part.sha256)) {
        throw new Error('Invalid groundwater data part');
      }
      const bytes = await fs.promises.readFile(path.join(bundleDir, part.file));
      if (bytes.length !== part.bytes || crypto.createHash('sha256').update(bytes).digest('hex') !== part.sha256) {
        throw new Error(`Groundwater data part failed verification: ${part.file}`);
      }
      yield bytes;
    }
  }
  const hash = crypto.createHash('sha256');
  let bytes = 0;
  const verifier = new Transform({ transform(chunk, encoding, callback) {
    bytes += chunk.length;
    hash.update(chunk);
    callback(null, chunk);
  } });
  const temp = `${target}.restore-${process.pid}.tmp`;
  if (!verifyOnly) fs.mkdirSync(path.dirname(target), { recursive: true });
  const sink = verifyOnly ? new Transform({ transform(chunk, encoding, callback) { callback(); } }) : fs.createWriteStream(temp, { flags: 'wx' });
  try {
    await pipeline(Readable.from(compressedParts()), createGunzip(), verifier, sink);
    if (bytes !== manifest.bytes || hash.digest('hex') !== manifest.sha256) throw new Error('Restored groundwater data does not match the original');
    if (!verifyOnly) await fs.promises.rename(temp, target);
    console.log(verifyOnly ? 'Packaged groundwater data matches the original.' : 'Groundwater data restored and verified against the original SHA-256.');
  } finally {
    if (!verifyOnly) await fs.promises.rm(temp, { force: true });
  }
}

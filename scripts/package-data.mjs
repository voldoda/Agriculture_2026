import fs from 'node:fs';
import crypto from 'node:crypto';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const original = fs.readFileSync(path.join(projectRoot, 'src/data/groundwater_data.json'));
const packed = gzipSync(original, { level: 9 });
const root = path.join(projectRoot, 'data/groundwater-2025');
fs.mkdirSync(root, { recursive: true });
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const manifest = { format: 'gzip-parts-v1', source: '2025 MODFLOW 6 monthly model heads with SRTM reference elevation', bytes: original.length, sha256: sha(original), compression: 'gzip', parts: [] };
for (let start = 0, index = 1; start < packed.length; start += 655350, index++) {
  const bytes = packed.subarray(start, start + 655350);
  const file = `groundwater-2025.json.gz.part-${String(index).padStart(3, '0')}`;
  fs.writeFileSync(`${root}/${file}`, bytes);
  manifest.parts.push({ file, bytes: bytes.length, sha256: sha(bytes) });
}
fs.writeFileSync(`${root}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
const activeParts = new Set(manifest.parts.map(part => part.file));
for (const file of fs.readdirSync(root)) {
  if (/^groundwater-2025\.json\.gz\.part-\d{3}$/.test(file) && !activeParts.has(file)) fs.unlinkSync(path.join(root, file));
}
console.log(JSON.stringify({ originalBytes: original.length, compressedBytes: packed.length, parts: manifest.parts.length, sha256: manifest.sha256 }));

import fs from 'node:fs';

// Reader for the numeric dBASE III records and Point/PointZ SHP supplied here.
export function readDbf(path, { includeRaw = false } = {}) {
  const buffer = fs.readFileSync(path);
  const count = buffer.readUInt32LE(4);
  const headerLength = buffer.readUInt16LE(8);
  const recordLength = buffer.readUInt16LE(10);
  if (headerLength + count * recordLength > buffer.length) throw new Error(`Truncated DBF: ${path}`);
  const fields = [];
  let fieldStart = 1;
  for (let offset = 32; offset < headerLength - 1 && buffer[offset] !== 13; offset += 32) {
    const name = buffer.toString('ascii', offset, offset + 11).replace(/\0.*/, '');
    const type = String.fromCharCode(buffer[offset + 11]);
    const length = buffer[offset + 16];
    fields.push({ name, type, length, decimals: buffer[offset + 17], start: fieldStart });
    fieldStart += length;
  }
  if (fieldStart !== recordLength) throw new Error(`Invalid DBF field lengths: ${path}`);
  return {
    count, fields,
    *records() {
      for (let i = 0; i < count; i++) {
        const offset = headerLength + i * recordLength;
        const record = { index: i, deleted: buffer[offset] === 42 };
        if (includeRaw) record.raw = {};
        for (const f of fields) {
          const value = buffer.toString('ascii', offset + f.start, offset + f.start + f.length).trim();
          record[f.name] = value === '' ? null : f.type === 'N' || f.type === 'F' ? Number(value) : value;
          if (includeRaw) record.raw[f.name] = value;
        }
        yield record;
      }
    },
  };
}

export function readShpPoints(path) {
  const b = fs.readFileSync(path);
  if (b.readInt32BE(0) !== 9994 || b.readInt32BE(24) * 2 !== b.length) throw new Error(`Invalid SHP header: ${path}`);
  const points = [];
  for (let offset = 100; offset < b.length;) {
    const length = b.readInt32BE(offset + 4) * 2;
    const start = offset + 8;
    if (length < 4 || start + length > b.length) throw new Error(`Truncated SHP record: ${path}`);
    const type = b.readInt32LE(start);
    if (![0, 1, 11, 21].includes(type)) throw new Error(`Expected point SHP, found type ${type}`);
    if (type !== 0 && length < 20) throw new Error('Truncated point');
    points.push(type === 0 ? null : [b.readDoubleLE(start + 4), b.readDoubleLE(start + 12)]);
    offset = start + length;
  }
  return points;
}

export function recognizePrj(text) {
  const parameter = name => Number(text.match(new RegExp(`PARAMETER\\["${name}",\\s*([-0-9.]+)\\]`, 'i'))?.[1]);
  if (parameter('central_meridian') === 127 && parameter('false_easting') === 200000 &&
      parameter('false_northing') === 600000 && parameter('latitude_of_origin') === 38 && parameter('scale_factor') === 1) return 'EPSG:5186';
  if (parameter('central_meridian') === 127.5 && parameter('false_easting') === 1000000 &&
      parameter('false_northing') === 2000000 && parameter('latitude_of_origin') === 38 && parameter('scale_factor') === 0.9996) return 'EPSG:5179';
  return 'unresolved';
}

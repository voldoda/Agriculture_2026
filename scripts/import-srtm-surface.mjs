import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import { fileURLToPath } from 'node:url';
import { readHgt } from './validation/hgt.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = path.join(root, 'src/data/groundwater_data.json');
const before = fs.readFileSync(target);
const data = JSON.parse(before);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const headDigest = d => hash(JSON.stringify(d.grids.map(g => [g.id,g.row,g.col,g.x,g.y,g.lat,g.lon,g.polygon,g.heads,g.headsExact])));
const originalHeads = headDigest(data);
const tiles = new Map(), provenance = [];
const tileName = (lat, lon) => `${lat < 0 ? 'S' : 'N'}${String(Math.abs(Math.floor(lat))).padStart(2,'0')}${lon < 0 ? 'W' : 'E'}${String(Math.abs(Math.floor(lon))).padStart(3,'0')}`;
const names = [...new Set(data.grids.map(g => tileName(g.lat,g.lon)))];
for (const name of names) {
  const file = path.join(root, 'source-data/srtm30', `${name}.SRTMGL1.hgt.zip`);
  if(!fs.existsSync(file) && process.argv.includes('--download')) {
    fs.mkdirSync(path.dirname(file),{recursive:true});
    const url=`https://step.esa.int/auxdata/dem/SRTMGL1/${name}.SRTMGL1.hgt.zip`;
    const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
    if(!response.ok) throw new Error(`DEM download HTTP ${response.status}`);
    fs.writeFileSync(file,Buffer.from(await response.arrayBuffer()));
  }
  assert.ok(fs.existsSync(file), `Missing original DEM tile: ${file}`);
  const bytes = fs.readFileSync(file);
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  const entry = Object.values(zip.files).find(f => f.name.toLowerCase().endsWith('.hgt'));
  assert.ok(entry, 'No HGT in archive');
  const hgtBytes = await entry.async('nodebuffer');
  const south = Number(name.slice(1,3)) * (name[0] === 'S' ? -1 : 1);
  const west = Number(name.slice(4,7)) * (name[3] === 'W' ? -1 : 1);
  const tile = readHgt(hgtBytes,south,west);
  assert.equal(tile.size,3601,'Expected one arc-second HGT');
  tiles.set(name,tile);
  provenance.push({ name, url: `https://step.esa.int/auxdata/dem/SRTMGL1/${name}.SRTMGL1.hgt.zip`,
    archiveSha256: hash(bytes), hgtSha256: hash(hgtBytes), samplesPerSide:tile.size });
}
const elevation = (lat,lon) => tiles.get(tileName(lat,lon))?.elevation(lat,lon) ?? null;
const samples = JSON.parse(fs.readFileSync(path.join(root,'reports/z-dem-comparison.json'),'utf8')).samples;
const response = JSON.parse(fs.readFileSync(path.join(root,'reports/dem-review-srtm30m-response.json'),'utf8'));
assert.equal(response.status,'OK');
assert.equal(response.results.length,samples.length);
const checks = samples.map((s,i) => {
  const p=response.results[i];
  assert.equal(p.dataset,'srtm30m');
  assert.ok(Math.abs(p.location.lat-s.lat)<=0.0000051 && Math.abs(p.location.lng-s.lon)<=0.0000051);
  const value=elevation(p.location.lat,p.location.lng);
  assert.ok(Number.isFinite(value));
  const difference=Math.abs(value-p.elevation);
  assert.ok(difference<=0.51,`DEM/API sample mismatch ${s.id}: ${difference}`);
  return {id:s.id,localInterpolatedM:value,apiRoundedM:p.elevation,differenceM:difference,asterM:s.aster};
});
let valid=0,min=Infinity,max=-Infinity,legacy=0;
for(const grid of data.grids){
  if(!Object.hasOwn(grid,'legacySurfaceEl')) grid.legacySurfaceEl=grid.surfaceEl;
  if(Number.isFinite(grid.legacySurfaceEl))legacy++;
  grid.surfaceEl=elevation(grid.lat,grid.lon);
  grid.surfaceSource='srtm_gl1';
  // No model vertical datum confirmation has been supplied.
  grid.surfaceDatumConfirmed=false;
  if(Number.isFinite(grid.surfaceEl)){valid++;min=Math.min(min,grid.surfaceEl);max=Math.max(max,grid.surfaceEl);}
}
assert.equal(originalHeads,headDigest(data),'Original heads or grid geometry were changed');
data.metadata.surfaceElevation={source:'SRTMGL1',version:'003',distribution:'ESA STEP SRTMGL1',
  acquisitionPeriod:'2000-02',horizontalCrs:'EPSG:4326',verticalDatum:'EGM96',unit:'m',
  sourceResolutionArcSeconds:1,nominalResolutionM:30,method:'bilinear_at_original_50m_cell_center',
  status:'reference_dem',modelHeadDatumCompatibility:'unconfirmed',waterTableInterpretation:'unconfirmed',
  validCells:valid,missingCells:data.grids.length-valid,minM:min,maxM:max,legacyExampleCells:legacy,tiles:provenance,
  note:'Past satellite DEM, not a 2025 surveyed ground surface. Interpolation decimals do not imply centimetre accuracy.'};
data.metadata.analysisMethod='demo-head-decline-v2';
data.metadata.storageStatus='unavailable_missing_aquifer_parameters';
data.metadata.legacyStorageMetrics ??= data.metadata.storageMetrics;
delete data.metadata.storageMetrics;
data.metadata.auxiliaryDataStatus='reference_dem_with_example_context';
const backup=path.join(root,'backups/groundwater-before-srtm-surface.json');
fs.mkdirSync(path.dirname(backup),{recursive:true});
if(!fs.existsSync(backup))fs.writeFileSync(backup,before,{flag:'wx'});
const output=JSON.stringify(data);
fs.writeFileSync(target+'.tmp',output);
try { fs.renameSync(target+'.tmp',target); }
catch(error) {
  if(error.code !== 'EPERM') throw error;
  // Windows file watchers may deny replacing an open path. The validated
  // temporary file and original backup remain recoverable if this write fails.
  fs.writeFileSync(target,output);
}
const report={generatedAt:new Date().toISOString(),cells:data.grids.length,valid,missing:data.grids.length-valid,min,max,
  originalHeadAndGeometryDigest:originalHeads,headsAndGeometryPreserved:true,
  beforeDatasetSha256:hash(before),afterDatasetSha256:hash(output),provenance,
  crossCheck:{count:checks.length,maxDifferenceM:Math.max(...checks.map(c=>c.differenceM)),checks},
  surfaceElevation:data.metadata.surfaceElevation};
fs.writeFileSync(path.join(root,'reports/surface-dem-validation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({valid,missing:report.missing,min,max,apiCrossCheckCount:checks.length,maxApiDifferenceM:report.crossCheck.maxDifferenceM,headsAndGeometryPreserved:true}));

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

function loadJsonExport(path, key) {
  const t = readFileSync(path, 'utf8');
  return JSON.parse(t.replace(new RegExp(`^const ${key}\\s*=\\s*`), '').replace(/;\s*$/, ''));
}

const DETAILS = join(dirname(fileURLToPath(import.meta.url)), '..', 'details.js');
try {
  const j = loadJsonExport(DETAILS, 'GUIDE_DETAILS');
  console.log('loaded ok, spawn keys:', Object.keys(j.spawns).length);
  console.log('SutureNeedle', j.spawns.SutureNeedle?.length);
  console.log('Base.SutureNeedle', j.spawns['Base.SutureNeedle']?.length);
  console.log('IronBarMold', j.spawns.IronBarMold?.length);
} catch (e) {
  console.log('FAIL', e.message);
}

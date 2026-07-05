import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

function loadJsonExport(path, key) {
  const t = readFileSync(path, 'utf8');
  return JSON.parse(t.replace(new RegExp(`^const ${key}\\s*=\\s*`), '').replace(/;\s*$/, ''));
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const details = loadJsonExport(join(ROOT, 'details.js'), 'GUIDE_DETAILS');
const poolLocs = loadJsonExport(join(ROOT, 'pool_locs.js'), 'GUIDE_POOL_LOCS').pools;

function buildWhereLines(spawns, poolLocs) {
  const lines = [];
  const seen = new Set();
  const poolSpawns = [], roomSpawns = [];
  for (const s of spawns || []) {
    if (/^room "/.test(s.where)) roomSpawns.push(s);
    else {
      const pool = s.where.replace(/ \(vehicle\)$/, '');
      if (!seen.has(pool + (s.weight || ''))) { seen.add(pool + (s.weight || '')); poolSpawns.push({ ...s, pool }); }
    }
  }
  console.log('poolSpawns', poolSpawns.length, 'roomSpawns', roomSpawns.length);
  for (const s of poolSpawns) {
    const pl = poolLocs[s.pool];
    const wt = s.weight ? ` (weight ${s.weight})` : '';
    if (pl?.hint) lines.push(pl.hint + wt);
    else lines.push(`${s.pool} loot pool${wt} · ${s.mod}`);
  }
  return lines;
}

const sp = details.spawns.SutureNeedle;
console.log('total spawns', sp.length);
const lines = buildWhereLines(sp, poolLocs);
console.log('lines', lines.length);
lines.slice(0, 15).forEach(l => console.log(' ', l.slice(0, 100)));

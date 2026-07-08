// Extracts vehicle-spawn ZONE rectangles (with world coords) from every map mod's objects.lua.
// A zone's distribution key is its `name` if set, else its `type` (PZ behavior), lowercased.
// Only keeps zones whose key is actually used by some vehicle (from vehicles.js).
// Usage: node parse_vehzones.mjs   →   veh_zones.js
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname, sep } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const WORKSHOP = 'D:/SteamLibrary/steamapps/workshop/content/108600';
const OUT = join(ROOT, '..', 'veh_zones.js');

// which zone keys do vehicles actually spawn in?
const vt = readFileSync(join(ROOT, '..', 'vehicles.js'), 'utf8');
const VEH = JSON.parse(vt.slice(vt.indexOf('=') + 1).replace(/;\s*$/, ''));
const needed = new Set();
for (const v of VEH.vehicles) for (const z of (v.zones || [])) needed.add(z.zone.toLowerCase());
console.log('vehicle spawn-zone keys needed:', needed.size);

function* walk(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}
const mapNameFromPath = f => {
  const parts = f.split(sep);
  const i = parts.lastIndexOf('maps');
  return i >= 0 && parts[i + 1] ? parts[i + 1] : 'Unknown';
};

const ZONE_RE = /\{\s*(?:name\s*=\s*"([^"]*)"\s*,\s*)?type\s*=\s*"([^"]+)"\s*,\s*x\s*=\s*(\d+)\s*,\s*y\s*=\s*(\d+)\s*,\s*z\s*=\s*(-?\d+)\s*,\s*width\s*=\s*(\d+)\s*,\s*height\s*=\s*(\d+)/g;

const index = {};   // key -> { n, spots: [{map,x,y,w,h,z}] }
const sigSeen = {}; // key -> Set of "map|x|y" to dedup common/versioned copies
const PER_MAP = 5;   // cap examples per (key, map) for mod maps
const PER_KEY = 90;  // overall cap per key
const VANILLA = 'Knox Country (vanilla)';
// the whole base-game Knox map lives in one file; the towns aren't split out
const VANILLA_FILE = 'D:/SteamLibrary/steamapps/common/ProjectZomboid/media/maps/Muldraugh, KY/objects.lua';
// PZ only spawns vehicles in ParkingStall-type zones (+ a few zone types that are themselves keys).
// Reject e.g. ZombiesType/Nav/Forest zones that merely share a `name`.
const acceptType = type => type === 'ParkingStall' || needed.has(type.toLowerCase());
const normMap = m => m.replace(/,?\s*KY$/i, '').trim();

function processFile(f, mapLabel, perMapCap) {
  let txt;
  try { txt = readFileSync(f, 'utf8'); } catch { return false; }
  const perMapCount = {};
  for (const m of txt.matchAll(ZONE_RE)) {
    const name = (m[1] || '').trim(), type = m[2];
    if (!acceptType(type)) continue;
    const key = (name || type).toLowerCase();
    if (!needed.has(key)) continue;
    const x = +m[3], y = +m[4];
    const sig = mapLabel + '|' + x + '|' + y;
    const seen = sigSeen[key] || (sigSeen[key] = new Set());
    if (seen.has(sig)) continue;
    seen.add(sig);
    const bucket = index[key] || (index[key] = { n: 0, spots: [] });
    bucket.n++;
    const pmKey = key + '|' + mapLabel;
    perMapCount[pmKey] = (perMapCount[pmKey] || 0) + 1;
    if (perMapCount[pmKey] <= perMapCap && bucket.spots.length < 600) {
      bucket.spots.push({ map: mapLabel, x, y, z: +m[5], w: +m[6], h: +m[7], vanilla: mapLabel === VANILLA ? 1 : undefined });
    }
  }
  return true;
}

let fileCount = 0;
// 1) the base-game Knox map — the map players actually spawn on; give it far more examples
if (processFile(VANILLA_FILE, VANILLA, 25)) { fileCount++; console.log('included vanilla Knox map'); }
else console.log('WARNING: vanilla objects.lua not found at', VANILLA_FILE);
// 2) all workshop map mods
for (const pack of readdirSync(WORKSHOP, { withFileTypes: true }).filter(e => e.isDirectory())) {
  for (const f of walk(join(WORKSHOP, pack.name))) {
    if (!/objects\.lua$/i.test(f) || !/[\\\/]maps[\\\/]/i.test(f)) continue;
    if (/challengemaps/i.test(f)) continue;
    if (processFile(f, normMap(mapNameFromPath(f)), PER_MAP)) fileCount++;
  }
}

// final cap + sort: vanilla Knox first, then bigger lots first (more likely to hold a vehicle)
let totalSpots = 0;
for (const k of Object.keys(index)) {
  index[k].spots.sort((a, b) => (b.vanilla ? 1 : 0) - (a.vanilla ? 1 : 0) || a.map.localeCompare(b.map) || (b.w * b.h - a.w * a.h));
  index[k].spots = index[k].spots.slice(0, PER_KEY);
  totalSpots += index[k].spots.length;
}
const keysWith = Object.keys(index).length;
console.log(`objects.lua parsed: ${fileCount} maps · zone keys located: ${keysWith}/${needed.size} · example spots: ${totalSpots}`);
// report keys still with no coords anywhere
const missing = [...needed].filter(k => !index[k]).sort();
console.log('keys with NO coords (not in vanilla or mod maps):', missing.join(', ') || '(none)');
writeFileSync(OUT, 'const GUIDE_VEHZONES = ' + JSON.stringify(index) + ';\n');
console.log('Wrote ' + OUT);

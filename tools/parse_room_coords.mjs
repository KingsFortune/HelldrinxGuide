// Extracts EVERY room (by name) with world coordinates across the full vanilla Knox map + all mod maps.
// Output: room_coords.js  →  GUIDE_ROOMCOORDS = { roomname: { n, spots:[{map,x,y,z,w,h,v}] } }
// This is the coordinate half of the exact-loot engine: room name -> where it physically is.
// The loot-table half (room name -> items) is joined at render time from the distribution data.
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const WORKSHOP = 'D:/SteamLibrary/steamapps/workshop/content/108600';
const VANILLA_MAP = 'D:/SteamLibrary/steamapps/common/ProjectZomboid/media/maps/Muldraugh, KY';
const OUT = 'C:/Users/micah/Documents/HellDrinxGuide/room_coords.js';

const PER_TYPE = 300;   // cap example coords per room type (rare-gear rooms are far below this; residential gets capped)
const PER_MAP_TYPE = 8; // cap per (type, mod-map) so one map can't hog a type's list

// only truly-empty structural rooms that never hold loot — everything else (incl. residential) is kept
const SKIP = new Set(['empty', 'emptyoutside', 'hall', 'hallway', 'corridor', 'elevator', 'stairwell',
  'stairs', 'roof', 'balcony', 'porch']);

function parseLotheader(buf, cellX, cellY, mapLabel, vanilla, index, counts) {
  if (buf.length < 12 || buf.toString('latin1', 0, 4) !== 'LOTH') return;
  let p = 8;
  const nTiles = buf.readInt32LE(p); p += 4;
  for (let i = 0; i < nTiles; i++) { const e = buf.indexOf(0x0a, p); if (e < 0) return; p = e + 1; }
  p += 8 + 8;
  const nRooms = buf.readInt32LE(p); p += 4;
  if (nRooms < 0 || nRooms > 20000) return;
  for (let r = 0; r < nRooms; r++) {
    const e = buf.indexOf(0x0a, p); if (e < 0 || e - p > 200) return;
    const name = buf.toString('latin1', p, e).toLowerCase(); p = e + 1;
    const level = buf.readInt32LE(p); p += 4;
    const rectCount = buf.readInt32LE(p); p += 4;
    if (rectCount < 0 || rectCount > 500) return;
    // room world position = biggest rect's origin (the main footprint)
    let bx = 0, by = 0, bw = 0, bh = 0, best = -1;
    for (let i = 0; i < rectCount; i++) {
      const x = buf.readInt32LE(p), y = buf.readInt32LE(p + 4), w = buf.readInt32LE(p + 8), h = buf.readInt32LE(p + 12);
      p += 16;
      if (w * h > best) { best = w * h; bx = x; by = y; bw = w; bh = h; }
    }
    const nObj = buf.readInt32LE(p); p += 4;
    if (nObj < 0 || nObj > 50000) return;
    p += nObj * 12;
    if (p > buf.length) return;
    if (SKIP.has(name)) continue;
    counts[name] = (counts[name] || 0) + 1;
    const bucket = index[name] || (index[name] = []);
    // spread caps: track per-(type,map)
    const pm = name + '|' + mapLabel;
    counts['__pm_' + pm] = (counts['__pm_' + pm] || 0) + 1;
    if (bucket.length < PER_TYPE && counts['__pm_' + pm] <= (vanilla ? 999 : PER_MAP_TYPE)) {
      const spot = { map: mapLabel, x: cellX * 256 + bx, y: cellY * 256 + by, z: level, w: bw, h: bh };
      if (vanilla) spot.v = 1;
      bucket.push(spot);
    }
  }
}

const index = {}, counts = {};
let cellCount = 0;

// 1) vanilla Knox map (the whole base world in one folder)
for (const f of readdirSync(VANILLA_MAP)) {
  const m = f.match(/^(\d+)_(\d+)\.lotheader$/);
  if (!m) continue;
  cellCount++;
  try { parseLotheader(readFileSync(join(VANILLA_MAP, f)), +m[1], +m[2], 'Knox Country (vanilla)', true, index, counts); } catch {}
}
console.log('vanilla cells parsed:', cellCount);

// 2) all mod maps (dedup: a map shipped in common/ + versioned/ — take first seen per map name)
const seenMap = new Set();
for (const pack of readdirSync(WORKSHOP, { withFileTypes: true }).filter(e => e.isDirectory())) {
  const base = join(WORKSHOP, pack.name, 'mods');
  let mods;
  try { mods = readdirSync(base, { withFileTypes: true }).filter(e => e.isDirectory()); } catch { continue; }
  for (const mod of mods) {
    for (const sub of ['common/media/maps', 'media/maps', '42/media/maps', '42.0/media/maps', '42.12/media/maps', '42.13/media/maps', '42.14/media/maps', '42.15/media/maps', '42.16/media/maps', '42.17/media/maps', '42.18/media/maps', '42.19/media/maps']) {
      const mapsDir = join(base, mod.name, ...sub.split('/'));
      let maps;
      try { maps = readdirSync(mapsDir, { withFileTypes: true }).filter(e => e.isDirectory()); } catch { continue; }
      for (const mapDir of maps) {
        const label = mapDir.name.replace(/,?\s*KY$/i, '').trim();
        if (seenMap.has(label)) continue;
        let files;
        try { files = readdirSync(join(mapsDir, mapDir.name)); } catch { continue; }
        if (!files.some(f => /\.lotheader$/.test(f))) continue;
        seenMap.add(label);
        for (const f of files) {
          const m = f.match(/^(\d+)_(\d+)\.lotheader$/);
          if (!m) continue;
          cellCount++;
          try { parseLotheader(readFileSync(join(mapsDir, mapDir.name, f)), +m[1], +m[2], label, false, index, counts); } catch {}
        }
      }
    }
  }
}

// finalize: attach true totals, sort spots vanilla-first then biggest footprint, drop internal counters
const out = {};
let totalSpots = 0;
for (const name of Object.keys(index)) {
  const spots = index[name].sort((a, b) => (b.v ? 1 : 0) - (a.v ? 1 : 0) || (b.w * b.h - a.w * a.h));
  out[name] = { n: counts[name], spots };
  totalSpots += spots.length;
}
console.log(`cells parsed: ${cellCount} · mod maps: ${seenMap.size} · room types: ${Object.keys(out).length} · example spots: ${totalSpots}`);
console.log('size estimate:', Math.round(JSON.stringify(out).length / 1024), 'KB');
writeFileSync(OUT, 'const GUIDE_ROOMCOORDS = ' + JSON.stringify(out) + ';\n');
console.log('Wrote ' + OUT);

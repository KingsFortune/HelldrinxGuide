// Builds a room-name -> world-coordinates index from map .lotheader files (B42 LOTH format, 256-tile cells)
// Only indexes room names that appear in details.js spawn data (keeps output small).
// Usage: node parse_rooms.mjs
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const WORKSHOP = 'D:/SteamLibrary/steamapps/workshop/content/108600';
const OUT = join(ROOT, '..', 'rooms.js');

// which room names do we need?
const dt = readFileSync(join(ROOT, '..', 'details.js'), 'utf8');
const DET = JSON.parse(dt.slice(dt.indexOf('=') + 1).replace(/;\s*$/, ''));
const needed = new Set();
for (const arr of Object.values(DET.spawns))
  for (const e of arr) {
    const m = e.where.match(/^room "([^"]+)"/);
    if (m) needed.add(m[1].toLowerCase());
  }
console.log('room names referenced by loot tables:', needed.size);

function parseLotheader(buf, cellX, cellY, mapName, out) {
  if (buf.length < 12 || buf.toString('latin1', 0, 4) !== 'LOTH') return;
  let p = 4;
  const version = buf.readInt32LE(p); p += 4;
  const nTiles = buf.readInt32LE(p); p += 4;
  for (let i = 0; i < nTiles; i++) { const e = buf.indexOf(0x0a, p); if (e < 0) return; p = e + 1; }
  p += 8; // width, height
  p += 8; // minLevel, maxLevel
  const nRooms = buf.readInt32LE(p); p += 4;
  if (nRooms < 0 || nRooms > 20000) return;
  for (let r = 0; r < nRooms; r++) {
    const e = buf.indexOf(0x0a, p); if (e < 0 || e - p > 200) return;
    const name = buf.toString('latin1', p, e); p = e + 1;
    const level = buf.readInt32LE(p); p += 4;
    const rectCount = buf.readInt32LE(p); p += 4;
    if (rectCount < 0 || rectCount > 500) return;
    const key = name.toLowerCase();
    for (let i = 0; i < rectCount; i++) {
      const x = buf.readInt32LE(p), y = buf.readInt32LE(p + 4), w = buf.readInt32LE(p + 8), h = buf.readInt32LE(p + 12);
      p += 16;
      if (i === 0 && needed.has(key)) {
        (out[key] = out[key] || []).push({ map: mapName, x: cellX * 256 + x, y: cellY * 256 + y, w, h, z: level });
      }
    }
    const nObj = buf.readInt32LE(p); p += 4;
    if (nObj < 0 || nObj > 50000) return;
    p += nObj * 12;
    if (p > buf.length) return;
  }
}

const rooms = {};
let headerCount = 0;
for (const pack of readdirSync(WORKSHOP, { withFileTypes: true }).filter(e => e.isDirectory())) {
  const modsDir = join(WORKSHOP, pack.name, 'mods');
  let mods;
  try { mods = readdirSync(modsDir, { withFileTypes: true }).filter(e => e.isDirectory()); } catch { continue; }
  for (const mod of mods) {
    for (const sub of ['common', 'media', '42', '42.0', '42.12', '42.13', '42.14', '42.15', '42.16', '42.17', '42.18', '42.19']) {
      const mapsDir = sub === 'media' ? join(modsDir, mod.name, 'media', 'maps') : join(modsDir, mod.name, sub, 'media', 'maps');
      let maps;
      try { maps = readdirSync(mapsDir, { withFileTypes: true }).filter(e => e.isDirectory()); } catch { continue; }
      for (const mapDir of maps) {
        for (const f of readdirSync(join(mapsDir, mapDir.name))) {
          const m = f.match(/^(\d+)_(\d+)\.lotheader$/);
          if (!m) continue;
          headerCount++;
          try { parseLotheader(readFileSync(join(mapsDir, mapDir.name, f)), +m[1], +m[2], mapDir.name, rooms); } catch {}
        }
      }
    }
  }
}
// dedupe identical entries (same room parsed from multiple version dirs)
let total = 0;
for (const k of Object.keys(rooms)) {
  const seen = new Set();
  rooms[k] = rooms[k].filter(e => { const id = `${e.map}|${e.x}|${e.y}|${e.z}`; if (seen.has(id)) return false; seen.add(id); return true; }).slice(0, 50);
  total += rooms[k].length;
}
console.log(`lotheaders scanned: ${headerCount}, rooms located: ${Object.keys(rooms).length} names, ${total} placements`);
writeFileSync(OUT, 'const GUIDE_ROOMS = ' + JSON.stringify(rooms) + ';\n');
console.log('Wrote ' + OUT);

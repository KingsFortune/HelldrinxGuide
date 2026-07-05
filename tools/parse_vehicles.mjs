// Extracts vehicle definitions from all mods into vehicles.js
// Usage: node parse_vehicles.mjs
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const WORKSHOP = 'D:/SteamLibrary/steamapps/workshop/content/108600';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'vehicles.js');

function* walk(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}
function roots(modDir) {
  let entries;
  try { entries = readdirSync(modDir, { withFileTypes: true }).filter(e => e.isDirectory()); } catch { return []; }
  const names = entries.map(e => e.name);
  const r = [];
  if (names.includes('common')) r.push(join(modDir, 'common', 'media'));
  if (names.includes('media')) r.push(join(modDir, 'media'));
  for (const v of names.filter(n => /^42(\.\d+)?$/.test(n)).sort((a, b) => parseFloat(a.slice(3) || 0) - parseFloat(b.slice(3) || 0)))
    r.push(join(modDir, v, 'media'));
  return r;
}

const vehicles = new Map(); // name -> record (later versions merge over)
const names = new Map();    // IGUI_VehicleName<script> -> display

function parseVehicles(text, mod) {
  const lines = text.split('\n');
  let cur = null, depth = 0, partStack = [];
  for (const raw of lines) {
    const line = raw.trim();
    const vm = line.match(/^vehicle\s+([\w.]+)/i);
    if (vm && depth === 0) {
      cur = { name: vm[1], mod, seats: 0, trunk: 0, storage: 0 };
    }
    if (cur) {
      const kv = line.match(/^(\w+)\s*=\s*([^,]+),?\s*$/);
      if (kv) {
        const [, k, vRaw] = kv; const v = vRaw.trim();
        if (depth === 1) {
          if (k === 'maxSpeed') cur.maxSpeed = parseFloat(v);
          else if (k === 'engineForce') cur.engineForce = parseFloat(v);
          else if (k === 'engineQuality') cur.engineQuality = parseFloat(v);
          else if (k === 'engineLoudness') cur.engineLoudness = parseFloat(v);
          else if (k === 'mass') cur.mass = parseFloat(v);
          else if (k === 'seats') cur.seatsDeclared = parseFloat(v);
          else if (k === 'template' && !cur.template) cur.template = v;
          else if (k === 'offRoadEfficiency') cur.offRoad = parseFloat(v);
        }
        if (k === 'capacity' && partStack.length) {
          const part = partStack[partStack.length - 1] || '';
          const cap = parseFloat(v) || 0;
          cur.storage += cap;
          if (/truckbed|trailer/i.test(part)) cur.trunk += cap;
        }
        if (k === 'protectionLevel') cur.protection = Math.max(cur.protection || 0, parseFloat(v) || 0);
      }
      const pm = line.match(/^part\s+([\w*]+)/i);
      if (pm) {
        partStack.push(pm[1]);
        if (/^Seat/i.test(pm[1])) cur.seats++;
      }
      for (const ch of line) {
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (partStack.length && depth <= partStack.length) partStack.pop();
          if (depth === 0 && cur) {
            const prev = vehicles.get(cur.name);
            if (prev) {
              // merge: keep numeric maxima / fill blanks (split defs across version files)
              for (const [k, v] of Object.entries(cur)) if (v || !prev[k]) prev[k] = v || prev[k];
            } else vehicles.set(cur.name, cur);
            cur = null; partStack = [];
          }
        }
      }
    }
  }
}

let fileCount = 0;
for (const pack of readdirSync(WORKSHOP, { withFileTypes: true }).filter(e => e.isDirectory())) {
  const modsDir = join(WORKSHOP, pack.name, 'mods');
  let mods;
  try { mods = readdirSync(modsDir, { withFileTypes: true }).filter(e => e.isDirectory()); } catch { continue; }
  for (const mod of mods) {
    for (const root of roots(join(modsDir, mod.name))) {
      for (const f of walk(root)) {
        try {
          if (f.endsWith('.txt') && /[\\\/]scripts[\\\/]/i.test(f)) {
            const t = readFileSync(f, 'utf8');
            if (/^\s*vehicle\s+[\w.]/m.test(t)) { fileCount++; parseVehicles(t, mod.name); }
          } else if (f.endsWith('.txt') && /Translate[\\\/]EN[\\\/]/i.test(f)) {
            const t = readFileSync(f, 'utf8');
            for (const m of t.matchAll(/IGUI_VehicleName([\w.]+?)\s*=\s*"([^"]*)"/g)) names.set(m[1], m[2]);
          }
        } catch {}
      }
    }
  }
}

const list = [...vehicles.values()].map(v => {
  const short = v.name.replace(/^Base\./, '');
  v.display = names.get(short) || names.get(v.name) || short;
  // rough top speed guess isn't reliable across physics; keep raw stats only
  return v;
});
console.log(`files: ${fileCount}, vehicles: ${list.length}, translated names: ${names.size}`);
writeFileSync(OUT, 'const GUIDE_VEH = ' + JSON.stringify({ vehicles: list }) + ';\n');
console.log('Wrote ' + OUT);

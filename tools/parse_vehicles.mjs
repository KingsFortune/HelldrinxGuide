// Extracts DETAILED vehicle definitions + spawn zones from all mods into vehicles.js
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

const vehicles = new Map(); // name -> record
const names = new Map();    // script name -> display
const zones = {};           // vehicleId(short) -> { zone: {chance, mods:Set} }

// which top-level vehicle stats to keep as numbers/strings
const NUM_STATS = new Set([
  'maxSpeed', 'engineForce', 'engineQuality', 'engineLoudness', 'enginePower', 'mass',
  'brakingForce', 'rollInfluence', 'steeringIncrement', 'steeringClamp', 'wheelFriction',
  'frontEndHealth', 'rearEndHealth', 'playerDamageProtection', 'offRoadEfficiency',
  'engineRepairLevel', 'mechanicType', 'seats', 'suspensionStiffness', 'maxSuspensionTravelCm',
  'gearRatioCount',
]);
const STR_STATS = new Set(['engineRPMType']);
const num = v => parseFloat(String(v).replace(/f$/i, ''));

function categorizePart(name) {
  const n = name.toLowerCase();
  if (/(browning|machinegun|muzzle|turret|turrent|cannon|weapon|m2\b|ammo)/.test(n)) return 'weapon';
  if (/armor|armour|plate|shield/.test(n)) return 'armor';
  if (/gastank|gas_tank|fueltank/.test(n)) return 'fuel';
  if (/truckbed|trunk|glovebox|seat|storage|cargo/.test(n)) return 'storage';
  if (/tire|wheel|track|brake|suspension/.test(n)) return 'wheels';
  if (/engine|muffler|battery|radiator/.test(n)) return 'engine';
  if (/door|hood/.test(n)) return 'door';
  if (/window|windshield|windscreen/.test(n)) return 'window';
  if (/headlight|light|lightbar|siren/.test(n)) return 'lights';
  if (/heater|radio|antenna|gps|controller/.test(n)) return 'electronics';
  return 'misc';
}

function parseVehicles(text, mod) {
  const lines = text.split('\n');
  let cur = null, depth = 0;
  let partStack = [];   // [{name, depth}]
  let inWheel = false, wheelDepth = 0;
  for (const raw of lines) {
    const line = raw.trim();
    const vm = line.match(/^vehicle\s+([^\s{]+)/i);
    if (vm && depth === 0) {
      cur = { name: vm[1], mod, parts: [], wheelCount: 0, skins: 0, storageParts: [], stats: {} };
    }
    if (cur) {
      const kv = line.match(/^(\w+)\s*=\s*([^,\n]+),?\s*$/);
      if (kv) {
        const k = kv[1], v = kv[2].trim();
        if (depth === 1) {
          if (NUM_STATS.has(k)) cur.stats[k] = num(v);
          else if (STR_STATS.has(k)) cur.stats[k] = v;
        }
        // capacity belongs to whatever part we're inside
        if (k === 'capacity' && partStack.length) {
          const p = partStack[partStack.length - 1];
          p.capacity = (p.capacity || 0) + (num(v) || 0);
        }
      }
      if (/^skin\b/.test(line)) cur.skins++;
      const wm = line.match(/^wheel\s+\w+/i);
      if (wm && !inWheel) { cur.wheelCount++; inWheel = true; wheelDepth = depth; }
      const pm = line.match(/^part\s+([\w*]+)/i);
      if (pm) partStack.push({ name: pm[1], depth, capacity: 0 });

      for (const ch of line) {
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (inWheel && depth <= wheelDepth) inWheel = false;
          if (partStack.length && depth <= partStack[partStack.length - 1].depth) {
            const p = partStack.pop();
            // record only "real" parts (top-level within vehicle, depth 1)
            if (p.depth === 1) {
              const cat = categorizePart(p.name);
              cur.parts.push({ name: p.name, cat, cap: p.capacity || 0 });
              if (p.capacity > 0) cur.storageParts.push({ name: p.name, cap: p.capacity, cat });
            }
          }
          if (depth === 0 && cur) {
            const prev = vehicles.get(cur.name);
            if (prev) {
              // roots are ordered common → media → 42 → 42.x, so `cur` is the newer/authoritative def.
              // current overwrites scalar fields and stats; keep the longer parts list.
              const merged = { ...prev, ...cur, stats: { ...prev.stats, ...cur.stats } };
              if (cur.parts.length < prev.parts.length) { merged.parts = prev.parts; merged.storageParts = prev.storageParts; }
              if (cur.skins < prev.skins) merged.skins = prev.skins;
              vehicles.set(cur.name, merged);
            } else vehicles.set(cur.name, cur);
            cur = null; partStack = []; inWheel = false;
          }
        }
      }
    }
  }
}

function parseZones(text, mod) {
  for (const m of text.matchAll(/VehicleZoneDistribution\.(\w+)\.vehicles\[\s*["']([^"']+)["']\s*\]\s*=\s*\{([^}]*)\}/g)) {
    const zone = m[1], id = m[2].replace(/^Base\./, ''), body = m[3];
    const cm = body.match(/spawnChance\s*=\s*([\d.]+)/);
    const chance = cm ? parseFloat(cm[1]) : null;
    if (!zones[id]) zones[id] = {};
    if (!zones[id][zone]) zones[id][zone] = { chance: 0, mods: new Set() };
    zones[id][zone].chance = Math.max(zones[id][zone].chance, chance || 0);
    zones[id][zone].mods.add(mod);
  }
}

let fileCount = 0, luaCount = 0;
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
            for (const m of t.matchAll(/IGUI_VehicleName([^\s=]+?)\s*=\s*"([^"]*)"/g)) names.set(m[1], m[2]);
          } else if (f.endsWith('.txt') && /Translate[\\\/]EN[\\\/]/i.test(f)) {
            const t = readFileSync(f, 'utf8');
            for (const m of t.matchAll(/IGUI_VehicleName([^\s=]+?)\s*=\s*"([^"]*)"/g)) names.set(m[1], m[2]);
          } else if (f.endsWith('.lua')) {
            // content-based: any lua that touches VehicleZoneDistribution, regardless of filename
            const t = readFileSync(f, 'utf8');
            if (t.includes('VehicleZoneDistribution')) { luaCount++; parseZones(t, mod.name); }
          }
        } catch {}
      }
    }
  }
}

// finalize
const list = [...vehicles.values()].map(v => {
  const short = v.name.replace(/^Base\./, '');
  v.display = names.get(short) || names.get(v.name) || short;
  const s = v.stats;
  // derived fields
  v.maxSpeed = s.maxSpeed; v.engineForce = s.engineForce; v.engineQuality = s.engineQuality;
  v.mass = s.mass; v.offRoad = s.offRoadEfficiency;
  v.seatsDeclared = s.seats;
  v.fuel = (v.parts.find(p => p.cat === 'fuel') || {}).cap || null;
  v.trunk = v.storageParts.filter(p => /truckbed|trunk/i.test(p.name)).reduce((a, b) => a + b.cap, 0) || null;
  v.glovebox = v.storageParts.filter(p => /glovebox/i.test(p.name)).reduce((a, b) => a + b.cap, 0) || null;
  v.seatStorage = v.storageParts.filter(p => /seat/i.test(p.name)).reduce((a, b) => a + b.cap, 0) || null;
  v.storage = v.storageParts.reduce((a, b) => a + b.cap, 0) || null;
  v.armed = v.parts.some(p => p.cat === 'weapon');
  v.armored = v.parts.some(p => p.cat === 'armor') || (s.playerDamageProtection != null);
  // spawn zones
  const z = zones[short] || zones[v.name];
  v.zones = z ? Object.entries(z).map(([zone, o]) => ({ zone, chance: o.chance })).sort((a, b) => b.chance - a.chance) : [];
  return v;
});

const withZones = list.filter(v => v.zones.length).length;
const armed = list.filter(v => v.armed).length;
console.log(`vehicle files: ${fileCount}, zone lua: ${luaCount}`);
console.log(`vehicles: ${list.length} · with spawn zones: ${withZones} · armed: ${armed} · translated names: ${names.size}`);
writeFileSync(OUT, 'const GUIDE_VEH = ' + JSON.stringify({ vehicles: list }) + ';\n');
console.log('Wrote ' + OUT);

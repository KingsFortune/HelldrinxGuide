// Parse mod loot insertion rules (GunsOfMarz replaces vanilla items in procedural pools).
// Usage: node tools/parse_mod_inserts.mjs
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const WORKSHOP = 'D:/SteamLibrary/steamapps/workshop/content/108600';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'mod_inserts.js');
const MOD_PREFIX = 'MarzGuns.';

function fullId(short) {
  if (!short) return short;
  if (short.includes('.')) return short;
  return MOD_PREFIX + short;
}

function parseItemInsertion(text, src) {
  const inserts = [];
  const zombie = [];
  for (const m of text.matchAll(/weapon\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*([\d.]+)\s*\)/g)) {
    inserts.push({ modItem: fullId(m[1]), kind: 'replaces', base: m[2], chance: +m[3], src });
  }
  for (const m of text.matchAll(/ammo\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*([\d.]+)\s*\)/g)) {
    inserts.push({ modItem: fullId(m[1]), kind: 'replaces', base: m[2], chance: +m[3], src });
  }
  for (const m of text.matchAll(/Distribution\.Insert\(\s*"([^"]+)"\s*,\s*([\d.]+)\s*,\s*tables\s*,\s*"([^"]+)"\s*\)/g)) {
    inserts.push({ modItem: m[3], kind: 'replaces', base: m[1], chance: +m[2], src });
  }
  for (const m of text.matchAll(/Distribution\.InsertMany\(\s*"([^"]+)"\s*,\s*([\d.]+)\s*,\s*tables\s*,\s*([\s\S]*?)\)/g)) {
    const base = m[1], chance = +m[2];
    for (const im of m[3].matchAll(/"([^"]+)"/g)) {
      const id = im[1];
      if (id.includes('.')) inserts.push({ modItem: id, kind: 'replaces', base, chance, src });
    }
  }
  for (const m of text.matchAll(/zombie\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/g)) {
    zombie.push({ modItem: fullId(m[1]), base: m[2], src });
  }
  return { inserts, zombie };
}

function parseSpawnerTable(text, src) {
  const spawners = [];
  for (const m of text.matchAll(/\[\s*"Base\.([^"]+)"\s*\]\s*=\s*\{[\s\S]*?replacementOptions\s*=\s*\{([\s\S]*?)\n\s*\}/g)) {
    const base = 'Base.' + m[1];
    for (const im of m[2].matchAll(/"([^"]+)"/g)) {
      spawners.push({ modItem: im[1], base, src });
    }
  }
  return spawners;
}

function findFile(root, name) {
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.name === name) return p;
    }
  }
  return null;
}

const allInserts = [];
const allSpawners = [];
const allZombie = [];

for (const pack of readdirSync(WORKSHOP, { withFileTypes: true }).filter(e => e.isDirectory())) {
  const modsDir = join(WORKSHOP, pack.name, 'mods');
  let mods;
  try { mods = readdirSync(modsDir, { withFileTypes: true }).filter(e => e.isDirectory()); } catch { continue; }
  for (const mod of mods) {
    const root = join(modsDir, mod.name);
    const insPath = findFile(root, 'ItemInsertion.lua');
    if (insPath) {
      const t = readFileSync(insPath, 'utf8');
      const { inserts, zombie } = parseItemInsertion(t, mod.name);
      allInserts.push(...inserts);
      allZombie.push(...zombie);
      console.log('ItemInsertion:', mod.name, inserts.length, 'inserts,', zombie.length, 'zombie');
    }
    const spPath = findFile(root, 'SpawnerTable.lua');
    if (spPath) {
      const spawners = parseSpawnerTable(readFileSync(spPath, 'utf8'), mod.name);
      allSpawners.push(...spawners);
      console.log('SpawnerTable:', mod.name, spawners.length, 'clip spawners');
    }
  }
}

const data = { source: 'tools/parse_mod_inserts.mjs', inserts: allInserts, spawners: allSpawners, zombie: allZombie };
writeFileSync(OUT, 'const GUIDE_MOD_INSERTS = ' + JSON.stringify(data) + ';\n');
console.log('Wrote', OUT, '—', allInserts.length, 'inserts,', allSpawners.length, 'spawners,', allZombie.length, 'zombie');

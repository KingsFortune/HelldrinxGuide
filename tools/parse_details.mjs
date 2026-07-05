// Extracts craftRecipes (from scripts) and loot spawns (from distribution lua) into details.js
// Usage: node parse_details.mjs
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const WORKSHOP = 'D:/SteamLibrary/steamapps/workshop/content/108600';
const VANILLA_LUA = [
  'D:/SteamLibrary/steamapps/common/ProjectZomboid/media/lua/server/Items/ProceduralDistributions.lua',
  'D:/SteamLibrary/steamapps/common/ProjectZomboid/media/lua/server/Vehicles/VehicleDistributions.lua',
];
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'details.js');

function* walk(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}
function scriptRoots(modDir) {
  let entries;
  try { entries = readdirSync(modDir, { withFileTypes: true }).filter(e => e.isDirectory()); } catch { return []; }
  const names = entries.map(e => e.name);
  const roots = [];
  if (names.includes('common')) roots.push(join(modDir, 'common', 'media'));
  if (names.includes('media')) roots.push(join(modDir, 'media'));
  for (const v of names.filter(n => /^42(\.\d+)?$/.test(n)).sort()) roots.push(join(modDir, v, 'media'));
  return roots;
}

const recipes = {};   // outputItemId -> [recipe]
const teachers = {};  // recipeName -> [magazine display/id]
const spawns = {};    // itemId(short + full) -> [{where, weight, rolls, mod}]

const RECIPE_PROPS = ['SkillRequired', 'NeedToBeLearn', 'needTolearn', 'AutoLearnAny', 'Time', 'category', 'xpAward', 'Tags', 'timedAction'];

function parseRecipes(text, mod) {
  text = text.replace(/\/\*[\s\S]*?\*\//g, '');
  // match craftRecipe blocks with balanced-ish braces: scan manually
  const lines = text.split('\n');
  let cur = null, depth = 0, section = null;
  for (const raw of lines) {
    const line = raw.trim();
    const m = line.match(/^craftRecipe\s+(.+?)\s*\{?\s*$/);
    if (m && !cur) { cur = { name: m[1].replace(/\{.*/, '').trim(), mod, props: {}, inputs: [], outputs: [] }; depth = 0; section = null; }
    if (cur) {
      if (/^inputs\b/.test(line)) section = 'inputs';
      else if (/^outputs\b/.test(line)) section = 'outputs';
      const kv = line.match(/^(\w+)\s*=\s*(.+?),?\s*$/);
      if (kv && RECIPE_PROPS.includes(kv[1])) cur.props[kv[1]] = kv[2];
      const it = line.match(/^item\s+(\d+)\s+(.+?),?\s*$/);
      if (it && section) cur[section].push(it[1] + '× ' + it[2].replace(/mode:\w+|flags\[[^\]]*\]/g, '').trim());
      for (const ch of line) {
        if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth <= 0) {
          // register under each output item id
          for (const o of cur.outputs) {
            const id = (o.match(/\[?([\w.]+\.[\w]+)\]?/) || [])[1];
            if (id) {
              recipes[id] = (recipes[id] || []).filter(r => !(r.name === cur.name && r.mod === cur.mod));
              recipes[id].push(cur);
            }
          }
          cur = null; section = null; break;
        } }
      }
    }
  }
}
function parseTeachers(text) {
  // item blocks with LearnedRecipes teach recipes; associate magazine DisplayName
  text = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  for (const m of text.matchAll(/(?:^|\n)\s*item\s+([\w]+)\s*\r?\n?\s*\{([\s\S]{0,2500}?)\n\s*\}/g)) {
    const body = m[2];
    const lr = body.match(/LearnedRecipes\s*=\s*([^,\n]+),/);
    if (!lr) continue;
    const dn = body.match(/DisplayName\s*=\s*([^,\n]+),/);
    const mag = (dn ? dn[1] : m[1]).trim();
    for (const r of lr[1].split(';')) {
      const key = r.trim();
      teachers[key] = teachers[key] || [];
      if (!teachers[key].includes(mag)) teachers[key].push(mag);
    }
  }
}
function addSpawn(item, entry) {
  const short = item.replace(/^[\w]+\./, '');
  for (const k of new Set([item, short])) {
    spawns[k] = spawns[k] || [];
    if (spawns[k].some(s => s.where === entry.where && s.mod === entry.mod)) continue;
    if (spawns[k].length < 50) spawns[k].push(entry);
  }
}
function parseSpawnsLua(text, mod) {
  // style 1: SuburbsDistributions.room = { container = { rolls = N, items = { "X", w, ... } } }
  for (const m of text.matchAll(/SuburbsDistributions[.\[]"?(\w+)"?\]?\s*=\s*\{([\s\S]*?)\n\}/g)) {
    const room = m[1];
    for (const c of m[2].matchAll(/(\w+)\s*=\s*\{\s*rolls\s*=\s*(\d+)\s*,\s*items\s*=\s*\{([^}]*)\}/g)) {
      const [, container, rolls, itemsRaw] = c;
      for (const p of itemsRaw.matchAll(/"([\w.]+)"\s*,\s*([\d.]+)/g))
        addSpawn(p[1], { where: `room "${room}" → ${container}`, weight: +p[2], rolls: +rolls, mod });
    }
  }
  // style 2: table.insert(ProceduralDistributions.list["C"].items, "X"); table.insert(..., N)
  const ins = [...text.matchAll(/table\.insert\(\s*ProceduralDistributions(?:\.list|\["list"\])\[?"?([\w]+)"?\]?\.items\s*,\s*(?:"([\w.]+)"|([\d.]+))\s*\)/g)];
  for (let i = 0; i < ins.length - 1; i++) {
    if (ins[i][2] && ins[i + 1][3] && ins[i][1] === ins[i + 1][1])
      addSpawn(ins[i][2], { where: ins[i][1], weight: +ins[i + 1][3], mod });
  }
  // style 3 (Akyrohunter Legendary mods): { Distributions = { {"C","Var"},.. }, Vehicles = {..}, Items = { "id",.. } }
  for (const m of text.matchAll(/Distributions\s*=\s*\{([\s\S]*?)\}\s*,\s*(?:Vehicles\s*=\s*\{([\s\S]*?)\}\s*,\s*)?Items\s*=\s*\{([^}]*)\}/g)) {
    const conts = [...m[1].matchAll(/\{\s*"(\w+)"/g)].map(x => x[1]);
    const vehs = m[2] ? [...m[2].matchAll(/\{\s*"(\w+)"/g)].map(x => x[1]) : [];
    for (const im of m[3].matchAll(/"([\w.]+)"/g)) {
      for (const c of conts) addSpawn(im[1], { where: c, weight: null, mod });
      for (const v of vehs) addSpawn(im[1], { where: v + ' (vehicle)', weight: null, mod });
    }
  }
  // style 4: ProceduralDistributions inline pools — PoolName = { rolls = N, items = { "X", w, ... } }
  for (const m of text.matchAll(/(\w+)\s*=\s*\{\s*rolls\s*=\s*(\d+)\s*,\s*items\s*=\s*\{([\s\S]*?)\n\s*\}/g)) {
    const [, pool, rolls, itemsRaw] = m;
    if (/^(junk|items|rolls)$/i.test(pool)) continue;
    for (const p of itemsRaw.matchAll(/"([\w.]+)"\s*,\s*([\d.]+)/g))
      addSpawn(p[1], { where: pool, weight: +p[2], rolls: +rolls, mod });
  }
  // style 5: VehicleDistributions — TrunkStandard.items style blocks
  for (const m of text.matchAll(/(\w+)\s*=\s*\{[\s\S]*?items\s*=\s*\{([\s\S]*?)\n\s*\}/g)) {
    const [, pool, itemsRaw] = m;
    if (!/trunk|glove|seat|dash|vehicle|bed|storage/i.test(pool)) continue;
    for (const p of itemsRaw.matchAll(/"([\w.]+)"\s*,\s*([\d.]+)/g))
      addSpawn(p[1], { where: pool + ' (vehicle)', weight: +p[2], rolls: null, mod });
  }
}

let scriptFiles = 0, luaFiles = 0;
for (const pack of readdirSync(WORKSHOP, { withFileTypes: true }).filter(e => e.isDirectory())) {
  const modsDir = join(WORKSHOP, pack.name, 'mods');
  let mods;
  try { mods = readdirSync(modsDir, { withFileTypes: true }).filter(e => e.isDirectory()); } catch { continue; }
  for (const mod of mods) {
    for (const root of scriptRoots(join(modsDir, mod.name))) {
      for (const f of walk(root)) {
        try {
          if (f.endsWith('.txt') && /[\\\/]scripts[\\\/]/.test(f)) {
            const t = readFileSync(f, 'utf8'); scriptFiles++;
            if (t.includes('craftRecipe')) parseRecipes(t, mod.name);
            if (t.includes('LearnedRecipes')) parseTeachers(t);
          } else if (f.endsWith('.lua') && /dist/i.test(f)) {
            luaFiles++;
            parseSpawnsLua(readFileSync(f, 'utf8'), mod.name);
          }
        } catch {}
      }
    }
  }
}
for (const f of VANILLA_LUA) {
  try {
    parseSpawnsLua(readFileSync(f, 'utf8'), 'Vanilla');
    luaFiles++;
    console.log('vanilla spawns:', f.split(/[/\\]/).pop());
  } catch (e) { console.log('vanilla skipped:', f, e.message); }
}
const nRec = Object.values(recipes).reduce((a, b) => a + b.length, 0);
console.log(`scripts: ${scriptFiles}, distro lua: ${luaFiles}`);
console.log(`recipes: ${nRec} for ${Object.keys(recipes).length} output items; teachers: ${Object.keys(teachers).length} recipes; spawn entries for ${Object.keys(spawns).length} item keys`);
writeFileSync(OUT, 'const GUIDE_DETAILS = ' + JSON.stringify({ recipes, teachers, spawns }) + ';\n');
console.log('Wrote ' + OUT);

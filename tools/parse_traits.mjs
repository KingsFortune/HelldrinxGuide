// Extract traits + occupations (+ icons) from HellDrinx server mods → traits.js + assets/
// Usage: node tools/parse_traits.mjs
import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKSHOP = 'D:/SteamLibrary/steamapps/workshop/content/108600';
const GAME = 'D:/SteamLibrary/steamapps/common/ProjectZomboid/media';
const VANILLA_TRANS = join(GAME, 'lua/shared/Translate/EN');
const VANILLA_TRAITS = join(GAME, 'scripts/generated/characters/character_traits.txt');
const VANILLA_PROFS = join(GAME, 'scripts/generated/characters/character_professions.txt');
const OUT_JS = join(ROOT, 'traits.js');
const OUT_TRAIT_ICONS = join(ROOT, 'assets/traits');
const OUT_PROF_ICONS = join(ROOT, 'assets/professions');

// HellDrinx trait/occupation mods (always parse) + auto-detect from server mod list
const TRAIT_MODS_ALWAYS = new Set([
  'HDX_SimpleOverhaulTraitsAndOccupations',
  'NEWProfessionsandTraits',
  'PatoExtraTraits',
  "Goose's Kentucky National Guard Professions [B42]",
  'Lifestyle',
  'SapphCookingB42',
  'EfficiencySkillMod',
  'Evolving Traits World',
]);
const SKIP_MOD = /old|_0121|CleanRoomClosest/i;

const PERK = {
  Strength: 'Strength', Fitness: 'Fitness', Sprinting: 'Sprinting', Lightfoot: 'Lightfooted',
  Nimble: 'Nimble', Sneak: 'Sneaking', Axe: 'Axe', Blunt: 'Long Blunt', SmallBlunt: 'Short Blunt',
  Spear: 'Spear', Maintenance: 'Maintenance', Blade: 'Long Blade', SmallBlade: 'Short Blade',
  Aiming: 'Aiming', Reloading: 'Reloading', Woodwork: 'Carpentry', Cooking: 'Cooking',
  Farming: 'Farming', PlantScavenging: 'Foraging', Doctor: 'First Aid', Electricity: 'Electrical',
  MetalWelding: 'Welding', Mechanics: 'Mechanics', Tailoring: 'Tailoring', Fishing: 'Fishing',
  Trapping: 'Trapping', Woodcutting: 'Woodcutting', FlintKnapping: 'Knapping', Pottery: 'Pottery',
  Butchering: 'Butchering', Tracking: 'Tracking', Carving: 'Carving', Masonry: 'Masonry',
  Glassmaking: 'Glassmaking', Blacksmith: 'Blacksmithing', Husbandry: 'Animal Care', Digging: 'Digging',
};
const perkName = p => PERK[p] || p.replace(/([A-Z])/g, ' $1').trim();
const prettify = s => String(s).replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, c => c.toUpperCase());
const shortId = raw => String(raw || '').replace(/^[\w]+:/, '');
const normKey = s => shortId(s).toLowerCase().replace(/[^a-z0-9]/g, '');

function* walk(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

function modRoots(modDir) {
  let names;
  try { names = readdirSync(modDir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name); } catch { return []; }
  const roots = [];
  const vers = names.filter(n => /^42(\.\d+)?$/.test(n)).sort((a, b) => parseFloat(a.slice(3) || 0) - parseFloat(b.slice(3) || 0));
  if (names.includes('common')) roots.push(join(modDir, 'common'));
  if (names.includes('media')) roots.push(join(modDir, 'media'));
  for (const v of vers) roots.push(join(modDir, v, 'media'));
  return roots;
}

function loadServerMods() {
  const mods = new Set(TRAIT_MODS_ALWAYS);
  try {
    const t = readFileSync(join(ROOT, 'data.js'), 'utf8');
    const i = t.indexOf('"mods":[');
    let depth = 0, start = t.indexOf('[', i), end = start;
    for (let j = start; j < t.length; j++) {
      if (t[j] === '[') depth++;
      else if (t[j] === ']') { depth--; if (depth === 0) { end = j + 1; break; } }
    }
    for (const m of JSON.parse(t.slice(start, end))) mods.add(m);
  } catch {}
  return mods;
}

// ---- translations ----
const trans = {};
function loadTranslations(file) {
  let txt;
  try { txt = readFileSync(file, 'utf8'); } catch { return; }
  for (const m of txt.matchAll(/^\s*([\w.]+)\s*=\s*"((?:[^"\\]|\\.)*)"\s*,?\s*$/gm))
    trans[m[1]] = m[2].replace(/\\"/g, '"');
}
const T = (key, fb = '') => (key && trans[key]) ? trans[key] : fb;
const cleanHtml = s => String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim();

// ---- icon index ----
const iconIndex = new Map(); // lowercase basename -> path
function indexIcons(root, modPack = 0) {
  for (const f of walk(root)) {
    if (!/\.png$/i.test(f)) continue;
    const b = basename(f, '.png').toLowerCase();
    const prev = iconIndex.get(b);
    if (!prev || modPack >= prev.pack) iconIndex.set(b, { path: f, pack: modPack });
  }
}
console.log('Indexing icons…');
indexIcons(GAME, 0);
indexIcons(join(GAME, 'ui/Traits'), 0);
indexIcons(join(GAME, 'textures'), 0);

// ---- parse B42 character definitions ----
const traits = new Map();
const professions = new Map();

function parseList(val) {
  return String(val || '').split(';').map(s => shortId(s.trim().replace(/,\s*$/, ''))).filter(Boolean);
}

function parseBoosts(val) {
  return String(val || '').split(';').map(s => {
    const [p, n] = s.trim().split('=');
    return p && n ? { skill: perkName(p.trim()), n: +n } : null;
  }).filter(Boolean);
}

function parseBlocks(text, kind) {
  const re = new RegExp(`character_${kind}_definition\\s+([\\w]+:[\\w]+|[\\w]+)\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, 'g');
  const out = [];
  for (const m of text.matchAll(re)) out.push({ fullId: m[1], body: m[2] });
  return out;
}

function field(body, name) {
  const m = body.match(new RegExp(`${name}\\s*=\\s*([^,\\n]+)`, 'i'));
  return m ? m[1].trim().replace(/,\s*$/, '') : '';
}

function upsertTrait(id, data, mod) {
  const key = normKey(id);
  const t = traits.get(key) || {};
  Object.assign(t, { ...data, id: shortId(id), fullId: id, mod, key });
  traits.set(key, t);
}

function upsertProf(id, data, mod) {
  const key = normKey(id);
  const p = professions.get(key) || {};
  Object.assign(p, { ...data, id: shortId(id), fullId: id, mod, key });
  professions.set(key, p);
}

function parseCharacterFile(text, mod) {
  for (const { fullId, body } of parseBlocks(text, 'trait')) {
    const profTrait = /IsProfessionTrait\s*=\s*true/i.test(body);
    const cost = +field(body, 'Cost') || 0;
    const uiName = field(body, 'UIName').replace(/^"|"$/g, '');
    const uiDesc = field(body, 'UIDescription').replace(/^"|"$/g, '');
    const iconPath = field(body, 'IconPathName');
    upsertTrait(fullId, {
      name: T(uiName, prettify(shortId(fullId))),
      cost,
      desc: cleanHtml(T(uiDesc) || T('UI_trait_' + shortId(fullId) + 'Desc2')),
      profTrait,
      hidden: profTrait,
      boosts: parseBoosts(field(body, 'XPBoosts')),
      recipes: parseList(field(body, 'GrantedRecipes')),
      freeTraits: parseList(field(body, 'GrantedTraits')),
      conflicts: parseList(field(body, 'MutuallyExclusiveTraits')),
      iconKey: iconPath || `trait_${shortId(fullId)}`,
    }, mod);
  }
  for (const { fullId, body } of parseBlocks(text, 'profession')) {
    const cost = +field(body, 'Cost') || 0;
    const uiName = field(body, 'UIName').replace(/^"|"$/g, '');
    const uiDesc = field(body, 'UIDescription').replace(/^"|"$/g, '');
    const iconPath = field(body, 'IconPathName');
    upsertProf(fullId, {
      name: T(uiName, prettify(shortId(fullId))),
      cost,
      desc: cleanHtml(T(uiDesc)),
      boosts: parseBoosts(field(body, 'XPBoosts')),
      freeTraits: parseList(field(body, 'GrantedTraits')),
      recipes: parseList(field(body, 'GrantedRecipes')),
      iconKey: iconPath || `profession_${shortId(fullId)}`,
    }, mod);
  }
}

// Legacy Lua (HDX still ships some)
function parseLua(text, mod) {
  const localTrait = {}, localProf = {};
  for (const m of text.matchAll(/(?:local\s+(\w+)\s*=\s*)?TraitFactory\.addTrait\(\s*"([^"]+)"\s*,\s*getText\("([^"]+)"\)\s*,\s*(-?\d+)\s*,\s*getText\("([^"]+)"\)\s*(?:,\s*(true|false))?/g)) {
    const [, varName, id, nameKey, cost, descKey, profFlag] = m;
    upsertTrait(id, {
      name: T(nameKey, id),
      cost: +cost,
      desc: cleanHtml(T(descKey)),
      hidden: profFlag === 'true',
      profTrait: profFlag === 'true',
      boosts: [], recipes: [], freeTraits: [],
      iconKey: `trait_${id}`,
    }, mod);
    if (varName) localTrait[varName] = normKey(id);
  }
  for (const m of text.matchAll(/(?:local\s+(\w+)\s*=\s*)?ProfessionFactory\.addProfession\(\s*"([^"]+)"\s*,\s*getText\("([^"]+)"\)\s*,\s*"[^"]*"\s*,\s*(-?\d+)\s*(?:,\s*getText\("([^"]+)"\))?/g)) {
    const [, varName, id, nameKey, cost, descKey] = m;
    upsertProf(id, {
      name: T(nameKey, id),
      cost: +cost,
      desc: cleanHtml(T(descKey)),
      boosts: [], freeTraits: [], recipes: [],
      iconKey: `profession_${id}`,
    }, mod);
    if (varName) localProf[varName] = normKey(id);
  }
  const attach = (map, local, isTrait) => {
    for (const m of text.matchAll(/(\w+):addXPBoost\(\s*Perks\.(\w+)\s*,\s*(-?\d+)\s*\)/g)) {
      const o = map.get(local[m[1]]); if (o) o.boosts.push({ skill: perkName(m[2]), n: +m[3] });
    }
    for (const m of text.matchAll(/(\w+):addFreeTrait\(\s*"([^"]+)"\s*\)/g)) {
      const o = map.get(local[m[1]]); if (o && !o.freeTraits.includes(m[2])) o.freeTraits.push(m[2]);
    }
    for (const m of text.matchAll(/(\w+):getFreeRecipes\(\):add\(\s*"([^"]+)"\s*\)/g)) {
      const o = map.get(local[m[1]]); if (o && !o.recipes.includes(m[2])) o.recipes.push(m[2]);
    }
  };
  attach(traits, localTrait, true);
  attach(professions, localProf, false);
}

function parseSources(files, mod, pack) {
  const sorted = [...files].sort();
  for (const f of sorted) {
    let txt;
    try { txt = readFileSync(f, 'utf8'); } catch { continue; }
    if (f.endsWith('.txt') && /character_(trait|profession)/.test(txt)) parseCharacterFile(txt, mod);
    else if (f.endsWith('.lua') && /addTrait|addProfession/.test(txt)) parseLua(txt, mod);
  }
  for (const root of modRoots(join(dirname(files[0] || ''), '..', '..')) ) {} // noop placeholder
}

// ---- load vanilla translations ----
for (const f of walk(VANILLA_TRANS)) if (/\.txt$/i.test(f)) loadTranslations(f);

// ---- parse vanilla base game ----
console.log('Parsing vanilla…');
parseCharacterFile(readFileSync(VANILLA_TRAITS, 'utf8'), 'Base');
parseCharacterFile(readFileSync(VANILLA_PROFS, 'utf8'), 'Base');

// ---- discover + parse mods ----
const serverMods = loadServerMods();
const modDirs = new Map(); // folderName -> full path
for (const pack of readdirSync(WORKSHOP, { withFileTypes: true }).filter(e => e.isDirectory())) {
  const modsDir = join(WORKSHOP, pack.name, 'mods');
  let mods;
  try { mods = readdirSync(modsDir, { withFileTypes: true }).filter(e => e.isDirectory()); } catch { continue; }
  for (const mod of mods) {
    if (SKIP_MOD.test(mod.name)) continue;
    modDirs.set(mod.name, { path: join(modsDir, mod.name), pack: +pack.name });
  }
}

let parsedMods = 0;
const traitModNames = [];
for (const [name, { path: modDir, pack }] of modDirs) {
  const auto = [...walk(modDir)].some(f => f.endsWith('.txt') && readFileSync(f, 'utf8').includes('character_trait_definition'));
  const autoProf = [...walk(modDir)].some(f => f.endsWith('.txt') && readFileSync(f, 'utf8').includes('character_profession_definition'));
  const hasLua = [...walk(modDir)].some(f => f.endsWith('.lua') && /addTrait|addProfession/.test(readFileSync(f, 'utf8')));
  if (!serverMods.has(name) && !TRAIT_MODS_ALWAYS.has(name) && !auto && !autoProf && !hasLua) continue;

  const roots = modRoots(modDir);
  for (const root of roots) {
    for (const f of walk(root)) if (/Translate[\\\/]EN[\\\/].*\.txt$/i.test(f)) loadTranslations(f);
    indexIcons(root, pack);
  }
  const files = [];
  for (const root of roots) for (const f of walk(root)) {
    if (f.endsWith('.txt') || f.endsWith('.lua')) files.push(f);
  }
  const before = traits.size + professions.size;
  for (const f of files.sort()) {
    let txt;
    try { txt = readFileSync(f, 'utf8'); } catch { continue; }
    if (f.endsWith('.txt') && /character_(trait|profession)_definition/.test(txt)) parseCharacterFile(txt, name);
    else if (f.endsWith('.lua') && /addTrait|addProfession/.test(txt)) parseLua(txt, name);
  }
  if (traits.size + professions.size > before) { parsedMods++; traitModNames.push(name); }
}

console.log('Parsed trait/occ mods:', parsedMods, '—', traitModNames.join(', '));

// ---- resolve icons ----
function findIcon(iconKey, kind) {
  if (!iconKey) return null;
  const k = iconKey.toLowerCase().replace(/\.png$/i, '');
  const tries = [k];
  if (!k.startsWith('trait_') && kind === 'trait') tries.push('trait_' + k);
  if (!k.startsWith('profession_') && kind === 'prof') tries.push('profession_' + k);
  // also try without module prefixes
  const tail = k.split('_').pop();
  if (kind === 'trait') tries.push('trait_' + tail);
  const seen = new Set();
  for (const t of tries) {
    if (!t || seen.has(t)) continue;
    seen.add(t);
    const hit = iconIndex.get(t);
    if (hit) return hit.path;
    // case-insensitive scan
    for (const [key, val] of iconIndex) if (key === t || key.replace(/_/g, '') === t.replace(/_/g, '')) return val.path;
  }
  return null;
}

mkdirSync(OUT_TRAIT_ICONS, { recursive: true });
mkdirSync(OUT_PROF_ICONS, { recursive: true });

function copyIcon(src, outDir, fileName) {
  if (!src) return null;
  const dest = join(outDir, fileName);
  try { copyFileSync(src, dest); return `assets/${basename(outDir)}/${fileName}`; } catch { return null; }
}

// ---- build hidden lookup + selectable traits ----
const dedupBoosts = arr => {
  const seen = new Set(), out = [];
  for (const b of arr || []) { const k = b.skill + '|' + b.n; if (!seen.has(k)) { seen.add(k); out.push(b); } }
  return out;
};

const hidden = {};
const traitNameByKey = {};
for (const t of traits.values()) {
  t.boosts = dedupBoosts(t.boosts);
  traitNameByKey[t.key] = t.name;
  if (t.hidden || t.profTrait) hidden[t.key] = { name: t.name, boosts: t.boosts, recipes: t.recipes || [] };
}

const TEST = /^test/i;
const allTraits = [...traits.values()].filter(t =>
  !t.hidden && !t.profTrait && t.name && !TEST.test(t.id) && (t.cost !== 0 || t.boosts?.length || t.desc)
).map(t => {
  const iconSrc = findIcon(t.iconKey, 'trait');
  const icon = copyIcon(iconSrc, OUT_TRAIT_ICONS, `${t.key}.png`);
  const out = {
    id: t.id, key: t.key, name: t.name, cost: t.cost, mod: t.mod,
    kind: t.cost > 0 ? 'positive' : t.cost < 0 ? 'negative' : 'neutral',
  };
  if (icon) out.icon = icon;
  if (t.desc) out.desc = t.desc;
  if (t.boosts?.length) out.boosts = t.boosts;
  if (t.recipes?.length) out.recipes = t.recipes;
  if (t.mod && TRAIT_MODS_ALWAYS.has(t.mod) && t.mod !== 'Base') out.special = true;
  return out;
});

// professions
const profByName = new Map();
for (const p of professions.values()) {
  if (p.name === p.id) p.name = prettify(p.id);
  p.boosts = dedupBoosts(p.boosts);
  p.freeTraitNames = (p.freeTraits || []).map(id => traitNameByKey[normKey(id)] || shortId(id));
  const eff = {};
  for (const b of p.boosts) eff[b.skill] = (eff[b.skill] || 0) + b.n;
  for (const id of (p.freeTraits || [])) for (const b of (hidden[normKey(id)]?.boosts || [])) eff[b.skill] = (eff[b.skill] || 0) + b.n;
  p.effective = Object.entries(eff).map(([skill, n]) => ({ skill, n })).sort((a, b) => b.n - a.n);
  const iconSrc = findIcon(p.iconKey, 'prof');
  p.icon = copyIcon(iconSrc, OUT_PROF_ICONS, `${p.key}.png`);
  const richness = x => (x.effective?.length || 0) + (x.recipes?.length || 0);
  const prev = profByName.get(p.name);
  if (!prev || richness(p) >= richness(prev)) profByName.set(p.name, p);
}

const allProfs = [...profByName.values()].map(p => {
  const out = { id: p.id, key: p.key, name: p.name, cost: p.cost, mod: p.mod };
  if (p.icon) out.icon = p.icon;
  if (p.desc) out.desc = p.desc;
  if (p.effective?.length) out.effective = p.effective;
  if (p.freeTraitNames?.length) out.freeTraitNames = p.freeTraitNames;
  if (p.recipes?.length) out.recipes = p.recipes;
  if (p.mod && TRAIT_MODS_ALWAYS.has(p.mod)) out.special = true;
  return out;
});

// conflicts
const byKey = Object.fromEntries(allTraits.map(t => [t.key, t]));
for (const t of traits.values()) {
  if (!t.conflicts?.length) continue;
  const sel = byKey[t.key];
  if (!sel) continue;
  const ids = [...new Set(t.conflicts.map(c => byKey[normKey(c)]?.id).filter(Boolean))];
  if (ids.length) sel.conflicts = ids;
}

// dedupe trait names (keep higher |cost|)
const traitByName = new Map();
for (const t of allTraits.sort((a, b) => Math.abs(b.cost) - Math.abs(a.cost))) {
  if (!traitByName.has(t.name)) traitByName.set(t.name, t);
}
const finalTraits = [...traitByName.values()];
finalTraits.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'positive' ? -1 : 1) || b.cost - a.cost || a.name.localeCompare(b.name));
allProfs.sort((a, b) => a.name.localeCompare(b.name));

const stats = {
  traits: finalTraits.length,
  positive: finalTraits.filter(t => t.kind === 'positive').length,
  negative: finalTraits.filter(t => t.kind === 'negative').length,
  professions: allProfs.length,
  traitIcons: finalTraits.filter(t => t.icon).length,
  profIcons: allProfs.filter(p => p.icon).length,
  mods: traitModNames,
};

writeFileSync(OUT_JS, 'const GUIDE_TRAITS = ' + JSON.stringify({ traits: finalTraits, professions: allProfs, hidden, stats }) + ';\n');
console.log('Wrote', OUT_JS);
console.log(stats);

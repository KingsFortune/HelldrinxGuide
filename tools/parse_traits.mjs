// Extract traits + occupations (+ icons, descriptions, mechanics) → traits.js + assets/
// Usage: node tools/parse_traits.mjs
import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs';
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
const SKIP_MOD = /_0121|CleanRoomClosest/i;

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
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

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

// ---- translations (txt + json) ----
const trans = {};
function loadTranslationsTxt(file) {
  let txt;
  try { txt = readFileSync(file, 'utf8'); } catch { return; }
  for (const m of txt.matchAll(/^\s*([\w.]+)\s*=\s*"((?:[^"\\]|\\.)*)"\s*,?\s*$/gm))
    trans[m[1]] = m[2].replace(/\\"/g, '"');
}
function loadTranslationsJson(file) {
  try {
    const j = JSON.parse(readFileSync(file, 'utf8'));
    for (const [k, v] of Object.entries(j)) if (typeof v === 'string') trans[k] = v;
  } catch {}
}
function loadTranslationsDir(dir) {
  for (const f of walk(dir)) {
    if (!/\/EN\//i.test(f.replace(/\\/g, '/')) && !/\\EN\\/.test(f)) continue;
    if (/\.txt$/i.test(f)) loadTranslationsTxt(f);
    else if (/UI\.json$/i.test(f)) loadTranslationsJson(f);
  }
}
const T = (key, fb = '') => (key && trans[key]) ? trans[key] : fb;
const cleanHtml = s => String(s || '')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, '')
  .replace(/(\+?\d+)@\s*/g, '$1 — ')
  .replace(/\s+/g, ' ')
  .trim();

function nameVariants(id) {
  const sid = shortId(id);
  const out = new Set([sid, sid.toLowerCase(), cap(sid), cap(sid.toLowerCase())]);
  if (/[A-Z]/.test(sid)) out.add(sid);
  return [...out];
}

function resolveDesc(id, uidescKey, kind = 'trait') {
  const keys = [];
  if (uidescKey && !uidescKey.includes(':')) keys.push(uidescKey);
  const prefix = kind === 'prof' ? 'UI_profdesc_' : 'UI_trait';
  const descPrefix = kind === 'prof' ? 'UI_profdesc_' : 'UI_traitdesc_';
  for (const v of nameVariants(id)) {
    keys.push(
      `${prefix}_${v}Desc2`, `${prefix}_${v}desc2`, `${prefix}_${v}2Desc`, `${prefix}_${v}2desc`,
      `${descPrefix}${v}`, `${prefix}_${v}Desc`, `${prefix}_${v}desc`,
      `${prefix}desc_${v}`,
    );
  }
  const seen = new Set();
  for (const k of keys) {
    if (!k || seen.has(k)) continue;
    seen.add(k);
    const v = cleanHtml(T(k));
    if (v) return v;
  }
  return '';
}

function resolveName(id, uinameKey, fb) {
  if (uinameKey) { const v = T(uinameKey); if (v) return v; }
  for (const v of nameVariants(id)) {
    const n = T(`UI_trait_${v}`) || T(`UI_prof_${v}`);
    if (n) return n;
  }
  return fb || prettify(shortId(id));
}

// ---- icon index (aggressive) ----
const iconIndex = new Map();
function addIconKey(key, path, pack) {
  const k = key.toLowerCase();
  const prev = iconIndex.get(k);
  if (!prev || pack >= prev.pack) iconIndex.set(k, { path, pack });
}
function indexPng(root, pack = 0) {
  for (const f of walk(root)) {
    if (!/\.png$/i.test(f)) continue;
    const b = basename(f, '.png');
    const bl = b.toLowerCase();
    addIconKey(bl, f, pack);
    addIconKey(bl.replace(/^item_/, ''), f, pack);
    if (bl.startsWith('trait_')) addIconKey(bl.slice(6), f, pack);
    if (bl.startsWith('profession_')) addIconKey(bl.slice(11), f, pack);
  }
}

console.log('Indexing icons (full workshop scan)…');
indexPng(GAME, 0);
indexPng(join(GAME, 'ui/Traits'), 0);
indexPng(join(GAME, 'textures'), 0);
for (const pack of readdirSync(WORKSHOP, { withFileTypes: true }).filter(e => e.isDirectory())) {
  const modsDir = join(WORKSHOP, pack.name, 'mods');
  let mods;
  try { mods = readdirSync(modsDir, { withFileTypes: true }).filter(e => e.isDirectory()); } catch { continue; }
  for (const mod of mods) {
    for (const root of modRoots(join(modsDir, mod.name))) {
      indexPng(join(root, 'ui/Traits'), +pack.name);
      indexPng(join(root, 'textures'), +pack.name);
      indexPng(root, +pack.name);
    }
  }
}

const TRAIT_ICON_ALIASES = {
  strong: ['trait_stronggrip', 'trait_stronggrip2'],
  stout: ['trait_strongback', 'trait_strongback2'],
  feeble: ['trait_weakback'],
  weak: ['trait_weakback'],
  fit: ['trait_athletic'],
  athletic: ['trait_athletic'],
  obese: ['trait_overweight'],
  underweight: ['trait_veryunderweight'],
  veryunderweight: ['trait_veryunderweight'],
  overweight: ['trait_overweight'],
  jogger: ['trait_marathonrunner'],
  gardener: ['trait_gardener2'],
  fishing: ['trait_fishing'],
  handy: ['trait_crafty'],
  cook: ['trait_culinary'],
  cook2: ['trait_culinary'],
  herbalist: ['trait_herbalist_prof'],
  burglar: ['trait_burglar'],
  mechanics: ['trait_mechanics2'],
  mechanics2: ['trait_mechanics2'],
  speeddemon: ['trait_speeddemon'],
  sundaydriver: ['trait_sundaydriver'],
  artisan: ['trait_artisan'],
  mason: ['trait_mason'],
  whittler: ['trait_whittler'],
  tailor: ['trait_tailor'],
  inventive: ['trait_inventive'],
  wildernessknowledge: ['trait_wildernessknowledge'],
};

function findIcon(iconKey, id, kind) {
  const sid = shortId(id);
  const tries = new Set();
  const add = k => { if (k) tries.add(k.toLowerCase()); };
  add(iconKey);
  if (kind === 'trait') {
    for (const v of nameVariants(sid)) {
      add(`trait_${v}`);
      add(`trait_${v.toLowerCase()}`);
      add(v);
    }
    for (const a of (TRAIT_ICON_ALIASES[normKey(sid)] || [])) add(a);
  } else {
    for (const v of nameVariants(sid)) {
      add(`profession_${v}`);
      add(`profession_${v.toLowerCase()}`);
    }
  }
  for (const t of tries) {
    const hit = iconIndex.get(t);
    if (hit) return hit.path;
  }
  for (const t of tries) {
    const t2 = t.replace(/_/g, '');
    for (const [k, v] of iconIndex) if (k.replace(/_/g, '') === t2) return v.path;
  }
  return null;
}

// ---- parse definitions ----
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
      uiName, uiDesc,
      cost,
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
      uiName, uiDesc,
      cost,
      boosts: parseBoosts(field(body, 'XPBoosts')),
      freeTraits: parseList(field(body, 'GrantedTraits')),
      recipes: parseList(field(body, 'GrantedRecipes')),
      iconKey: iconPath || `profession_${shortId(fullId)}`,
    }, mod);
  }
}

function parseLua(text, mod) {
  const localTrait = {}, localProf = {};
  for (const m of text.matchAll(/(?:local\s+(\w+)\s*=\s*)?TraitFactory\.addTrait\(\s*"([^"]+)"\s*,\s*getText\("([^"]+)"\)\s*,\s*(-?\d+)\s*,\s*getText\("([^"]+)"\)\s*(?:,\s*(true|false))?/g)) {
    const [, varName, id, nameKey, cost, descKey, profFlag] = m;
    upsertTrait(id, {
      uiName: nameKey, uiDesc: descKey,
      cost: +cost,
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
      uiName: nameKey, uiDesc: descKey || '',
      cost: +cost,
      boosts: [], freeTraits: [], recipes: [],
      iconKey: `profession_${id}`,
    }, mod);
    if (varName) localProf[varName] = normKey(id);
  }
  const attach = (map, local) => {
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
  attach(traits, localTrait);
  attach(professions, localProf);
}

// ---- phase 1: load ALL translations ----
console.log('Loading translations…');
loadTranslationsDir(VANILLA_TRANS);
try { loadTranslationsJson(join(VANILLA_TRANS, 'UI.json')); } catch {}

const serverMods = loadServerMods();
const modDirs = new Map();
for (const pack of readdirSync(WORKSHOP, { withFileTypes: true }).filter(e => e.isDirectory())) {
  const modsDir = join(WORKSHOP, pack.name, 'mods');
  let mods;
  try { mods = readdirSync(modsDir, { withFileTypes: true }).filter(e => e.isDirectory()); } catch { continue; }
  for (const mod of mods) {
    if (SKIP_MOD.test(mod.name)) continue;
    modDirs.set(mod.name, join(modsDir, mod.name));
  }
}
for (const [, modDir] of modDirs) {
  for (const root of modRoots(modDir)) loadTranslationsDir(join(root, 'lua/shared/Translate'));
}

// ---- phase 2: parse all definitions ----
console.log('Parsing vanilla…');
parseCharacterFile(readFileSync(VANILLA_TRAITS, 'utf8'), 'Base');
parseCharacterFile(readFileSync(VANILLA_PROFS, 'utf8'), 'Base');

let parsedMods = 0;
const traitModNames = [];
for (const [name, modDir] of modDirs) {
  const files = [];
  for (const root of modRoots(modDir)) {
    for (const f of walk(root)) {
      if (f.endsWith('.txt') || f.endsWith('.lua')) files.push(f);
    }
  }
  const hasTraitContent = files.some(f => {
    try {
      const t = readFileSync(f, 'utf8');
      return /character_(trait|profession)_definition|addTrait|addProfession/.test(t);
    } catch { return false; }
  });
  if (!serverMods.has(name) && !TRAIT_MODS_ALWAYS.has(name) && !hasTraitContent) continue;

  const before = traits.size + professions.size;
  for (const f of files.sort()) {
    let txt;
    try { txt = readFileSync(f, 'utf8'); } catch { continue; }
    if (f.endsWith('.txt') && /character_(trait|profession)_definition/.test(txt)) parseCharacterFile(txt, name);
    else if (f.endsWith('.lua') && /addTrait|addProfession/.test(txt)) parseLua(txt, name);
  }
  if (traits.size + professions.size > before) { parsedMods++; traitModNames.push(name); }
}
console.log('Parsed mods:', parsedMods, '—', traitModNames.join(', '));

// ---- phase 3: resolve names, descriptions, mechanics ----
const dedupBoosts = arr => {
  const seen = new Set(), out = [];
  for (const b of arr || []) { const k = b.skill + '|' + b.n; if (!seen.has(k)) { seen.add(k); out.push(b); } }
  return out;
};

function buildMechanics(t, traitNameByKey, conflictNames) {
  const m = [];
  if (t.boosts?.length) {
    for (const b of t.boosts) {
      const abs = Math.abs(b.n);
      m.push(`${b.skill}: ${b.n > 0 ? '+' : '−'}${abs} starting level${abs !== 1 ? 's' : ''}`);
    }
  }
  if (t.recipes?.length) {
    const show = t.recipes.slice(0, 8);
    m.push(`Teaches ${t.recipes.length} recipe${t.recipes.length > 1 ? 's' : ''}: ${show.join(', ')}${t.recipes.length > 8 ? '…' : ''}`);
  }
  if (t.freeTraits?.length) {
    const names = t.freeTraits.map(id => traitNameByKey[normKey(id)] || shortId(id));
    m.push(`Grants traits: ${names.join(', ')}`);
  }
  if (conflictNames?.length) m.push(`Cannot combine with: ${conflictNames.join(', ')}`);
  if (t.cost) m.push(`Point cost: ${t.cost > 0 ? '+' : ''}${t.cost}`);
  return m;
}

function buildProfMechanics(p) {
  const m = [];
  if (p.cost) m.push(`Occupation points: ${p.cost > 0 ? '+' : ''}${p.cost}`);
  if (p.effective?.length) {
    for (const b of p.effective) {
      const abs = Math.abs(b.n);
      m.push(`${b.skill}: ${b.n > 0 ? '+' : '−'}${abs} starting level${abs !== 1 ? 's' : ''}`);
    }
  }
  if (p.freeTraitNames?.length) m.push(`Free traits: ${p.freeTraitNames.join(', ')}`);
  if (p.recipes?.length) {
    const show = p.recipes.slice(0, 6);
    m.push(`Knows ${p.recipes.length} recipe${p.recipes.length > 1 ? 's' : ''}: ${show.join(', ')}${p.recipes.length > 6 ? '…' : ''}`);
  }
  return m;
}

const hidden = {};
for (const t of traits.values()) {
  t.boosts = dedupBoosts(t.boosts);
  t.name = resolveName(t.fullId || t.id, t.uiName, prettify(t.id));
  t.desc = resolveDesc(t.fullId || t.id, t.uiDesc, 'trait');
  if (t.hidden || t.profTrait) hidden[t.key] = { name: t.name, boosts: t.boosts, recipes: t.recipes || [] };
}
const traitNameByKey = {};
for (const t of traits.values()) traitNameByKey[t.key] = t.name;

for (const p of professions.values()) {
  p.boosts = dedupBoosts(p.boosts);
  p.name = resolveName(p.fullId || p.id, p.uiName, prettify(p.id));
  p.desc = resolveDesc(p.fullId || p.id, p.uiDesc, 'prof');
  p.freeTraitNames = (p.freeTraits || []).map(id => traitNameByKey[normKey(id)] || shortId(id));
  const eff = {};
  for (const b of p.boosts) eff[b.skill] = (eff[b.skill] || 0) + b.n;
  for (const id of (p.freeTraits || [])) for (const b of (hidden[normKey(id)]?.boosts || [])) eff[b.skill] = (eff[b.skill] || 0) + b.n;
  p.effective = Object.entries(eff).map(([skill, n]) => ({ skill, n })).sort((a, b) => b.n - a.n);
}

mkdirSync(OUT_TRAIT_ICONS, { recursive: true });
mkdirSync(OUT_PROF_ICONS, { recursive: true });
function copyIcon(src, outDir, fileName) {
  if (!src) return null;
  try { copyFileSync(src, join(outDir, fileName)); return `assets/${basename(outDir)}/${fileName}`; } catch { return null; }
}

const TEST = /^test/i;
let rawTraits = [...traits.values()].filter(t =>
  !t.hidden && !t.profTrait && t.name && !TEST.test(t.id) && (t.cost !== 0 || t.boosts?.length || t.desc)
);

// conflicts
const byKey = Object.fromEntries(rawTraits.map(t => [t.key, t]));
for (const t of traits.values()) {
  if (!t.conflicts?.length) continue;
  const sel = byKey[t.key];
  if (!sel) continue;
  sel.conflictIds = [...new Set(t.conflicts.map(c => byKey[normKey(c)]?.id).filter(Boolean))];
  sel.conflictNames = sel.conflictIds.map(id => byKey[normKey(id)]?.name || id);
}

const allTraits = rawTraits.map(t => {
  const icon = copyIcon(findIcon(t.iconKey, t.id, 'trait'), OUT_TRAIT_ICONS, `${t.key}.png`);
  const out = {
    id: t.id, key: t.key, name: t.name, cost: t.cost, mod: t.mod,
    kind: t.cost > 0 ? 'positive' : t.cost < 0 ? 'negative' : 'neutral',
  };
  if (icon) out.icon = icon;
  if (t.desc) out.desc = t.desc;
  if (t.boosts?.length) out.boosts = t.boosts;
  if (t.recipes?.length) out.recipes = t.recipes;
  if (t.conflictIds?.length) out.conflicts = t.conflictIds;
  const mechanics = buildMechanics(t, traitNameByKey, t.conflictNames);
  if (mechanics.length) out.mechanics = mechanics;
  if (!out.desc && mechanics.length) {
    const useful = mechanics.filter(l => !/^Point cost:/.test(l) && !/^Cannot combine/.test(l));
    if (useful.length) out.desc = useful.join('. ') + '.';
  }
  if (t.mod && TRAIT_MODS_ALWAYS.has(t.mod) && t.mod !== 'Base') out.special = true;
  return out;
});

const profByName = new Map();
for (const p of professions.values()) {
  const icon = copyIcon(findIcon(p.iconKey, p.id, 'prof'), OUT_PROF_ICONS, `${p.key}.png`);
  const richness = x => (x.effective?.length || 0) + (x.recipes?.length || 0) + (x.desc ? 1 : 0);
  const prev = profByName.get(p.name);
  const entry = { ...p, icon };
  if (!prev || richness(entry) >= richness(prev)) profByName.set(p.name, entry);
}

const allProfs = [...profByName.values()].map(p => {
  const out = { id: p.id, key: p.key, name: p.name, cost: p.cost, mod: p.mod };
  if (p.icon) out.icon = p.icon;
  if (p.desc) out.desc = p.desc;
  if (p.effective?.length) out.effective = p.effective;
  if (p.freeTraitNames?.length) out.freeTraitNames = p.freeTraitNames;
  if (p.recipes?.length) out.recipes = p.recipes;
  const mechanics = buildProfMechanics(p);
  if (mechanics.length) out.mechanics = mechanics;
  if (!out.desc && mechanics.length) {
    const useful = mechanics.filter(l => !/^Occupation points:/.test(l));
    if (useful.length) out.desc = useful.join('. ') + '.';
  }
  if (p.mod && TRAIT_MODS_ALWAYS.has(p.mod)) out.special = true;
  return out;
});

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
  withDesc: finalTraits.filter(t => t.desc).length,
  withMechanics: finalTraits.filter(t => t.mechanics?.length).length,
  mods: traitModNames,
};

writeFileSync(OUT_JS, 'const GUIDE_TRAITS = ' + JSON.stringify({ traits: finalTraits, professions: allProfs, hidden, stats }) + ';\n');
console.log('Wrote', OUT_JS);
console.log(stats);

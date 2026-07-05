// Builds qol.js — utility/crafting items with loot tags (molds, tools, mechanics, etc.)
// Usage: node parse_qol.mjs   (run parse_details.mjs first for spawn keys)
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const WORKSHOP = 'D:/SteamLibrary/steamapps/workshop/content/108600';
const GAME = 'D:/SteamLibrary/steamapps/common/ProjectZomboid/media';
const OUT = join(ROOT, '..', 'qol.js');
const DETAILS = join(ROOT, '..', 'details.js');
const POOL_LOCS = join(ROOT, '..', 'pool_locs.js');

// ★ curated — note = dossier blurb; extraWhere = hand-tuned spawn lines
const QOL_INTEL = {
  'Base.IronBarMold': { star: true, note: 'Permanent mold. Clay/ceramic break every smithing use.', extraWhere: ['<b>Best bet:</b> <b>blacksmith shop</b> metal shelving — <code>BlacksmithMolds</code> (w20) or <code>BlacksmithTools</code> (w2). Backup: garage <code>CrateBlacksmithing</code>, U-Store It units.'] },
  'Base.IronIngotMold': { star: true, note: 'Permanent ingot mold.' },
  'Base.SteelBarMold': { star: true, note: 'Best bar mold tier — steel, durable.' },
  'Base.SteelIngotMold': { star: true, note: 'Best ingot mold tier.' },
  'Base.ClayBarMold': { star: true, note: 'Disposable — breaks on use. Upgrade to iron/steel.' },
  'Base.ClayIngotMold': { star: true, note: 'Disposable ingot mold.' },
  'Base.WoodenBarCastMold': { star: true, note: 'Early disposable mold.' },
  'Base.CeramicCrucible': { star: true, note: 'Smelt ore before casting bars.' },
  'Base.Bellows': { star: true, note: 'Forge addon — speeds smelting.' },
  'Base.Mov_ElectricBlowerForge': { star: true, note: 'Electric forge — no charcoal needed.' },
  'Base.BlacksmithAnvil': { star: true, note: 'Placeable anvil for base forging.' },
  'Base.BenchAnvil': { star: true, note: 'Portable anvil.' },
  'Base.SmithingHammer': { star: true, note: 'Required for most forge recipes.' },
  'Base.Tongs': { star: true, note: 'Handle hot metal at forge.' },
  'Base.BallPeenHammer': { star: true, note: 'Metalwork + some mechanic recipes.' },
  'Base.BlowTorch': { star: true, note: 'Welding / vehicle metal repair.', extraWhere: ['<b>Best bet:</b> <b>metal fabrication</b> tool cabinet (<code>MetalShopTools</code>, w20). Mechanic shops: <code>GarageMechanics</code>, <code>WeldingWorkshopTools</code>.'] },
  'Base.PropaneTank': { star: true, note: 'Blowtorch fuel — grab multiples.' },
  'Base.WeldingMask': { star: true, note: 'Required to weld.' },
  'Base.Jack': { star: true, note: 'Tire changes + some repairs.', extraWhere: ['<b>Best bet:</b> mechanic shop tool cabinets (<code>ToolCabinetMechanics</code>), shelves (<code>MechanicShelfTools</code>), garage <code>CrateMechanics</code>.'] },
  'Base.LugWrench': { star: true, note: 'Remove lug nuts.' },
  'Base.Wrench': { star: true, note: 'Core mechanic tool.' },
  'Base.Screwdriver': { star: true, note: 'Repairs + disassembly.' },
  'Base.CarBatteryCharger': { star: true, note: 'Recharge batteries at base (needs power).' },
  'Base.ElectronicsScrap': { star: true, note: 'Electronics crafting staple.' },
  'Base.Generator': { star: true, note: 'Base power. Loud — attracts zombies.', extraWhere: ['<b>Best bet:</b> sheds, garages, storage units — <code>GeneratorRoom</code>. Utility truck beds.'] },
  'Base.SutureNeedle': { star: true, note: 'Close deep wounds.', extraWhere: ['<b>Best bet:</b> medical clinic/hospital cabinets (<code>MedicalClinicTools</code>). Pharmacies. Ambulances.'] },
  'Base.AlcoholWipes': { star: true, note: 'Wound disinfectant.' },
  'Base.Disinfectant': { star: true, note: 'Bottle disinfectant.' },
  'Base.Antibiotics': { star: true, note: 'Treat infection.', extraWhere: ['<b>Best bet:</b> pharmacy shelves, <code>MedicalClinicDrugs</code>, <code>MedicalStorageDrugs</code>.'] },
  'Base.PillsAntiDep': { star: true, note: 'Reduces panic.' },
  'Base.Splint': { star: true, note: 'Sets fractures.' },
  'Base.Tent': { star: true, note: 'Portable shelter.' },
  'Base.SleepingBag': { star: true, note: 'Bedroll for camping.' },
  'Base.CampingTentKit': { star: true, note: 'Tent kit — one slot deploy.' },
  'Base.FishingRod': { star: true, note: 'Fish at water tiles.' },
  'Base.Mov_RainCollectorBarrel': { star: true, note: 'Rain water at base.' },
  'Base.Bucket': { star: true, note: 'Water transport + cleaning.' },
  'Base.Saw': { star: true, note: 'Carpentry builds.' },
  'Base.Sledgehammer': { star: true, note: 'Demolition for scrap.' },
  'Base.Crowbar': { star: true, note: 'Silent doors + weapon.' },
  'Base.PickAxe': { star: true, note: 'Mining / chopping.' },
  'Base.Shovel': { star: true, note: 'Farming + graves.' },
  'Base.DuctTape': { star: true, note: 'Universal repair material.' },
  'Base.Glue': { star: true, note: 'Wood repair.' },
  'Base.Epoxy': { star: true, note: 'Vehicle panel repair.', extraWhere: ['<b>Best bet:</b> mechanic shops, metal fabrication — <code>MetalShopTools</code>, <code>MechanicSpecial</code>.'] },
  'Base.FiberglassTape': { star: true, note: 'Pairs with epoxy for body repair.' },
  'Base.SmithingMag1': { star: true, note: 'Basic smithing recipes.' },
  'Base.MechanicMag1': { star: true, note: 'Basic vehicle repair recipes.' },
  'Base.ElectronicsMag1': { star: true, note: 'Generator + wiring recipes.' },
  'ToolsOfTheTrade.CastIronSkillet': { star: true, note: 'Durable skillet (ToolsOfTheTrade).', extraWhere: ['<b>Best bet:</b> <code>CrateRandomJunk</code> in warehouses/storage.'] },
};

const TAG_DEFS = [
  { id: 'smithing', label: 'Smithing & Forging', test: /mold|ingot|anvil|smith|forge|crucible|bellows|blower|smelt|bar cast|tong|blacksmith|metalwork|whetstone|grindstone|ceramic crucible|iron bar|steel bar|pig iron|workable iron/i },
  { id: 'mechanics', label: 'Mechanics & Vehicles', test: /car lift|carlift|jack|mechanic|engine|tire|brake|transmission|oil filter|fuel filter|vehicle tuner|welder|lug wrench|socket set|vulcanize|automotive|car battery|spark plug/i },
  { id: 'reloading', label: 'Ammo & Reloading', test: /reload|press|primer|casing|gunpowder|ammomaker|die set|spenner|bullet tip|shotgun shell|hand press|deprimer/i },
  { id: 'medical', label: 'Medical', test: /suture|antiseptic|splint|prosthetic|firstaid|disinfect|bandage|painkiller|antibiotic|scalpel|tweezers|surgical|vitamin|pill/i },
  { id: 'electrical', label: 'Electrical & Power', test: /generator|solar|inverter|electric wire|electronics scrap|car battery|alarm clock|flashlight|battery|charge|transformer|electrician/i },
  { id: 'tools', label: 'Tools & Repair', test: /screwdriver|hammer|saw|axe|shovel|crowbar|pliers|multitool|duct tape|glue|propane|blowtorch|wrench|toolbox|chisel|file\b|level\b|trowel|pickaxe|sledge/i },
  { id: 'storage', label: 'Storage & Base', test: /^mov_|barrel|rain collector|water dispenser|crate|canning|freezer|fridge|storage|shelf|jukebox|furniture/i },
  { id: 'farming', label: 'Farming & Food', test: /seed|fertilizer|compost|hoe|watering|crop\b|farm|garden|milk churn|cheese/i },
  { id: 'survival', label: 'Survival QoL', test: /tent|sleeping bag|campfire kit|fishing|trap|water bottle|canteen|matches|lighter|log burner|lantern|rope|tarp/i },
];

function loadJsonExport(path, key) {
  const t = readFileSync(path, 'utf8');
  return JSON.parse(t.replace(new RegExp(`^const ${key}\\s*=\\s*`), '').replace(/;\s*$/, ''));
}

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
  if (names.includes('common')) roots.push(join(modDir, 'common', 'media', 'scripts'));
  if (names.includes('media')) roots.push(join(modDir, 'media', 'scripts'));
  for (const v of names.filter(n => /^42(\.\d+)?$/.test(n)).sort()) roots.push(join(modDir, v, 'media', 'scripts'));
  return roots;
}

const names = new Map();
const items = new Map(); // _id -> record

function loadNames() {
  // vanilla JSON names
  try {
    const j = JSON.parse(readFileSync(join(GAME, 'lua/shared/Translate/EN/ItemName.json'), 'utf8'));
    for (const [k, v] of Object.entries(j)) names.set(k, v);
  } catch {}
  // workshop txt names
  for (const pack of readdirSync(WORKSHOP, { withFileTypes: true }).filter(e => e.isDirectory())) {
    const modsDir = join(WORKSHOP, pack.name, 'mods');
    let mods;
    try { mods = readdirSync(modsDir, { withFileTypes: true }).filter(e => e.isDirectory()); } catch { continue; }
    for (const mod of mods) {
      for (const f of walk(join(modsDir, mod.name))) {
        if (!/Translate[\\\/]EN[\\\/]ItemName/i.test(f) || !f.endsWith('.txt')) continue;
        try {
          for (const m of readFileSync(f, 'utf8').matchAll(/ItemName_([\w.]+?)\s*=\s*"([^"]*)"/g))
            names.set(m[1], m[2]);
        } catch {}
      }
    }
  }
}

const KEEP = new Set(['DisplayName', 'DisplayCategory', 'ItemType', 'Type', 'Tags', 'Weight', 'Tooltip']);

function parseScript(text, source) {
  text = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const lines = text.split('\n');
  let depth = 0, module_ = null, item = null, itemDepth = -1;
  for (const raw of lines) {
    const line = raw.trim();
    const mMod = line.match(/^module\s+(\S+)/i);
    const mItem = line.match(/^item\s+(.+?)\s*\{?\s*$/i);
    if (mMod && depth === 0) module_ = mMod[1];
    else if (mItem && module_ && depth === 1 && !item) {
      item = { _id: module_ + '.' + mItem[1].replace(/\{.*/, '').trim(), _src: source };
      itemDepth = depth;
    } else if (item && depth === itemDepth + 1) {
      const kv = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+?),?\s*$/);
      if (kv && KEEP.has(kv[1])) item[kv[1]] = kv[2].trim();
    }
    for (const ch of line) {
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (item && depth === itemDepth) {
          if (Object.keys(item).length > 2) {
            const prev = items.get(item._id);
            if (prev) Object.assign(prev, item);
            else items.set(item._id, item);
          }
          item = null;
        }
        if (depth === 0) module_ = null;
      }
    }
  }
}

function tagItem(rec) {
  const blob = [rec._id, rec.DisplayName, names.get(rec._id), rec._cat, rec._note].filter(Boolean).join(' ');
  return TAG_DEFS.filter(t => t.test.test(blob)).map(t => t.id);
}

function mergeSpawns(id, short, spawns) {
  const a = spawns[id] || [], b = spawns[short] || [];
  if (!a.length) return b;
  if (!b.length) return a;
  const seen = new Set();
  const out = [];
  for (const s of [...b, ...a]) {
    const k = [s.where, s.mod, s.weight, s.rolls].join('|');
    if (seen.has(k)) continue;
    seen.add(k); out.push(s);
  }
  return out;
}

function buildWhereLines(id, spawns, intel, poolLocs) {
  const lines = [];
  const seen = new Set();
  if (intel?.extraWhere) for (const w of intel.extraWhere) lines.push(w);

  const roomSpawns = [], poolSpawns = [];
  for (const s of spawns || []) {
    if (/^room "/.test(s.where)) roomSpawns.push(s);
    else {
      const pool = s.where.replace(/ \(vehicle\)$/, '');
      if (!seen.has(pool + (s.weight || ''))) { seen.add(pool + (s.weight || '')); poolSpawns.push({ ...s, pool }); }
    }
  }

  for (const s of poolSpawns.sort((a, b) => (a.mod === 'Vanilla' ? -1 : 1) - (b.mod === 'Vanilla' ? -1 : 1) || (b.weight || 0) - (a.weight || 0))) {
    const pl = poolLocs[s.pool];
    const wt = s.weight ? ` <span class="count">item weight ${s.weight} · ${s.rolls || '?'} rolls</span>` : '';
    if (pl?.hint) lines.push(pl.hint + wt);
    else lines.push(`<b>${s.pool}</b> loot pool${s.weight ? ` — weight ${s.weight}` : ''}${s.mod && s.mod !== 'Vanilla' ? ` · mod: ${s.mod}` : ''}`);
  }

  for (const s of roomSpawns) {
    const rm = s.where.match(/^room "([^"]+)" → (\w+)$/);
    lines.push(`<b>Scripted room</b> — "${rm?.[1] || s.where}" container <code>${rm?.[2] || '?'}</code> on the <b>${s.mod}</b> map${s.weight ? ` · weight ${s.weight}` : ''}${s.rolls ? ` · ${s.rolls} rolls` : ''}`);
  }

  return [...new Set(lines)].slice(0, 18);
}

function displayName(rec) {
  if (rec.DisplayName) return rec.DisplayName.replace(/^"|"$/g, '');
  return names.get(rec._id) || rec._id.split('.').pop().replace(/_/g, ' ');
}

function category(rec) {
  return (rec.DisplayCategory || '').replace(/^base:/, '').replace(/^"|"$/g, '') || null;
}

function isGearType(rec) {
  const t = (rec.Type || (rec.ItemType || '').replace(/^base:/, '')).toLowerCase();
  return t === 'weapon' || t === 'weaponpart' || t === 'clothing' || t === 'container';
}

// load details + pool locs
let guideDetails = { spawns: {} };
let poolLocs = {};
try { guideDetails = loadJsonExport(DETAILS, 'GUIDE_DETAILS'); } catch (e) { console.log('details.js missing'); }
try { poolLocs = loadJsonExport(POOL_LOCS, 'GUIDE_POOL_LOCS').pools || {}; } catch (e) { console.log('pool_locs.js missing — run parse_pool_locs.mjs'); }

const spawnKeys = new Set(Object.keys(guideDetails.spawns || {}));

loadNames();

// vanilla generated items
for (const f of walk(join(GAME, 'scripts'))) {
  if (!f.endsWith('.txt') || !/[\\\/]items[\\\/]/i.test(f)) continue;
  try { parseScript(readFileSync(f, 'utf8'), 'Vanilla'); } catch {}
}

// workshop items
for (const pack of readdirSync(WORKSHOP, { withFileTypes: true }).filter(e => e.isDirectory())) {
  const modsDir = join(WORKSHOP, pack.name, 'mods');
  let mods;
  try { mods = readdirSync(modsDir, { withFileTypes: true }).filter(e => e.isDirectory()); } catch { continue; }
  for (const mod of mods) {
    for (const root of scriptRoots(join(modsDir, mod.name))) {
      for (const f of walk(root)) {
        if (!f.endsWith('.txt')) continue;
        try { parseScript(readFileSync(f, 'utf8'), mod.name); } catch {}
      }
    }
  }
}

const recipeOutputs = new Set(Object.keys(guideDetails.recipes || {}));

const qol = [];
for (const rec of items.values()) {
  if (isGearType(rec)) continue;
  const short = rec._id.replace(/^[\w]+\./, '');
  const dn = displayName(rec);
  const cat = category(rec);
  const intel = QOL_INTEL[rec._id];
  const tags = tagItem({ ...rec, DisplayName: dn, _note: intel?.note });
  const inSpawns = spawnKeys.has(short) || spawnKeys.has(rec._id);
  const hasIntel = !!intel;
  if (!tags.length && !hasIntel) continue;
  if (/debug|test|admin|unused|placeholder/i.test(rec._id + dn)) continue;

  const sp = mergeSpawns(rec._id, short, guideDetails.spawns);
  const where = buildWhereLines(rec._id, sp, intel, poolLocs);

  qol.push({
    _id: rec._id,
    DisplayName: dn,
    _src: rec._src,
    _cat: cat,
    _tags: tags,
    _note: intel?.note || null,
    _star: !!(intel?.star),
    _where: where,
    _spawn: inSpawns,
  });
}

qol.sort((a, b) => (b._star - a._star) || a.DisplayName.localeCompare(b.DisplayName));
const tags = Object.fromEntries(TAG_DEFS.map(t => [t.id, t.label]));
const stars = qol.filter(i => i._star).length;
const withWhere = qol.filter(i => i._where.length).length;
console.log(`QoL items: ${qol.length} · ★ ${stars} starred · ${withWhere} with location data`);
writeFileSync(OUT, 'const GUIDE_QOL = ' + JSON.stringify({ tags, items: qol }) + ';\n');
console.log('Wrote ' + OUT);

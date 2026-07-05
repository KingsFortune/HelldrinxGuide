// Parses Project Zomboid B42 script files from the workshop folder into data.js for the guide.
// Usage: node parse.mjs
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const WORKSHOP = 'D:/SteamLibrary/steamapps/workshop/content/108600';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'data.js');

const KEEP_TYPES = new Set(['Weapon', 'WeaponPart', 'Clothing', 'Container']);
const KEEP_FIELDS = new Set([
  'DisplayName','Type','ItemType','Weight','Categories','SubCategory','Tags','BodyLocation','CanBeEquipped',
  'Icon','Tooltip',
  // melee/ranged shared
  'MinDamage','MaxDamage','MaxHitCount','CriticalChance','CritDmgMultiplier','MinRange','MaxRange',
  'ConditionMax','ConditionLowerChanceOneIn','TwoHandWeapon','RequiresEquippedBothHands',
  'TreeDamage','DoorDamage','MinimumSwingTime','SwingTime','BaseSpeed','WeaponLength','KnockdownMod',
  // guns
  'AmmoType','MagazineType','MaxAmmo','HitChance','AimingPerkHitChanceModifier','AimingTime',
  'RecoilDelay','ReloadTime','SoundRadius','ProjectileCount','PiercingBullets','FireMode','FireModePossibilities',
  'JamGunChance','ModelWeaponPart','WeaponSprite','AttachmentType',
  // weapon parts
  'PartType','MountOn','HitChanceModifier','MaxRangeModifier','MinRangeModifier','RecoilDelayModifier',
  'AimingTimeModifier','ReloadTimeModifier','AngleModifier','WeightModifier','DamageModifier','SoundModifier',
  // clothing
  'BiteDefense','ScratchDefense','BulletDefense','NeckProtectionModifier','Insulation','WindResistance',
  'WaterResistance','RunSpeedModifier','CombatSpeedModifier','StompPower','ChanceToFall','ClothingItemExtra',
  // containers
  'Capacity','WeightReduction','AttachmentsProvided','AttachmentReplacement','ReplaceInPrimaryHand',
]);

// map workshop id -> readable pack name (top-level mod folder name is more useful; we record both)
function* walk(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

// pick best version dir per mod: prefer highest 42.x, then 42, then common, then flat media
function scriptRoots(modDir) {
  let entries;
  try { entries = readdirSync(modDir, { withFileTypes: true }).filter(e => e.isDirectory()); } catch { return []; }
  const names = entries.map(e => e.name);
  const vers = names.filter(n => /^42(\.\d+)?$/.test(n))
    .sort((a, b) => (parseFloat(a.slice(3) || '0') - parseFloat(b.slice(3) || '0')));
  const roots = [];
  if (names.includes('common')) roots.push(join(modDir, 'common', 'media', 'scripts'));
  if (names.includes('media')) roots.push(join(modDir, 'media', 'scripts'));
  for (const v of vers) roots.push(join(modDir, v, 'media', 'scripts'));
  return roots;
}

function parseScript(text, source, items) {
  // strip block comments
  text = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const lines = text.split('\n');
  let depth = 0, module_ = null, item = null, itemDepth = -1;
  for (let raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('//')) { }
    const mMod = line.match(/^module\s+(\S+)/i);
    const mItem = line.match(/^item\s+(.+?)\s*\{?\s*$/i);
    if (mMod && depth === 0) module_ = mMod[1];
    else if (mItem && module_ && depth === 1 && !item) {
      item = { _id: module_ + '.' + mItem[1].replace(/\{.*/, '').trim(), _src: source };
      itemDepth = depth;
    } else if (item && depth === itemDepth + 1) {
      const kv = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+?),?\s*$/);
      if (kv && KEEP_FIELDS.has(kv[1])) item[kv[1]] = kv[2].trim();
    }
    // update depth from braces on this line
    for (const ch of line) {
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (item && depth === itemDepth) {
          if (Object.keys(item).length > 2) items.push(item);
          item = null;
        }
        if (depth === 0) module_ = null;
      }
    }
  }
}

const items = [];
const names = new Map(); // "Module.Item" -> translated display name
const packs = readdirSync(WORKSHOP, { withFileTypes: true }).filter(e => e.isDirectory());
let fileCount = 0;
for (const pack of packs) {
  const modsDir = join(WORKSHOP, pack.name, 'mods');
  let mods;
  try { mods = readdirSync(modsDir, { withFileTypes: true }).filter(e => e.isDirectory()); } catch { continue; }
  for (const mod of mods) {
    const modDir = join(modsDir, mod.name);
    for (const root of scriptRoots(modDir)) {
      for (const f of walk(root)) {
        if (!f.endsWith('.txt')) continue;
        fileCount++;
        try { parseScript(readFileSync(f, 'utf8'), mod.name, items); } catch {}
      }
    }
    // translation files: names for "generated"-style items that lack DisplayName
    for (const f of walk(modDir)) {
      if (!/Translate[\\\/]EN[\\\/]ItemName/i.test(f) || !f.endsWith('.txt')) continue;
      try {
        const txt = readFileSync(f, 'utf8');
        for (const m of txt.matchAll(/ItemName_([\w.]+?)\s*=\s*"([^"]*)"/g)) names.set(m[1], m[2]);
      } catch {}
    }
    for (const f of walk(modDir)) {
      if (!/Translate[\\\/]EN[\\\/]ItemDesc/i.test(f) || !f.endsWith('.txt')) continue;
      try {
        const txt = readFileSync(f, 'utf8');
        for (const m of txt.matchAll(/ItemDesc_([\w.]+?)\s*=\s*"([^"]*)"/g)) {
          if (!names.has('desc:' + m[1])) names.set('desc:' + m[1], m[2]);
        }
      } catch {}
    }
  }
}

// merge blocks with the same _id: B42 mods split one item across files (stats in one, Type in another)
const byId = new Map();
for (const it of items) {
  const prev = byId.get(it._id);
  if (prev) Object.assign(prev, it);
  else byId.set(it._id, it);
}

// classify: use Type/ItemType when present, otherwise infer from stats
function kindOf(it) {
  const t = (it.Type || (it.ItemType || '').replace(/^base:/, '')).toLowerCase();
  if (t === 'weaponpart' || it.PartType || it.MountOn) return 'WeaponPart';
  if (t === 'container' || it.Capacity) return 'Container';
  const gun = it.AmmoType || it.HitChance || it.RecoilDelay || it.MagazineType || it.AimingPerkHitChanceModifier;
  const melee = it.MaxDamage && (it.SwingTime || it.MinimumSwingTime || it.BaseSpeed || it.TreeDamage || it.Categories || it.TwoHandWeapon);
  if (t === 'weapon' || gun || melee) return gun ? 'Gun' : 'Melee';
  if (t === 'clothing' || (it.BodyLocation && (it.BiteDefense || it.ScratchDefense || it.BulletDefense || it.Insulation))) return 'Clothing';
  return null;
}
const all = [];
for (const it of byId.values()) {
  const k = kindOf(it);
  if (!k) continue;
  if (!it.DisplayName) it.DisplayName = names.get(it._id) || it._id.split('.').pop().replace(/_/g, ' ');
  const desc = names.get('desc:' + it._id);
  if (desc) it._desc = desc;
  if (it.Tooltip && !it._desc) it._desc = it.Tooltip.replace(/^"|"$/g, '');
  it._kind = k;
  all.push(it);
}
const counts = {};
for (const it of all) counts[it._kind] = (counts[it._kind] || 0) + 1;
console.log(`Parsed ${fileCount} files -> ${all.length} classified items:`, counts);
const mods = [...new Set(all.map(i => i._src))].sort();
writeFileSync(OUT, 'const GUIDE_DATA = ' + JSON.stringify({ generated: new Date().toISOString(), mods, items: all }) + ';\n');
console.log('Wrote ' + OUT);

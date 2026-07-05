// Resolves item Icon fields → copies PNGs to assets/icons/, writes icons.js
// Usage: node tools/parse_icons.mjs
import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PROJECT = join(ROOT, '..');
const WORKSHOP = 'D:/SteamLibrary/steamapps/workshop/content/108600';
const GAME = 'D:/SteamLibrary/steamapps/common/ProjectZomboid/media';
const OUT_JS = join(PROJECT, 'icons.js');
const OUT_DIR = join(PROJECT, 'assets', 'icons');
const SITE = JSON.parse(readFileSync(join(PROJECT, 'site.config.json'), 'utf8'));

function loadJsonExport(path, key) {
  const t = readFileSync(path, 'utf8');
  return JSON.parse(t.replace(new RegExp(`^const ${key}\\s*=\\s*`), '').replace(/;\s*$/, ''));
}

function* walk(dir, depth = 0) {
  if (depth > 12) return;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p, depth + 1);
    else yield p;
  }
}

function modRoots(modDir) {
  let entries;
  try { entries = readdirSync(modDir, { withFileTypes: true }).filter(e => e.isDirectory()); } catch { return [modDir]; }
  const names = entries.map(e => e.name);
  const roots = [modDir];
  if (names.includes('common')) roots.push(join(modDir, 'common'));
  if (names.includes('media')) roots.push(join(modDir, 'media'));
  for (const v of names.filter(n => /^42(\.\d+)?$/.test(n))) roots.push(join(modDir, v));
  return roots;
}

function scriptDirs(modDir) {
  const dirs = [];
  for (const r of modRoots(modDir)) {
    const s = join(r, 'media', 'scripts');
    if (dirs.every(d => d !== s)) dirs.push(s);
    const s2 = join(r, 'scripts');
    if (dirs.every(d => d !== s2)) dirs.push(s2);
  }
  return dirs;
}

// basename aliases → { path, priority }
const texIndex = new Map();

function addKey(key, path, priority) {
  if (!key) return;
  const k = key.toLowerCase();
  const prev = texIndex.get(k);
  if (!prev || priority >= prev.priority) texIndex.set(k, { path, priority });
}

function registerPng(file, priority) {
  const base = basename(file, '.png');
  const stripped = base.replace(/^item_/i, '');
  addKey(base, file, priority);
  addKey(stripped, file, priority);
  addKey(stripped.replace(/Icon$/i, ''), file, priority);
  addKey(stripped.replace(/_ground$/i, ''), file, priority);
  addKey(base.replace(/_/g, ''), file, priority);
  addKey(stripped.replace(/_/g, ''), file, priority);
  if (/icon$/i.test(base)) addKey(stripped.replace(/icon$/i, ''), file, priority);
}

function indexTree(root, priority) {
  for (const f of walk(root)) {
    if (!/\.png$/i.test(f)) continue;
    registerPng(f, priority);
  }
}

console.log('Indexing vanilla textures…');
indexTree(GAME, 0);
console.log('Indexing workshop textures…');
let modPack = 1;
const moduleRoots = new Map(); // module name → mod directory (for local fallback search)

for (const pack of readdirSync(WORKSHOP, { withFileTypes: true }).filter(e => e.isDirectory())) {
  const modsDir = join(WORKSHOP, pack.name, 'mods');
  let mods;
  try { mods = readdirSync(modsDir, { withFileTypes: true }).filter(e => e.isDirectory()); } catch { continue; }
  for (const mod of mods) {
    const modDir = join(modsDir, mod.name);
    for (const r of modRoots(modDir)) indexTree(r, modPack);
    modPack++;
  }
}
console.log('Texture keys indexed:', texIndex.size);

const iconNames = new Map();
const clothingItemRef = new Map(); // item id → ClothingItem script name
const clothingTex = new Map(); // ClothingItem name → png path

function cleanIcon(raw) {
  return (raw || '').replace(/^"|"$/g, '').replace(/^item_/i, '').trim();
}

function resolveTextureChoice(choice, searchRoots) {
  const token = choice.replace(/\\/g, '/').split('/').pop().toLowerCase();
  for (const root of searchRoots) {
    for (const f of walk(root)) {
      if (!/\.png$/i.test(f)) continue;
      const b = basename(f, '.png').toLowerCase();
      if (b === token || b === 'item_' + token || b.includes(token) || token.includes(b.replace(/^item_/, ''))) return f;
    }
  }
  return null;
}

function indexClothingXml(modDir) {
  const roots = modRoots(modDir);
  for (const r of roots) {
    for (const clothDir of [join(r, 'media', 'clothing', 'clothingItems'), join(r, 'clothing', 'clothingItems')]) {
      for (const f of walk(clothDir)) {
        if (!f.endsWith('.xml')) continue;
        const name = basename(f, '.xml');
        const text = readFileSync(f, 'utf8');
        const choices = [...text.matchAll(/<textureChoices>([^<]+)<\/textureChoices>/gi)].map(m => m[1].trim());
        if (!choices.length) continue;
        const png = resolveTextureChoice(choices[0], roots);
        if (png) clothingTex.set(name, png);
      }
    }
  }
}

console.log('Indexing clothing textures…');
for (const f of walk(join(GAME, 'clothing', 'clothingItems'))) {
  if (!f.endsWith('.xml')) continue;
  const name = basename(f, '.xml');
  const text = readFileSync(f, 'utf8');
  const choices = [...text.matchAll(/<textureChoices>([^<]+)<\/textureChoices>/gi)].map(m => m[1].trim());
  if (!choices.length) continue;
  const png = resolveTextureChoice(choices[0], [GAME, join(GAME, '..')]);
  if (png) clothingTex.set(name, png);
}
for (const pack of readdirSync(WORKSHOP, { withFileTypes: true }).filter(e => e.isDirectory())) {
  const modsDir = join(WORKSHOP, pack.name, 'mods');
  let mods;
  try { mods = readdirSync(modsDir, { withFileTypes: true }).filter(e => e.isDirectory()); } catch { continue; }
  for (const mod of mods) indexClothingXml(join(modsDir, mod.name));
}
console.log('ClothingItem textures mapped:', clothingTex.size);

function parseIconFromScript(text, modDir) {
  text = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const lines = text.split('\n');
  let depth = 0, module_ = null, item = null, itemDepth = -1, icon = null, clothing = null;
  for (const raw of lines) {
    const line = raw.trim();
    const mMod = line.match(/^module\s+(\S+)/i);
    const mItem = line.match(/^item\s+(.+?)\s*\{?\s*$/i);
    if (mMod && depth === 0) {
      module_ = mMod[1];
      if (modDir && !moduleRoots.has(module_)) moduleRoots.set(module_, modDir);
    } else if (mItem && module_ && depth === 1 && !item) {
      item = module_ + '.' + mItem[1].replace(/\{.*/, '').trim();
      icon = null;
      clothing = null;
      itemDepth = depth;
    } else if (item) {
      const kvIcon = line.match(/^Icon\s*=\s*(.+?),?\s*$/i);
      if (kvIcon && !icon) icon = kvIcon[1].trim();
      const kvCloth = line.match(/^ClothingItem\s*=\s*(.+?),?\s*$/i);
      if (kvCloth && !clothing) clothing = kvCloth[1].trim().replace(/^[\w]+:/, '');
    }
    for (const ch of line) {
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (item && depth === itemDepth) {
          if (icon) iconNames.set(item, cleanIcon(icon));
          if (clothing) clothingItemRef.set(item, clothing);
          item = null;
        }
        if (depth === 0) module_ = null;
      }
    }
  }
}

function parseScriptsIn(dir, modDir) {
  for (const f of walk(dir)) {
    if (!f.endsWith('.txt')) continue;
    try { parseIconFromScript(readFileSync(f, 'utf8'), modDir); } catch {}
  }
}

parseScriptsIn(join(GAME, 'scripts'), null);
for (const pack of readdirSync(WORKSHOP, { withFileTypes: true }).filter(e => e.isDirectory())) {
  const modsDir = join(WORKSHOP, pack.name, 'mods');
  let mods;
  try { mods = readdirSync(modsDir, { withFileTypes: true }).filter(e => e.isDirectory()); } catch { continue; }
  for (const mod of mods) {
    const modDir = join(modsDir, mod.name);
    for (const sd of scriptDirs(modDir)) parseScriptsIn(sd, modDir);
  }
}

const data = loadJsonExport(join(PROJECT, 'data.js'), 'GUIDE_DATA');
const qol = loadJsonExport(join(PROJECT, 'qol.js'), 'GUIDE_QOL');

for (const it of data.items) {
  if (it.Icon && !iconNames.has(it._id)) iconNames.set(it._id, cleanIcon(it.Icon));
}
for (const it of qol.items) {
  if (it.Icon && !iconNames.has(it._id)) iconNames.set(it._id, cleanIcon(it.Icon));
}

console.log('Items with Icon field:', iconNames.size);

const allIds = new Set([...data.items.map(i => i._id), ...qol.items.map(i => i._id)]);

function slug(id) {
  return String(id).replace(/\./g, '--').replace(/[^\w-]/g, '_');
}

function lookupKey(key) {
  if (!key) return null;
  const k = key.toLowerCase();
  return texIndex.get(k) || texIndex.get(k.replace(/_/g, '')) || texIndex.get('item_' + k);
}

function resolveIcon(iconName, id) {
  const cloth = clothingItemRef.get(id);
  if (cloth && clothingTex.has(cloth)) return clothingTex.get(cloth);

  const short = id.split('.').pop();
  const module = id.split('.')[0];
  const candidates = [];
  if (iconName) {
    const c = cleanIcon(iconName);
    candidates.push(c, c + 'Icon', 'item_' + c, c.replace(/Icon$/i, ''));
  }
  candidates.push(short, short.replace(/_/g, ''), 'item_' + short);

  const seen = new Set();
  for (const raw of candidates) {
    const k = raw.toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    const hit = lookupKey(k);
    if (hit) return hit.path;
  }

  // ClothingItem name sometimes matches item short name pattern (LaserTag_Chest_Harness)
  if (cloth && clothingTex.has(cloth)) return clothingTex.get(cloth);

  // Match mod clothing png by tokens from item id (Tenchi_Jacket → jacket_tenchi)
  const modDir = moduleRoots.get(module);
  if (modDir) {
    const tokens = short.split('_').filter(t => t.length > 2).map(t => t.toLowerCase());
    let best = null, bestScore = 0;
    for (const r of modRoots(modDir)) {
      for (const f of walk(r)) {
        if (!/\.png$/i.test(f)) continue;
        const b = basename(f, '.png').toLowerCase();
        if (b.includes('mask') || b.includes('blood')) continue;
        let score = 0;
        for (const t of tokens) if (b.includes(t)) score++;
        if (score > bestScore) { bestScore = score; best = f; }
      }
    }
    if (bestScore >= Math.min(2, tokens.length)) return best;
  }
  return null;
}

mkdirSync(OUT_DIR, { recursive: true });
const icons = {};
const slugs = {};
let copied = 0, missing = 0;
const missingSample = [];

for (const id of allIds) {
  const src = resolveIcon(iconNames.get(id), id);
  slugs[slug(id)] = id;
  if (!src) {
    missing++;
    if (missingSample.length < 15) missingSample.push(id);
    continue;
  }
  const destName = slug(id) + '.png';
  try {
    copyFileSync(src, join(OUT_DIR, destName));
    icons[id] = `assets/icons/${destName}`;
    copied++;
  } catch {
    missing++;
    if (missingSample.length < 15) missingSample.push(id);
  }
}

writeFileSync(OUT_JS, 'const GUIDE_ICONS = ' + JSON.stringify({
  base: '',
  siteUrl: SITE.siteUrl,
  icons,
  slugs,
  stats: { total: allIds.size, copied, missing },
}) + ';\n');

console.log(`Icons: ${copied} copied, ${missing} missing (of ${allIds.size} ids)`);
if (missingSample.length) console.log('Sample still missing:', missingSample.join(', '));
console.log('Wrote', OUT_JS);

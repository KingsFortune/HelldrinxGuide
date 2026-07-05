// Static share pages for Discord / social crawlers (GitHub Pages)
// Usage: node tools/generate_share_pages.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PROJECT = join(ROOT, '..');
const SITE = JSON.parse(readFileSync(join(PROJECT, 'site.config.json'), 'utf8'));

function loadExport(path, key) {
  const t = readFileSync(path, 'utf8');
  return JSON.parse(t.replace(new RegExp(`^const ${key}\\s*=\\s*`), '').replace(/;\s*$/, ''));
}

const data = loadExport(join(PROJECT, 'data.js'), 'GUIDE_DATA');
const qol = loadExport(join(PROJECT, 'qol.js'), 'GUIDE_QOL');
const vehicles = loadExport(join(PROJECT, 'vehicles.js'), 'GUIDE_VEH');
let icons = { icons: {}, slugs: {} };
try {
  icons = loadExport(join(PROJECT, 'icons.js'), 'GUIDE_ICONS');
} catch {
  console.warn('icons.js missing — run parse_icons.mjs first for OG images');
}

const siteUrl = SITE.siteUrl.replace(/\/$/, '');
const siteName = SITE.siteName;

function slug(id) {
  return String(id).replace(/\./g, '--').replace(/[^\w-]/g, '_');
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function ogPage({ path, title, description, image, redirectHash }) {
  const url = `${siteUrl}/${path}/`;
  const img = image ? (image.startsWith('http') ? image : `${siteUrl}/${image.replace(/^\//, '')}`) : `${siteUrl}/assets/og-default.svg`;
  const appRoot = '../../index.html';
  const target = `${appRoot}${redirectHash}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(title)} — ${esc(siteName)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(siteName)}">
<meta property="og:title" content="${esc(title)} — ${esc(siteName)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(img)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(img)}">
<link rel="canonical" href="${esc(url)}">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
<script>location.replace(${JSON.stringify(target)});</script>
</head>
<body><p><a href="${esc(target)}">${esc(title)}</a></p></body>
</html>`;
}

function writePage(dir, html) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
}

function itemDesc(it) {
  const parts = [];
  if (it._kind === 'Melee' || it._kind === 'Gun') {
    if (it.MinDamage && it.MaxDamage) parts.push(`${it.MinDamage}–${it.MaxDamage} dmg`);
    if (it.CriticalChance) parts.push(`${it.CriticalChance}% crit`);
  }
  if (it._kind === 'Clothing') {
    if (it.BiteDefense) parts.push(`${it.BiteDefense} bite`);
    if (it.BodyLocation) parts.push(it.BodyLocation.replace(/^[\w]+:/, ''));
  }
  if (it._kind === 'Container' && it.Capacity) parts.push(`${it.Capacity} cap`);
  parts.push(it._src);
  return parts.join(' · ').slice(0, 200);
}

let count = 0;
const seen = new Set();

for (const it of data.items) {
  if (seen.has(it._id)) continue;
  seen.add(it._id);
  const s = slug(it._id);
  const icon = icons.icons[it._id];
  writePage(join(PROJECT, 'i', s), ogPage({
    path: `i/${s}`,
    title: it.DisplayName,
    description: itemDesc(it),
    image: icon,
    redirectHash: `#wiki/item/${encodeURIComponent(it._id)}`,
  }));
  count++;
}

for (const q of qol.items) {
  if (seen.has(q._id)) continue;
  seen.add(q._id);
  const s = slug(q._id);
  writePage(join(PROJECT, 'i', s), ogPage({
    path: `i/${s}`,
    title: q.DisplayName,
    description: (q._cat || 'utility') + ' · ' + q._src,
    image: icons.icons[q._id],
    redirectHash: `#wiki/item/${encodeURIComponent(q._id)}`,
  }));
  count++;
}

for (const v of vehicles.vehicles) {
  if (/burnt|wreck|smashed|junkyard|destroyed/i.test(v.name + ' ' + v.display)) continue;
  const s = slug(v.name);
  writePage(join(PROJECT, 'v', s), ogPage({
    path: `v/${s}`,
    title: v.display || v.name,
    description: `Top ${v.maxSpeed || '?'} · ${v.seats || '?'} seats · ${v.mod}`,
    image: null,
    redirectHash: `#wiki/vehicle/${encodeURIComponent(v.name)}`,
  }));
  count++;
}

// Root OG landing
writePage(join(PROJECT, 'share'), ogPage({
  path: 'share',
  title: siteName,
  description: SITE.description || siteName,
  image: 'assets/og-default.svg',
  redirectHash: '#',
}));

console.log(`Generated ${count} share pages under i/ v/`);
console.log('Set siteUrl in site.config.json before deploying:', siteUrl);

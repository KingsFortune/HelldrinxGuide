// Extracts ECHO quests, NPC positions, claimable outposts, and Discord chest shop into economy.js
// Usage: node parse_economy.mjs   (chests_raw.json must exist; refresh via:
//   Invoke-WebRequest http://158.69.127.148:3001/data/chests.json -OutFile chests_raw.json)
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const WORKSHOP = 'D:/SteamLibrary/steamapps/workshop/content/108600';
const QDATA = join(WORKSHOP, '3736714212/mods/HellDrinxQuests/42/media/data/default');
const OUTPOSTS_LUA = join(WORKSHOP, '3701561853/mods/HDX_claimableoutposts/42/media/lua/shared/ClaimableOutposts_Config.lua');
const OUT = join(ROOT, '..', 'economy.js');

// ---- NPC positions from characters/*_pos.txt ----
const npcs = {};
for (const f of readdirSync(join(QDATA, 'characters'))) {
  if (!f.endsWith('_pos.txt')) continue;
  const txt = readFileSync(join(QDATA, 'characters', f), 'utf8');
  const name = basename(f, '_pos.txt');
  const spots = [...txt.matchAll(/#npc_create\s+([^|]+)\|[^|]*\|[^|]*\|(\d+),(\d+),(-?\d+)/g)]
    .map(m => ({ npc: m[1].trim(), x: +m[2], y: +m[3], z: +m[4] }));
  if (spots.length) npcs[name] = spots;
}

// ---- quests ----
const quests = [];
for (const f of readdirSync(join(QDATA, 'quests'))) {
  if (!f.endsWith('.txt') || f === 'questlog.txt') continue;
  const txt = readFileSync(join(QDATA, 'quests', f), 'utf8');
  let cur = null;
  for (const raw of txt.split('\n')) {
    const line = raw.trim();
    const q = line.match(/^#quest\s+(\S+)/);
    if (q) { cur = { id: q[1], file: f.replace('.txt', ''), objectives: [], rewards: [], exp: [], hc: 0 }; quests.push(cur); continue; }
    if (!cur) continue;
    const set = line.match(/^#set\s+(GotoLocation|FindItem|Deliver|KillZombies|KillZombie|TalkTo|Interact|EquipItem|ReadItem)\|(.+)/);
    if (set) cur.objectives.push(set[1] + ': ' + set[2].replace(/\|true|\|false/g, '').trim());
    const rew = line.match(/^#action Reward\|(.+)/);
    if (rew) {
      for (const part of rew[1].split('|')) {
        const bits = part.split(',');
        if (bits[0] === 'EXP') cur.exp.push(bits[1] + ' +' + bits[2]);
        else if (/points|coin|voucher/i.test(bits[0]) || bits[0] === 'HC') cur.hc += (+bits[1] || 0);
        else cur.rewards.push({ item: bits[0], count: +bits[1] || 1, rarity: bits[2] || '' });
      }
    }
    const pts = line.match(/^#action (?:AddPoints|GivePoints|Points)\|(\d+)/i);
    if (pts) cur.hc += +pts[1];
  }
}

// ---- journal display names (flag -> completed text) ----
const journal = {};
try {
  const txt = readFileSync(join(QDATA, 'questlog.txt'), 'utf8');
  for (const m of txt.matchAll(/#line\s+([\w]+)\|(.+)/g)) journal[m[1]] = m[2].trim();
} catch {}
for (const q of quests) q.journal = journal[q.id + '_completed'] || null;

// ---- outposts ----
const outposts = [];
{
  const lua = readFileSync(OUTPOSTS_LUA, 'utf8');
  // split on `id = "..."` entries
  const parts = lua.split(/(?=id\s*=\s*")/).slice(1);
  for (const p of parts) {
    const g = re => (p.match(re) || [])[1];
    const id = g(/id\s*=\s*"([^"]+)"/), name = g(/name\s*=\s*"([^"]+)"/);
    if (!id || !name) continue;
    const rewardsBlock = (p.match(/rewards\s*=\s*\{([\s\S]*?)\n\s*\}/) || [])[1] || '';
    const counts = {};
    for (const m of rewardsBlock.matchAll(/"([\w.]+)"/g)) counts[m[1]] = (counts[m[1]] || 0) + 1;
    outposts.push({
      id, name, type: g(/type\s*=\s*"([^"]+)"/),
      x: +g(/x\s*=\s*(\d+)/), y: +g(/y\s*=\s*(\d+)/),
      intervalDays: +g(/rewardIntervalDays\s*=\s*(\d+)/) || null,
      rewardCount: +g(/rewardCount\s*=\s*(\d+)/) || null,
      rewards: Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ item: k.replace(/^Base\./, ''), w: v })),
    });
  }
}

// ---- chests (Discord shop) ----
let chests = [];
try {
  const j = JSON.parse(readFileSync(join(ROOT, '..', 'chests_raw.json'), 'utf8').replace(/^﻿/, ''));
  chests = j.map(c => ({
    name: c.name.trim(), buy: c.buyPrice, perOpen: c.itemsPerOpen, icon: c.iconURL || '',
    groups: (c.groups || []).map(g => ({ name: g.name, chance: g.chance })),
    items: c.items.map(i => ({ n: i.name.trim(), t: i.type || '', ic: i.iconURL || '' })),
  }));
} catch (e) { console.log('chests skipped:', e.message); }

console.log(`npcs: ${Object.keys(npcs).length}, quests: ${quests.length}, outposts: ${outposts.length}, chests: ${chests.length}`);
writeFileSync(OUT, 'const GUIDE_ECON = ' + JSON.stringify({ fetched: new Date().toISOString(), npcs, quests, outposts, chests }) + ';\n');
console.log('Wrote ' + OUT);

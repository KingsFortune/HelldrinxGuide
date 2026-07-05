import { readFileSync } from 'fs';
const j = JSON.parse(readFileSync('C:/Users/micah/Documents/HellDrinxGuide/chests_raw.json', 'utf8').replace(/^﻿/, ''));
for (const c of j) {
  console.log('==', c.name, '| buy', c.buyPrice, '| sell', c.sellPrice, '| perOpen', c.itemsPerOpen, '| items', c.items.length);
  console.log('   groups:', (c.groups || []).map(g => g.name + ' ' + g.chance + '%').join(', '));
  const types = {};
  c.items.forEach(i => { const t = i.type || '(blank)'; types[t] = (types[t] || 0) + 1; });
  console.log('   types:', Object.entries(types).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '));
}
console.log('item keys:', Object.keys(j[0].items[0]).join(','));
console.log('chest keys:', Object.keys(j[0]).join(','));

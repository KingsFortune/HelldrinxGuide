import { readFileSync } from 'fs';
const t = readFileSync('C:/Users/micah/Documents/HellDrinxGuide/data.js', 'utf8');
const D = JSON.parse(t.slice(t.indexOf('=') + 1).replace(/;\s*$/, ''));
const n = x => parseFloat(x) || 0;
const I = D.items;
console.log('mods contributing:', D.mods.length);
for (const m of ['GunsOfMarz', 'WILDSTEEL', '(B42)KenshiBlacksmithing', 'zReArmorPack', 'MWPWeapons42', 'LegendaryKatanaWakizashi', 'HellDrinxShop'])
  console.log(' ', m, D.mods.includes(m) ? 'OK' : 'MISSING');

const row = (i, extra) => `${i.DisplayName} | ${extra} | ${i._src}`;
console.log('\n== TOP 12 MELEE by MaxDamage ==');
I.filter(i => i._kind === 'Melee').sort((a, b) => n(b.MaxDamage) - n(a.MaxDamage)).slice(0, 12)
  .forEach(i => console.log(row(i, `dmg ${i.MinDamage}-${i.MaxDamage} crit ${i.CriticalChance || '?'} critX ${i.CritDmgMultiplier || '?'} cond ${i.ConditionMax || '?'}/1in${i.ConditionLowerChanceOneIn || '?'}`)));
console.log('\n== TOP 10 GUNS by MaxDamage ==');
I.filter(i => i._kind === 'Gun').sort((a, b) => n(b.MaxDamage) - n(a.MaxDamage)).slice(0, 10)
  .forEach(i => console.log(row(i, `dmg ${i.MinDamage}-${i.MaxDamage} ammo ${i.AmmoType || '?'} mag ${i.MaxAmmo || '?'} range ${i.MaxRange || '?'}`)));
console.log('\n== TOP 12 ARMOR by BiteDefense ==');
I.filter(i => i._kind === 'Clothing').sort((a, b) => n(b.BiteDefense) - n(a.BiteDefense)).slice(0, 12)
  .forEach(i => console.log(row(i, `bite ${i.BiteDefense} scr ${i.ScratchDefense || 0} blt ${i.BulletDefense || 0} loc ${i.BodyLocation} spd ${i.RunSpeedModifier || '1'}`)));
console.log('\n== TOP 10 CONTAINERS by Capacity ==');
I.filter(i => i._kind === 'Container' && (i.BodyLocation || i.CanBeEquipped)).sort((a, b) => n(b.Capacity) - n(a.Capacity)).slice(0, 10)
  .forEach(i => console.log(row(i, `cap ${i.Capacity} wr ${i.WeightReduction || 0} loc ${i.BodyLocation || i.CanBeEquipped}`)));
console.log('\n== SLOT EXPANDERS (AttachmentsProvided) ==');
const se = I.filter(i => i.AttachmentsProvided);
console.log('count:', se.length);
se.sort((a, b) => (b.AttachmentsProvided.split(';').length) - (a.AttachmentsProvided.split(';').length)).slice(0, 12)
  .forEach(i => console.log(row(i, i.AttachmentsProvided)));
console.log('\n== BodyLocations in use (clothing+containers) ==');
const locs = {};
for (const i of I) if (i.BodyLocation) locs[i.BodyLocation] = (locs[i.BodyLocation] || 0) + 1;
console.log(Object.entries(locs).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '));

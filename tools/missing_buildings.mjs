import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({ console, window: {} });

function load(name) {
  let src = readFileSync(join(root, name), 'utf8');
  src = src.replace(/^const (GUIDE_\w+)/gm, 'var $1');
  vm.runInContext(src, ctx, { filename: name });
}

load('pool_locs.js');
load('building_guide.js');

const rooms = new Set();
for (const p of Object.values(ctx.GUIDE_POOL_LOCS.pools)) {
  for (const l of p.locs || []) rooms.add(l.room);
}
const missing = [...rooms].filter(r => r !== 'all' && !ctx.GUIDE_BUILDINGS[r]).sort();
console.log('rooms', rooms.size, 'missing guides', missing.length);
console.log(missing.slice(0, 80).join('\n'));

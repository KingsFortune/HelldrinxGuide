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
load('mod_inserts.js');
load('details.js');
load('spawn_resolve.js');

const id = process.argv[2] || 'Base.IronBarMold';
const guide = ctx.window.SPAWN_RESOLVE.buildItemGuide(id);
console.log('quickAnswer:', guide.quickAnswer);
console.log(JSON.stringify({
  id: guide.id,
  total: guide.total,
  pins: guide.pins.length,
  lines: guide.lines.map(l => ({
    title: l.title,
    detail: l.detail?.slice(0, 120),
    rooms: l.structured?.rooms?.map(r => ({ label: r.label, hasGuide: !!r.guide })),
    vehicle: l.structured?.vehicle,
  })),
}, null, 2));

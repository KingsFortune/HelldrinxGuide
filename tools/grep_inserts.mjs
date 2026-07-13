import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'mod_inserts.js'), 'utf8').replace('const GUIDE_MOD_INSERTS', 'export const GUIDE_MOD_INSERTS');
const { GUIDE_MOD_INSERTS } = await import(`data:text/javascript,${encodeURIComponent(src)}`);

const q = process.argv[2] || 'M60';
const hits = GUIDE_MOD_INSERTS.inserts.filter(i => new RegExp(q, 'i').test(i.modItem + i.base));
console.log('inserts', hits.length);
hits.forEach(h => console.log(h.modItem, '<-', h.base, h.chance));
const sp = GUIDE_MOD_INSERTS.spawners.filter(s => new RegExp(q, 'i').test(s.modItem + s.base));
console.log('spawners', sp.length);
sp.forEach(s => console.log(s.modItem, '<-', s.base));

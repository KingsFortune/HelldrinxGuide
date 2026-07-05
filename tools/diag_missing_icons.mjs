import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const t = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'icons.js'), 'utf8');
const ICONS = JSON.parse(t.replace(/^const GUIDE_ICONS\s*=\s*/, '').replace(/;\s*$/, ''));
const missing = Object.keys(ICONS.slugs).filter(id => !ICONS.icons[id]);
console.log('stats', ICONS.stats);
console.log('missing', missing.length);
console.log('sample', missing.slice(0, 20));

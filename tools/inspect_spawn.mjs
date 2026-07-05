import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const det = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'details.js'), 'utf8');
const key = process.argv[2] || 'IronBarMold';
const m = det.match(new RegExp('"' + key + '":(\\[[\\s\\S]*?\\]),"'));
if (m) {
  const arr = JSON.parse(m[1]);
  console.log(key, 'spawns:', arr.length);
  arr.forEach(s => console.log(' ', s.where, 'w' + s.weight, s.mod));
} else console.log(key, 'NOT IN SPAWNS');

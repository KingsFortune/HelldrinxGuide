#!/usr/bin/env node
// Full wiki asset build — run before GitHub Pages deploy
import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const steps = ['parse_icons.mjs', 'generate_share_pages.mjs'];

for (const s of steps) {
  console.log('\n==> node tools/' + s);
  const r = spawnSync(process.execPath, [join(ROOT, 'tools', s)], { stdio: 'inherit', cwd: ROOT });
  if (r.status !== 0) process.exit(r.status || 1);
}
console.log('\nWiki build complete. Deploy index.html + assets/ + i/ + v/ to GitHub Pages.');

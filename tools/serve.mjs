import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
createServer((req, res) => {
  const p = join(root, req.url === '/' ? 'index.html' : req.url.slice(1));
  try {
    const body = readFileSync(p);
    res.writeHead(200, { 'Content-Type': types[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nope'); }
}).listen(process.env.PORT || 8642, () => console.log('guide on http://localhost:' + (process.env.PORT || 8642)));

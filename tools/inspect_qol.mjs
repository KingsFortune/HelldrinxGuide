import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const q = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'qol.js'), 'utf8').replace(/^const GUIDE_QOL\s*=\s*/, '').replace(/;\s*$/, ''));
const ids = process.argv[2] ? [process.argv[2]] : ['Base.IronBarMold','Base.SutureNeedle','Base.BlowTorch','Base.Jack','Base.MedicalClinicTools'];
for (const id of ids) {
  const m = q.items.find(i => i._id === id);
  console.log(id, 'where:', m?._where?.length || 0);
  if (m?._where?.length) m._where.forEach(w => console.log(' ', w.slice(0, 120)));
}

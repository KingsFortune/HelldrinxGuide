// Locate a room's tile rects inside a PZ .lotheader file
// Usage: node findroom.mjs <lotheader> <roomName>
import { readFileSync } from 'fs';
const [file, room] = process.argv.slice(2);
const buf = readFileSync(file);
const cell = file.match(/(\d+)_(\d+)\.lotheader/);
const baseX = +cell[1] * 300, baseY = +cell[2] * 300;
console.log('file:', file, '| cell world origin:', baseX, baseY);
const needle = Buffer.from(room, 'latin1');
let pos = buf.indexOf(needle);
if (pos < 0) { console.log('room string not found'); process.exit(1); }
while (pos >= 0) {
  // room record: name (\n-terminated), int32 level, int32 rectCount, rects: 4x int32 (x,y,w,h)
  let p = pos + needle.length;
  // skip to after newline terminator if present
  if (buf[p] === 0x0a) p++;
  const level = buf.readInt32LE(p); p += 4;
  const rectCount = buf.readInt32LE(p); p += 4;
  if (rectCount > 0 && rectCount < 50 && level >= -5 && level < 40) {
    console.log(`match @${pos}: level=${level}, rects=${rectCount}`);
    for (let i = 0; i < rectCount; i++) {
      const x = buf.readInt32LE(p); p += 4;
      const y = buf.readInt32LE(p); p += 4;
      const w = buf.readInt32LE(p); p += 4;
      const h = buf.readInt32LE(p); p += 4;
      console.log(`  rect: local(${x},${y} ${w}x${h}) -> WORLD x ${baseX + x}-${baseX + x + w - 1}, y ${baseY + y}-${baseY + y + h - 1}, floor ${level}`);
    }
  } else {
    console.log(`match @${pos}: implausible header (level=${level}, rects=${rectCount}) — trying next`);
  }
  pos = buf.indexOf(needle, pos + 1);
}

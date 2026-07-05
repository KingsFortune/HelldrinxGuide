// Maps procedural loot pool names → exact building types + containers (from vanilla Distributions.lua)
// Usage: node parse_pool_locs.mjs
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const GAME = 'D:/SteamLibrary/steamapps/common/ProjectZomboid/media/lua/server/Items/Distributions.lua';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'pool_locs.js');

const ROOM_LABELS = {
  blacksmith: 'Blacksmith shop',
  metalfabrication: 'Metal fabrication workshop',
  metalfabricationstorage: 'Metal fabrication storage',
  metalshop: 'Factory metal shop',
  toolstore: 'Hardware / tool store',
  toolstorestorage: 'Tool store back room',
  garage: 'Residential garage',
  garagestorage: 'Garage storage / storage locker facility',
  storageunit: 'Rented storage unit (U-Store It)',
  mechanic: 'Auto mechanic shop',
  gasstore: 'Gas station shop',
  warehouse: 'Warehouse',
  loggingfactory: 'Logging factory',
  factory: 'Factory floor',
  pharmacy: 'Pharmacy',
  medical: 'Medical clinic',
  medicalstorage: 'Hospital storage',
  gunstore: 'Gun store',
  gunstorestorage: 'Gun store storage room',
  armyhangar: 'Army hangar',
  armysurplus: 'Army surplus store',
  policestorage: 'Police evidence / storage',
  construction: 'Construction site office',
  janitor: 'Janitor closet (schools, offices)',
  shed: 'Garden shed',
  gardenstore: 'Garden supply store',
  farmingstore: 'Farming supply store',
  zippeestore: 'Zippee market back room',
  kitchen: 'Restaurant / commercial kitchen',
  restaurantkitchen: 'Restaurant kitchen',
  spiffokitchen: 'Spiffo\'s kitchen',
  motelroom: 'Motel room',
  hotelroom: 'Hotel room',
  laundry: 'Laundromat',
  library: 'Library',
  classroom: 'School classroom',
  firestorage: 'Fire station storage',
  hunting: 'Hunting lodge',
  camping: 'Camping store',
  fishingstorage: 'Fishing supply storage',
  batterystorage: 'Battery factory storage',
  wirefactory: 'Wire factory',
  brewery: 'Brewery',
  dogfoodfactory: 'Dog food factory',
  radiofactory: 'Radio factory',
  cabinetfactory: 'Cabinet factory',
  fryshipping: 'Shipping warehouse',
  whiskeybottling: 'Distillery bottling',
};

const CONTAINER_LABELS = {
  metal_shelves: 'metal shelving',
  shelves: 'shelves',
  crate: 'crates',
  cardboardbox: 'cardboard boxes',
  smallbox: 'small boxes',
  toolcabinet: 'tool cabinet / rolling cabinet',
  counter: 'counter',
  locker: 'lockers',
  metalcrate: 'metal crates',
  sidetable: 'side tables',
  desk: 'desks',
  filingcabinet: 'filing cabinets',
  medicine: 'medicine cabinet',
  freezer: 'freezer',
  fridge: 'fridge',
  vending: 'vending machines',
  clothingrack: 'clothing racks',
  bin: 'floor bins',
  postbox: 'post boxes',
};

const VEHICLE_POOLS = {
  BlacksmithTruckBed: 'Blacksmith / utility truck beds (parked utility vehicles)',
  MechanicTruckBed: 'Mechanic service truck beds',
  ConstructionTruckBed: 'Construction truck beds',
  FarmerTruckBed: 'Farmer truck beds',
};

function labelRoom(r) {
  return ROOM_LABELS[r] || r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function labelContainer(c) {
  return CONTAINER_LABELS[c] || c.replace(/_/g, ' ');
}

function parseDistributions(text) {
  const pools = {};
  const lines = text.split('\n');
  let inTable = false, depth = 0, room = null, container = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (/distributionTable\s*=\s*\{/.test(line)) { inTable = true; depth = 1; room = null; container = null; continue; }
    if (!inTable) continue;
    if (depth <= 1 && /^};\s*$/.test(line)) break;

    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    const assign = line.match(/^(\w+)\s*=\s*\{/);

    if (assign) {
      const name = assign[1];
      if (depth === 1) { room = name; container = null; }
      else if (depth === 2 && room) container = name;
    }

    for (const pm of line.matchAll(/\{\s*name\s*=\s*"(\w+)"([^}]*)\}/g)) {
      const pool = pm[1], rest = pm[2];
      if (!room || !container) continue;
      const wc = (rest.match(/weightChance\s*=\s*(\d+)/) || [])[1];
      const forceRooms = (rest.match(/forceForRooms="([^"]+)"/) || [])[1];
      const forceTiles = (rest.match(/forceForTiles="([^"]+)"/) || [])[1];
      pools[pool] = pools[pool] || [];
      const entry = { room, container, weightChance: wc ? +wc : null, forceForRooms: forceRooms || null, forceForTiles: forceTiles || null };
      if (!pools[pool].some(x => x.room === room && x.container === container)) pools[pool].push(entry);
    }

    depth += opens - closes;
    if (depth <= 0) break;
  }
  return pools;
}

function buildReadable(pool, locs) {
  const lines = [];
  const byRoom = new Map();
  for (const l of locs) {
    const key = l.room;
    if (!byRoom.has(key)) byRoom.set(key, []);
    byRoom.get(key).push(l);
  }
  for (const [room, entries] of byRoom) {
    const containers = entries.map(e => {
      let s = labelContainer(e.container);
      if (e.weightChance) s += ` (${e.weightChance}% pool chance)`;
      return s;
    }).join(', ');
    let line = `<b>${labelRoom(room)}</b> — check ${containers}`;
    const force = entries.find(e => e.forceForRooms);
    if (force?.forceForRooms) {
      const rooms = force.forceForRooms.split(';').slice(0, 5).map(r => labelRoom(r) || r).join(', ');
      line += `. Also appears in: ${rooms}${force.forceForRooms.split(';').length > 5 ? '…' : ''}`;
    }
    lines.push(line);
  }
  return lines;
}

const raw = parseDistributions(readFileSync(GAME, 'utf8'));
const pools = {};
for (const [name, locs] of Object.entries(raw)) {
  pools[name] = { locs, hint: buildReadable(name, locs).join('<br>') };
}
for (const [name, hint] of Object.entries(VEHICLE_POOLS)) {
  pools[name] = { locs: [], hint, vehicle: true };
}

console.log(`Parsed ${Object.keys(pools).length} pool location maps`);
writeFileSync(OUT, 'const GUIDE_POOL_LOCS = ' + JSON.stringify({ pools }) + ';\n');
console.log('Wrote ' + OUT);

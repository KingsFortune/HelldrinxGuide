/**
 * Resolve item spawn locations — direct spawns + mod insert chains (GunsOfMarz etc.)
 * Detailed building + container info from GUIDE_POOL_LOCS (no vague category buckets).
 */
(function () {
  'use strict';

  const ROOM_LABELS = {
    all: 'Any building that uses this loot table',
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
    gunstore: 'Gun store (front of shop)',
    gunstorestorage: 'Gun store back room / storage',
    armyhangar: 'Army hangar',
    armystorage: 'Army storage building',
    armysurplus: 'Army surplus store',
    policestorage: 'Police evidence / storage',
    policegunstorage: 'Police gun storage',
    captainoffice: 'Police captain office',
    security: 'Security office',
    construction: 'Construction site office',
    janitor: 'Janitor closet (schools, offices)',
    shed: 'Garden shed',
    gardenstore: 'Garden supply store',
    farmingstore: 'Farming supply store',
    zippeestore: 'Zippee market back room',
    kitchen: 'Restaurant / commercial kitchen',
    restaurantkitchen: 'Restaurant kitchen',
    spiffokitchen: "Spiffo's kitchen",
    motelroom: 'Motel room',
    hotelroom: 'Hotel room',
    laundry: 'Laundromat',
    library: 'Library',
    classroom: 'School classroom',
    firestorage: 'Fire station storage',
    hunting: 'Hunting lodge',
    hunterstorage: 'Hunter storage shed',
    camping: 'Camping store',
    fishingstorage: 'Fishing supply storage',
    pawnshopoffice: 'Pawn shop office',
    pawnshopstorage: 'Pawn shop storage',
    policeswat: 'Police SWAT armory',
  };

  const CONTAINER_LABELS = {
    metal_shelves: 'metal shelving',
    shelves: 'shelves',
    crate: 'crates',
    cardboardbox: 'cardboard boxes',
    smallbox: 'small boxes',
    toolcabinet: 'tool cabinet',
    counter: 'shop counter',
    locker: 'lockers',
    metalcrate: 'metal crates',
    militarylocker: 'military lockers',
    militarycrate: 'military crates',
    sidetable: 'side tables',
    desk: 'desks',
    filingcabinet: 'filing cabinets',
    bin: 'floor bins',
    all: 'every container in the room',
  };

  const VEHICLE_POOLS = {
    BlacksmithTruckBed: 'Parked utility / blacksmith trucks — truck bed cargo',
    MechanicTruckBed: 'Mechanic service trucks — truck bed',
    ConstructionTruckBed: 'Construction trucks — truck bed',
    FarmerTruckBed: 'Farm trucks — truck bed',
    ArmyLightTruckBed: 'Military light trucks — truck bed',
    ArmyHeavyTruckBed: 'Military heavy trucks — truck bed',
    ArmyGloveBox: 'Military vehicles — glove box',
    PoliceTruckBed: 'Police vehicles — truck bed',
    PoliceSeatFront: 'Police vehicles — front seat',
    HunterTruckBed: 'Hunter / ranger trucks — truck bed',
    RangerTruckBed: 'Ranger trucks — truck bed',
  };

  let insertByItem = null;
  let gunsByMag = null;

  function labelContainer(c) {
    return CONTAINER_LABELS[c] || c.replace(/_/g, ' ');
  }

  function labelRoom(r) {
    return ROOM_LABELS[r] || r.replace(/_/g, ' ').replace(/\b\w/g, x => x.toUpperCase());
  }

  function spawnMeta(spot) {
    const bits = [];
    if (spot.weight != null && spot.weight !== '') bits.push(`spawn weight ${spot.weight}`);
    if (spot.rolls) bits.push(`${spot.rolls} loot rolls per container`);
    if (spot.chance != null) bits.push(`${Math.round(spot.chance * 100)}% insert chance`);
    if (spot.mod && spot.mod !== 'Vanilla') bits.push(`mod: ${spot.mod}`);
    return bits.join(' · ');
  }

  function labelRoomForPool(room, pool) {
    if (room === 'all') {
      if (/ArmyStorage/i.test(pool)) return 'Military bases (map-wide military locker pool)';
      if (/Police|SWAT/i.test(pool)) return 'Police buildings (map-wide)';
      return 'Any building tied to this loot table';
    }
    return labelRoom(room);
  }

  function poolLocsText(pool, isVehicle) {
    const pl = typeof GUIDE_POOL_LOCS !== 'undefined' && GUIDE_POOL_LOCS.pools?.[pool];
    if (!pl) return null;
    if (pl.vehicle || VEHICLE_POOLS[pool]) {
      return VEHICLE_POOLS[pool] || pl.hint?.replace(/<[^>]+>/g, '').trim() || 'Vehicle cargo area';
    }
    if (!pl.locs?.length) return pl.hint?.replace(/<[^>]+>/g, '').trim() || null;
    const byRoom = new Map();
    for (const l of pl.locs) {
      if (!byRoom.has(l.room)) byRoom.set(l.room, []);
      byRoom.get(l.room).push(l);
    }
    const parts = [];
    for (const [room, entries] of byRoom) {
      const containers = entries.map(e => {
        let c = labelContainer(e.container);
        if (e.weightChance) c += ` (${e.weightChance}% chance this container type is used)`;
        return c;
      }).join(', ');
      let line = `${labelRoomForPool(room, pool)}: check ${containers}`;
      const force = entries.find(e => e.forceForRooms);
      if (force?.forceForRooms) {
        const also = force.forceForRooms.split(';').slice(0, 4).map(labelRoom).join(', ');
        line += `. Also forced in: ${also}${force.forceForRooms.split(';').length > 4 ? '…' : ''}`;
      }
      parts.push(line);
    }
    let text = parts.join(' | ');
    if (isVehicle) text = 'Vehicle variant — ' + text;
    return text;
  }

  function buildingGuideFor(room) {
    if (typeof GUIDE_BUILDINGS !== 'undefined' && GUIDE_BUILDINGS[room]) {
      return GUIDE_BUILDINGS[room];
    }
    return fallbackBuildingGuide(room);
  }

  function fallbackBuildingGuide(room) {
    const r = String(room || '').toLowerCase();
    if (!r || r === 'all') return GUIDE_BUILDINGS?.all || null;

    for (const suf of ['storage', 'office']) {
      if (r.endsWith(suf) && r.length > suf.length + 2) {
        const stem = r.slice(0, -suf.length);
        const parent = GUIDE_BUILDINGS?.[stem];
        if (parent) {
          return {
            title: labelRoom(room),
            find: suf === 'storage'
              ? `Back room or warehouse area of ${labelRoom(stem).toLowerCase()}. ${parent.find}`
              : `Office area inside ${labelRoom(stem).toLowerCase()}. ${parent.find}`,
            identify: parent.identify,
            areas: parent.areas,
          };
        }
      }
    }

    const keywordParents = [
      [/police|swat|sheriff|captain/, 'policestorage'],
      [/gun|ammo|hunting|swat/, 'gunstore'],
      [/army|military|armyhangar/, 'armystorage'],
      [/hospital|medical|clinic|pharm|doctor|nurse|dentist/, 'medical'],
      [/mechanic|garage/, 'mechanic'],
      [/blacksmith|forge|metal/, 'blacksmith'],
      [/tool|hardware/, 'toolstore'],
      [/warehouse|factory|industrial|logging/, 'warehouse'],
      [/gas|fuel|zippee/, 'gasstore'],
      [/farm|agri/, 'farmingstore'],
      [/kitchen|restaurant|cafe|diner|bakery|burger|spiffo/, 'kitchen'],
      [/hotel|motel/, 'motelroom'],
      [/school|classroom|library/, 'classroom'],
      [/bar|pub|brew|twiggy/, 'gasstore'],
      [/pawn/, 'pawnshopoffice'],
      [/fire/, 'firestorage'],
      [/camp/, 'camping'],
      [/fishing/, 'fishingstorage'],
      [/construction/, 'construction'],
      [/shed|attic/, 'shed'],
      [/store|shop|market|gift/, 'toolstore'],
    ];
    for (const [re, key] of keywordParents) {
      if (re.test(r) && GUIDE_BUILDINGS?.[key]) {
        const p = GUIDE_BUILDINGS[key];
        return {
          title: labelRoom(room),
          find: `Map POIs tagged as "${labelRoom(room)}". ${p.find}`,
          identify: p.identify,
          areas: p.areas,
        };
      }
    }

    return {
      title: labelRoom(room),
      find: `Not a single GPS pin — the game rolls this loot in any "${labelRoom(room)}" on the map. Open map (M) and search towns for matching buildings.`,
      identify: `Loot all containers inside; this pool is tied to the "${room}" room type in worldgen.`,
      areas: 'Louisville, West Point, Muldraugh, Riverside, Rosewood, March Ridge, and matching mod-map POIs',
    };
  }

  function poolLocsStructured(pool, isVehicle) {
    const pl = typeof GUIDE_POOL_LOCS !== 'undefined' && GUIDE_POOL_LOCS.pools?.[pool];
    if (!pl) return { rooms: [], vehicle: isVehicle, text: null };
    if (pl.vehicle || VEHICLE_POOLS[pool]) {
      return { rooms: [], vehicle: true, text: VEHICLE_POOLS[pool] || pl.hint?.replace(/<[^>]+>/g, '').trim() };
    }
    if (!pl.locs?.length) {
      return { rooms: [], vehicle: false, text: pl.hint?.replace(/<[^>]+>/g, '').trim() || null };
    }
    const byRoom = new Map();
    for (const l of pl.locs) {
      if (!byRoom.has(l.room)) byRoom.set(l.room, []);
      byRoom.get(l.room).push(l);
    }
    const rooms = [];
    for (const [room, entries] of byRoom) {
      rooms.push({
        room,
        label: labelRoomForPool(room, pool),
        containers: entries.map(e => ({
          name: labelContainer(e.container),
          raw: e.container,
          chance: e.weightChance,
        })),
        guide: buildingGuideFor(room),
      });
    }
    return { rooms, vehicle: isVehicle, text: poolLocsText(pool, isVehicle) };
  }

  function collectMapPins(spots) {
    const pins = [];
    const seen = new Set();
    if (typeof GUIDE_ROOMS === 'undefined') return pins;
    for (const spot of spots) {
      const rm = spot.where.match(/^room "([^"]+)" → (\w+)$/);
      if (!rm) continue;
      const room = rm[1], cont = rm[2];
      for (const L of GUIDE_ROOMS[room] || []) {
        const k = [L.map, L.x, L.y, L.z, room].join('|');
        if (seen.has(k)) continue;
        seen.add(k);
        pins.push({ ...L, room, container: cont, mod: spot.mod || 'Vanilla' });
      }
    }
    return pins;
  }

  function formatSpotDetail(spot) {
    const rm = spot.where.match(/^room "([^"]+)" → (\w+)$/);
    if (rm) {
      const room = rm[1], cont = rm[2];
      const locs = typeof GUIDE_ROOMS !== 'undefined' ? (GUIDE_ROOMS[room] || []) : [];
      const maps = [...new Set(locs.map(L => L.map))];
      const bg = buildingGuideFor(room);
      let detail = `Open ${labelContainer(cont)} in custom room "${room}"`;
      if (spot.mod && spot.mod !== 'Vanilla') detail += ` on the ${spot.mod} map`;
      if (maps.length) detail += ` · ${maps.length} known map pin${maps.length > 1 ? 's' : ''} (see below)`;
      else if (!bg) detail += ' · no parsed coordinates — ask your map admin or search the mod map';
      return {
        title: `Mod room: ${room}`,
        detail,
        score: 80 + maps.length * 20 + (spot.weight || 0),
        roomKey: room,
        structured: { rooms: [{ room, label: room, containers: [{ name: labelContainer(cont), raw: cont }], guide: bg }], vehicle: false },
      };
    }

    if (/^Zombie holster/.test(spot.where)) {
      return {
        title: 'Zombie drop',
        detail: 'Kill zombies that spawn carrying the vanilla weapon this replaces — common in military/police horde areas',
        score: 35,
        structured: { rooms: [], vehicle: false },
      };
    }

    const isVehicle = /\(vehicle\)$/.test(spot.where);
    const pool = spot.where.replace(/ \(vehicle\)$/, '');
    const structured = poolLocsStructured(pool, isVehicle);

    if (structured.text || structured.rooms.length) {
      return {
        title: isVehicle ? `${pool} (vehicle)` : pool,
        detail: structured.text || structured.rooms.map(r => r.label).join(', '),
        score: 70 + (spot.weight || 0) + (spot.mod === 'Vanilla' ? 10 : 0),
        poolName: pool,
        structured,
      };
    }

    const nice = pool.replace(/([a-z])([A-Z])/g, '$1 $2');
    return {
      title: isVehicle ? `${nice} (vehicle)` : nice,
      detail: isVehicle
        ? 'Parked vehicles using this loot table — check truck beds and seats'
        : `Procedural pool — search buildings linked to "${nice}"`,
      score: 25 + (spot.weight || 0),
      poolName: pool,
      structured: { rooms: [], vehicle: isVehicle },
    };
  }

  function lineFromSpot(spot) {
    const d = formatSpotDetail(spot);
    const meta = spawnMeta(spot);
    const poolName = d.poolName || (spot.where.replace(/ \(vehicle\)$/, ''));
    const poolMod = spot.mod || 'Vanilla';
    const buildingTips = [];
    for (const r of d.structured?.rooms || []) {
      if (r.guide) buildingTips.push({ room: r.room, ...r.guide });
    }
    return {
      title: d.title,
      detail: d.detail,
      meta,
      text: `${d.title}: ${d.detail}${meta ? ` (${meta})` : ''}`,
      origin: spot.origin || 'direct',
      rule: spot.rule || null,
      score: d.score + (spot.origin === 'direct' ? 40 : 15),
      where: spot.where,
      poolName,
      poolMod,
      poolKey: `${poolName}|${poolMod}`,
      isVehicle: /\(vehicle\)$/.test(spot.where),
      structured: d.structured,
      buildingTips,
      roomKey: d.roomKey || null,
    };
  }

  function dedupeGuideLines(lines) {
    const byKey = new Map();
    for (const l of lines) {
      const k = l.poolKey || l.title;
      const prev = byKey.get(k);
      if (!prev) { byKey.set(k, l); continue; }
      if (l.isVehicle && !prev.isVehicle) continue;
      if (!l.isVehicle && prev.isVehicle) byKey.set(k, l);
    }
    return [...byKey.values()];
  }

  function buildQuickAnswer(guide) {
    const steps = [];
    for (const line of guide.lines) {
      for (const room of line.structured?.rooms || []) {
        const conts = (room.containers || []).map(c => {
          let s = c.name;
          if (c.chance) s += ` (${c.chance}% chance)`;
          return s;
        }).join(', ') || 'containers';
        steps.push({
          where: room.label,
          do: `Open ${conts}`,
          find: room.guide?.find || null,
          areas: room.guide?.areas || null,
          score: (line.score || 0) + (line.origin === 'direct' ? 15 : 0),
        });
      }
      if (line.structured?.vehicle && line.structured?.text) {
        steps.push({
          where: 'Parked vehicles',
          do: line.structured.text,
          score: (line.score || 0) - 5,
        });
      }
      if (/^Zombie holster/.test(line.where || '')) {
        steps.push({
          where: 'Zombie drops',
          do: line.detail,
          score: line.score || 20,
        });
      }
    }
    steps.sort((a, b) => b.score - a.score);
    const seen = new Set();
    return steps.filter(s => {
      const k = `${s.where}|${s.do}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, 6);
  }

  function qolIntel(id) {
    const q = typeof QOL_BY_ID !== 'undefined' ? QOL_BY_ID.get(id) : null;
    if (!q) return null;
    return { note: q._note || null, where: q._where || [], star: !!q._star };
  }

  function isPrimarySpawnLine(line) {
    if (line.roomKey) return true;
    if (/^Zombie holster/.test(line.where || '')) return true;
    if (line.structured?.rooms?.length) return true;
    if (line.structured?.vehicle && line.structured?.text) return true;
    if (line.poolName && typeof GUIDE_POOL_LOCS !== 'undefined' && GUIDE_POOL_LOCS.pools?.[line.poolName]) return true;
    return false;
  }

  function partitionGuideLines(lines) {
    const primary = [];
    const other = [];
    for (const l of lines) {
      (isPrimarySpawnLine(l) ? primary : other).push(l);
    }
    return { primary, other };
  }

  function buildItemGuide(id) {
    const { direct, inferred, all } = resolveSpawns(id);
    let lines = all.map(lineFromSpot).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
    lines = dedupeGuideLines(lines);
    const { primary, other } = partitionGuideLines(lines);
    const pins = collectMapPins(all);
    const item = typeof BY_ID !== 'undefined' ? BY_ID.get(id) : (typeof I !== 'undefined' ? I.find(x => x._id === id) : null);
    const buildingMap = new Map();
    for (const l of lines) {
      for (const t of l.buildingTips) buildingMap.set(t.room, t);
    }
    const hasWorldPools = lines.some(l => l.structured?.rooms?.length && !pins.length);
    const guide = {
      id,
      item,
      hasSpawn: all.length > 0,
      lines: primary.length ? primary : lines.slice(0, 12),
      otherLines: primary.length ? other : [],
      pins,
      direct: direct.length,
      inferred: inferred.length,
      total: lines.length,
      buildings: [...buildingMap.values()],
      hasWorldPools,
      worldNote: typeof GUIDE_BUILDINGS !== 'undefined' ? GUIDE_BUILDINGS._world : null,
      qol: qolIntel(id),
    };
    guide.quickAnswer = buildQuickAnswer(guide);
    return guide;
  }

  function getInserts() {
    if (insertByItem) return insertByItem;
    insertByItem = new Map();
    const pack = typeof GUIDE_MOD_INSERTS !== 'undefined' ? GUIDE_MOD_INSERTS : null;
    if (!pack) return insertByItem;
    for (const ins of pack.inserts || []) {
      if (!insertByItem.has(ins.modItem)) insertByItem.set(ins.modItem, []);
      insertByItem.get(ins.modItem).push(ins);
    }
    return insertByItem;
  }

  function getGunsByMag() {
    if (gunsByMag) return gunsByMag;
    gunsByMag = new Map();
    if (typeof I === 'undefined') return gunsByMag;
    for (const it of I) {
      if (!it.MagazineType) continue;
      if (!gunsByMag.has(it.MagazineType)) gunsByMag.set(it.MagazineType, []);
      gunsByMag.get(it.MagazineType).push(it);
    }
    return gunsByMag;
  }

  function mergeSpawns(id) {
    const sp = typeof GUIDE_DETAILS !== 'undefined' ? GUIDE_DETAILS.spawns : {};
    if (typeof window.GUIDE_FN?.mergeSpawns === 'function') {
      return window.GUIDE_FN.mergeSpawns(id, sp).map(s => ({ ...s, origin: 'direct' }));
    }
    const short = id.replace(/^[\w]+\./, '');
    const a = sp[id] || [], b = sp[short] || [];
    const seen = new Set(), out = [];
    for (const s of [...a, ...b]) {
      const k = [s.where, s.mod, s.weight].join('|');
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ ...s, origin: 'direct' });
    }
    return out;
  }

  function baseSpawns(baseId) {
    return mergeSpawns(baseId).map(s => ({ ...s, via: baseId }));
  }

  function spotKey(s) {
    return [s.where, s.mod, s.origin].join('|');
  }

  function resolveSpawns(id) {
    const direct = mergeSpawns(id);
    const inferred = [];
    const seen = new Set(direct.map(s => [s.where, s.mod].join('|')));

    function add(spot, meta) {
      const k = [spot.where, spot.mod].join('|');
      if (seen.has(k)) return;
      seen.add(k);
      inferred.push({ ...spot, ...meta });
    }

    const inserts = getInserts().get(id) || [];
    for (const ins of inserts) {
      for (const s of baseSpawns(ins.base)) {
        add(s, {
          origin: 'inferred',
          rule: `Replaces ${ins.base.replace(/^Base\./, '')} in the same loot rolls`,
          src: ins.src,
          chance: ins.chance,
        });
      }
    }

    const pack = typeof GUIDE_MOD_INSERTS !== 'undefined' ? GUIDE_MOD_INSERTS : null;
    for (const sp of pack?.spawners || []) {
      if (sp.modItem !== id) continue;
      for (const s of baseSpawns(sp.base)) {
        add(s, {
          origin: 'inferred',
          rule: `Replaces ${sp.base.replace(/^Base\./, '')} magazine spawns`,
          src: sp.src,
        });
      }
    }

    const guns = getGunsByMag().get(id) || [];
    for (const gun of guns) {
      const gunInserts = getInserts().get(gun._id) || [];
      for (const ins of gunInserts) {
        for (const s of baseSpawns(ins.base)) {
          add(s, {
            origin: 'inferred',
            rule: `Spawns with ${gun.DisplayName} (replaces ${ins.base.replace(/^Base\./, '')}) — magazine often loaded on the gun`,
            src: ins.src,
            chance: ins.chance,
          });
        }
      }
      for (const s of mergeSpawns(gun._id)) {
        add(s, {
          origin: 'inferred',
          rule: `Same loot pools as ${gun.DisplayName}`,
          src: gun._src,
        });
      }
    }

    for (const z of pack?.zombie || []) {
      if (z.modItem !== id) continue;
      add(
        { where: `Zombie holster (replaces ${z.base.replace(/^Base\./, '')})`, mod: z.src, weight: null },
        { origin: 'inferred', rule: 'Dropped by zombies carrying the vanilla weapon', src: z.src },
      );
    }

    return { direct, inferred, all: [...direct, ...inferred] };
  }

  function summarizeLocations(id, limit) {
    const { direct, inferred, all } = resolveSpawns(id);
    if (!all.length) {
      return { text: 'No spawn data found in parsed loot files', lines: [], hasSpawn: false, direct: 0, inferred: 0 };
    }
    const lines = all.map(lineFromSpot);
    lines.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
    const cap = limit || 20;
    const trimmed = lines.slice(0, cap);
    const extra = lines.length - trimmed.length;
    let text = trimmed.map(l => `${l.title}: ${l.detail}`).join(' · ');
    if (extra > 0) text += ` · +${extra} more pools`;
    return {
      text,
      lines: trimmed,
      hasSpawn: true,
      direct: direct.length,
      inferred: inferred.length,
      total: all.length,
    };
  }

  function spawnSummaryHtml(id, limit) {
    const sum = summarizeLocations(id, limit);
    if (!sum.hasSpawn) return `<span class="count">${sum.text}</span>`;
    return sum.lines.map(l => {
      const e = typeof esc === 'function' ? esc : x => x;
      return `<div class="lf-loc"><b>${e(l.title)}</b> — ${e(l.detail)}${l.meta ? `<span class="lf-meta">${e(l.meta)}</span>` : ''}</div>`;
    }).join('') + (sum.inferred ? `<div class="count" style="margin-top:4px">${sum.direct} direct · ${sum.inferred} inferred</div>` : '');
  }

  window.SPAWN_RESOLVE = {
    resolveSpawns,
    summarizeLocations,
    spawnSummaryHtml,
    formatSpotDetail,
    lineFromSpot,
    buildItemGuide,
    buildQuickAnswer,
    collectMapPins,
    buildingGuideFor,
    fallbackBuildingGuide,
  };
})();

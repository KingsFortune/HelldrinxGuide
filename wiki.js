// HellDrinx wiki — routing, full pages, share URLs. Requires GUIDE_FN globals from index.html.
(function () {
  'use strict';

  const SLUG_SEP = '--';
  let cfg = { siteUrl: '', siteName: 'HellDrinx Wiki' };
  let icons = { base: '', icons: {} };
  let vehicles = new Map();
  let variantMap = new Map(); // id -> [sibling ids]

  function slug(id) {
    return String(id).replace(/\./g, SLUG_SEP).replace(/[^\w-]/g, '_');
  }
  function fromSlug(s) {
    return String(s).replace(/_/g, '.').replace(new RegExp(SLUG_SEP, 'g'), '.');
  }
  function sharePath(id, kind) {
    const p = kind === 'vehicle' ? `v/${slug(id)}` : `i/${slug(id)}`;
    return `${cfg.siteUrl.replace(/\/$/, '')}/${p}/`;
  }
  function wikiHash(id, kind) {
    return kind === 'vehicle' ? `#wiki/vehicle/${encodeURIComponent(id)}` : `#wiki/item/${encodeURIComponent(id)}`;
  }

  function iconUrl(id) {
    const rel = icons.icons?.[id];
    if (!rel) return null;
    if (/^https?:\/\//i.test(rel)) return rel;
    const base = icons.base || cfg.siteUrl.replace(/\/$/, '');
    return `${base}/${rel.replace(/^\//, '')}`;
  }

  function pickInfoboxStats(it) {
    const rows = [];
    const add = (k, v) => { if (v != null && v !== '') rows.push([k, v]); };
    if (it._kind === 'Melee' || it._kind === 'Gun') {
      add('Damage', it.MinDamage && it.MaxDamage ? `${it.MinDamage}–${it.MaxDamage}` : it.MaxDamage);
      add('Crit', it.CriticalChance ? `${it.CriticalChance}%` : null);
      add('Crit ×', it.CritDmgMultiplier);
      add('Durability', it._dur ? Math.round(it._dur).toLocaleString() : null);
    }
    if (it._kind === 'Gun') {
      add('Ammo', (it.AmmoType || '').replace(/^\w+:/, ''));
      add('Mag', it.MaxAmmo);
      add('Range', it.MaxRange);
      add('Hit %', it.HitChance);
    }
    if (it._kind === 'Clothing') {
      add('Bite', it.BiteDefense);
      add('Scratch', it.ScratchDefense);
      add('Bullet', it.BulletDefense);
      add('Run ×', it.RunSpeedModifier || '1');
      add('Slot', it._loc);
    }
    if (it._kind === 'Container') {
      add('Capacity', it.Capacity);
      add('WR %', it.WeightReduction);
      add('Slot', it._loc);
      add('+Slots', it._slots);
    }
    if (it._kind === 'WeaponPart') {
      add('Slot', it.PartType);
      add('Hit +', it.HitChanceModifier);
      add('Recoil', it.RecoilDelayModifier);
    }
    add('Weight', it.Weight);
    add('Mod', it._src);
    return rows;
  }

  function infoboxHTML(entity) {
    const { title, id, kind, mod, icon, stats, tags, emoji } = entity;
    const img = icon
      ? `<img class="wikiicon" src="${icon}" alt="" loading="lazy">`
      : `<div class="wikiicon-ph">${emoji || kindEmoji(kind)}</div>`;
    let rows = stats.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(String(v))}</td></tr>`).join('');
    if (tags?.length) rows += `<tr><th>Tags</th><td>${tags}</td></tr>`;
    return `<aside class="wikiinfobox">
      ${img}
      <div class="ib-title">${esc(title)}</div>
      <div class="ib-id">${esc(id)}</div>
      <table class="ib-table">${rows}</table>
      <button type="button" class="ib-share" data-share="${esc(sharePath(id, kind === 'vehicle' ? 'vehicle' : 'item'))}">Copy share link</button>
    </aside>`;
  }

  function kindEmoji(k) {
    return ({ Melee: '⚔️', Gun: '🔫', WeaponPart: '🔧', Clothing: '🧥', Container: '🎒', QoL: '🔩', Vehicle: '🚗' })[k] || '📦';
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function buildVariantSection(id) {
    const sibs = variantMap.get(id);
    if (!sibs?.length) return '';
    return `<div class="dsec">Color variants</div><div class="itemgrid">` +
      sibs.map(vid => {
        const v = window.BY_ID?.get(vid) || window.QOL_BY_ID?.get(vid);
        const name = v?.DisplayName || vid.split('.').pop();
        return `<div class="cell"><a class="ilink" data-wiki-id="${esc(vid)}">${esc(name)}</a></div>`;
      }).join('') + `</div>`;
  }

  function itemWikiBody(it) {
    const FN = window.GUIDE_FN || {};
    const id = it._id;
    const g = FN.opFor?.(id);
    let h = '';

    if (typeof WIKI_LOOT !== 'undefined' && typeof SPAWN_RESOLVE !== 'undefined') {
      const guide = SPAWN_RESOLVE.buildItemGuide(id);
      h += WIKI_LOOT.renderDetailPanel(guide).replace(/<div class="lf-detail-head">[\s\S]*?<\/div>/, '');
    } else if (typeof SPAWN_RESOLVE !== 'undefined') {
      const sum = SPAWN_RESOLVE.summarizeLocations(id, 30);
      if (sum.hasSpawn) {
        h += `<div class="spawn-hero"><h3>Where to find it</h3>`;
        if (sum.inferred && !sum.direct) {
          h += `<div class="count" style="margin-bottom:8px">Traced via mod loot rules — spawns in the same containers as these vanilla pools:</div>`;
        } else if (sum.inferred) {
          h += `<div class="count" style="margin-bottom:8px">${sum.direct} direct loot pool${sum.direct !== 1 ? 's' : ''} · ${sum.inferred} traced via mod inserts</div>`;
        } else {
          h += `<div class="count" style="margin-bottom:8px">${sum.total} loot pool${sum.total !== 1 ? 's' : ''} — search these buildings and containers</div>`;
        }
        h += `<div class="lf-locs">` + sum.lines.map(l => {
          const border = l.origin === 'direct' ? 'var(--green)' : 'var(--ws-gold-dim)';
          const rule = l.rule ? `<div class="count" style="margin-top:4px;font-style:italic">${esc(l.rule)}</div>` : '';
          return `<div class="loc" style="border-left-color:${border}">
            <span class="pin">${l.origin === 'direct' ? '📦' : '↳'}</span>
            <div style="flex:1">
              <b>${esc(l.title)}</b>
              <div class="sub2" style="margin-top:4px;line-height:1.5">${esc(l.detail)}</div>
              ${l.meta ? `<div class="count" style="margin-top:3px">${esc(l.meta)}</div>` : ''}
              ${rule}
            </div></div>`;
        }).join('');
        if (sum.total > sum.lines.length) {
          h += `<p class="count">+${sum.total - sum.lines.length} more pools — use Container Pools browse for full list</p>`;
        }
        h += `</div></div>`;
      } else {
        h += `<div class="spawn-hero"><h3>Where to find it</h3><div class="count">Not in parsed distribution files — crafted, shop, quest, or custom spawn.</div></div>`;
      }
    } else {
      const sp = FN.mergeSpawns?.(id, window.GUIDE_DETAILS?.spawns) || [];
      if (sp.length && FN.spawnLocHTML) {
        h += `<div class="spawn-hero"><h3>Where to find it</h3>${FN.spawnLocHTML(sp)}</div>`;
      } else if (!g) {
        h += `<div class="spawn-hero"><h3>Where to find it</h3><div class="count">Not in distribution files — crafted, shop, quest, or custom spawn.</div></div>`;
      }
    }

    const desc = it._desc || it.Tooltip?.replace(/^"|"$/g, '');
    if (desc) h += `<div class="wiki-desc">${esc(desc)}</div>`;
    if (g) h += `<div class="note hot"><h3>Source</h3><div class="prose">${g.t}</div></div>`;
    const q = window.QOL_BY_ID?.get(id);
    if (q?._note) h += `<div class="note hot"><h3>Notes</h3><div class="prose">${q._note}</div></div>`;
    if (q?._where?.length && FN.whereCards) h += FN.whereCards(q._where);
    const short = id.replace(/^[\w]+\./, '');
    const recs = window.GUIDE_DETAILS?.recipes[id] || window.GUIDE_DETAILS?.recipes[short] ||
      Object.entries(window.GUIDE_DETAILS?.recipes || {}).filter(([k]) => k.endsWith('.' + short)).flatMap(([, v]) => v);
    if (recs?.length) {
      h += `<div class="dsec">Recipes (${recs.length})</div>` + recs.slice(0, 8).map(r => {
        const p = r.props, learn = (p.NeedToBeLearn || p.needTolearn || '').toLowerCase() === 'true';
        const taught = window.GUIDE_DETAILS?.teachers[r.name];
        return `<div class="rcard"><span class="rname">${esc(r.name)}</span> <span class="mod">(${esc(r.mod)})</span><br>
          ${p.SkillRequired ? `Requires <b>${esc(p.SkillRequired)}</b> · ` : ''}${learn ? `learned${taught ? ` via <b>${esc(taught.join(', '))}</b>` : ''} · ` : ''}${p.Time ? `time ${esc(p.Time)}` : ''}<br>
          <b>Needs:</b> ${r.inputs.map(esc).join('; ') || '?'}<br><b>Makes:</b> ${r.outputs.map(esc).join('; ')}</div>`;
      }).join('');
    }
    h += buildVariantSection(id);
    const SKIP = window.SKIP_STAT || new Set(['_id', '_src', '_kind', '_avg', '_dur', '_prot', '_loc', '_slots', 'DisplayName', '_desc']);
    h += `<div class="dsec">Stats</div><div class="statgrid">` +
      Object.entries(it).filter(([k, v]) => !SKIP.has(k) && v != null && v !== '').map(([k, v]) =>
        `<div><b>${esc(k)}</b>${esc(String(v).replace(/^"|"$/g, ''))}</div>`).join('') + '</div>';
    return h;
  }

  function qolWikiBody(q) {
    const FN = window.GUIDE_FN || {};
    const id = q._id;
    let h = '';
    if (q._tags?.length && FN.tagHTML) h += `<div style="margin:8px 0">${FN.tagHTML(q._tags)}</div>`;
    if (q._note) h += `<div class="note hot"><h3>Notes</h3><div class="prose">${q._note}</div></div>`;
    if (q._where?.length && FN.whereCards) h += FN.whereCards(q._where);
    const sp = FN.mergeSpawns?.(id, window.GUIDE_DETAILS?.spawns) || [];
    if (sp.length && FN.spawnLocHTML) {
      if (!q._where?.length) h += FN.spawnLocHTML(sp);
      else h += `<div class="dsec">All spawn entries (${sp.length})</div>` + FN.spawnLocHTML(sp);
    } else if (!q._where?.length) h += `<div class="dsec">Spawns</div><div class="count">Not in distribution files — crafted, shop, or admin-only.</div>`;
    return h;
  }

  const ZONE_LABELS = {
    military: 'Military bases & checkpoints', police: 'Police stations', fire: 'Fire stations',
    medical: 'Hospitals & clinics', farm: 'Farms & barns', ranger: 'Ranger stations & forest',
    fossoil: 'Gas stations', mccoy: 'McCoy Logging sites', trailerpark: 'Trailer parks',
    parkingstall: 'Parking lots', junkyard: 'Junkyards', construction: 'Construction sites',
    trafficjamw: 'Highway traffic jam — west', trafficjame: 'Highway traffic jam — east',
    trafficjamn: 'Highway traffic jam — north', trafficjams: 'Highway traffic jam — south',
    trafficjam: 'Highway traffic jams', normal: 'Roadside / residential', medium: 'Residential (medium)',
    good: 'Residential (affluent)', bad: 'Rough neighborhoods', rich: 'Wealthy areas', poor: 'Poor areas',
    station: 'Train / bus stations', restaurant: 'Restaurants', bank: 'Banks', mall: 'Shopping malls',
    industrial: 'Industrial zones', warehouse: 'Warehouses',
  };
  const zoneLabel = z => ZONE_LABELS[z] || z.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
  function chanceBucket(c) {
    if (c >= 20) return ['Very common', '#7ee2a0'];
    if (c >= 8) return ['Common', '#a6d96a'];
    if (c >= 3) return ['Uncommon', '#e8c568'];
    return ['Rare', '#ff9c8a'];
  }
  const PART_GROUPS = [
    ['weapon', '🔫 Weapons'], ['armor', '🛡️ Armor'], ['storage', '📦 Storage'], ['fuel', '⛽ Fuel'],
    ['engine', '⚙️ Engine'], ['wheels', '🛞 Wheels & suspension'], ['door', '🚪 Doors'],
    ['window', '🪟 Windows'], ['lights', '💡 Lights'], ['electronics', '📡 Electronics'], ['misc', '🔩 Other'],
  ];
  // curated special-ability notes for marquee vehicles
  const VEH_NOTES = {
    SuperBulldozer: `<b>Five drive modes</b> (radial menu while driving): <b>Standard</b> destroys objects/trees in your path and drops their loot · <b>Standard (no loot)</b> · <b>Foliage</b> clears only trees & vegetation · <b>Gravel</b> paves the ground under you into road · <b>EXTREME</b> deletes everything and flattens terrain to bare dirt. Clears a base plot in minutes.`,
    '93fordElgin': `<b>Street sweeper.</b> While driving, the brushes scrub blood & grime off the road AND vacuum ground items straight into the truck's storage — drive through a horde-night killing field to hoover every dropped weapon and bag without leaving the seat.`,
    M60A3: `<b>Drive & Shoot tank.</b> The 105mm main gun and M240 coaxial machine gun are functional. Carries an internal ammo store. Extremely slow (20) and needs Mechanics 8 to repair the engine.`,
    M113_APC: `<b>Best group vehicle on the server:</b> 6-8 seats, 400-capacity truck bed, hull armor, and a functional Browning M2 turret. Slow but nearly indestructible (5000 front-end health).`,
    M41_Walker_Bulldog: `Light tank with a functional turret. Tracked, slow, and armored — a mobile strongpoint.`,
    BTR: `Russian 8-wheel APC. Armored troop carrier — pair with the BMP for a full Soviet motor pool.`,
    BMP: `Russian tracked IFV. Armored, slow, and imposing.`,
  };

  function vehEmoji(v) {
    const n = (v.name + ' ' + (v.display || '')).toLowerCase();
    if (/dozer/.test(n)) return '🚜';
    if (/sweeper|elgin/.test(n)) return '🧹';
    if (/tank|m60|m41|abrams|bulldog/.test(n)) return '🪖';
    if (/apc|m113|btr|bmp|humvee|m998|military|m35|m923/.test(n)) return '🛻';
    if (/ambulance|medic/.test(n)) return '🚑';
    if (/police|swat|interceptor|cvpi/.test(n)) return '🚓';
    if (/fire|pumper/.test(n)) return '🚒';
    if (/trailer|semi|cistern|container/.test(n)) return '🚛';
    if (/truck|pickup|van|e150|hilux|ranger|bronco/.test(n)) return '🚚';
    if (/bus/.test(n)) return '🚌';
    if (/moto|bike|harley/.test(n)) return '🏍️';
    if (/mclaren|gt40|charger|camaro|mustang|corvette|ferrari|lambo|porsche|race/.test(n)) return '🏎️';
    return '🚗';
  }

  function vehicleWikiBody(v) {
    const s = v.stats || {};
    let h = '';
    // class badges
    const badges = [];
    if (v.armed) badges.push(['🔫 Armed', '#ff9c8a']);
    if (v.armored) badges.push(['🛡️ Armored', '#8fb8e8']);
    if (v.maxSpeed >= 120) badges.push(['🏎️ Fast', '#e8c568']);
    if ((v.storage || 0) >= 200) badges.push(['📦 Hauler', '#7ee2a0']);
    if (v.offRoad >= 1.3) badges.push(['🏔️ Off-road', '#a6d96a']);
    if (v.seatsDeclared >= 6) badges.push(['👥 ' + v.seatsDeclared + ' seats', '#c9a6e8']);
    if (badges.length) h += `<div style="display:flex;gap:7px;flex-wrap:wrap;margin:4px 0 12px">` +
      badges.map(([t, c]) => `<span class="chip" style="background:${c}22;color:${c};font-size:12.5px;padding:3px 10px">${esc(t)}</span>`).join('') + `</div>`;

    if (VEH_NOTES[v.name] || VEH_NOTES[v.name.replace(/^Base\./, '')])
      h += `<div class="note hot"><h3>Special abilities</h3><div class="prose">${VEH_NOTES[v.name] || VEH_NOTES[v.name.replace(/^Base\./, '')]}</div></div>`;

    // spawn zones — the headline detail
    if (v.zones?.length) {
      h += `<div class="dsec">📍 Where it spawns (${v.zones.length} zones) — click a zone for example map coordinates</div>`;
      for (const z of v.zones) {
        const [bl, bc] = chanceBucket(z.chance);
        const clickable = window.hasVehZone?.(z.zone);
        const nSpots = clickable ? window.GUIDE_VEHZONES[z.zone].spots.length : 0;
        h += `<div class="loc${clickable ? ' rowbtn' : ''}" ${clickable ? `data-vzone="${esc(z.zone)}"` : ''} style="border-left-color:${bc}${clickable ? ';cursor:pointer' : ''}"><span class="pin">${z.chance >= 20 ? '⭐' : '📍'}</span><div style="flex:1">
          <b>${esc(zoneLabel(z.zone))}</b> <span class="chip" style="background:${bc}22;color:${bc}">${esc(bl)}</span>${clickable ? ` <span class="viewall">▸ ${nSpots} example location${nSpots > 1 ? 's' : ''}</span>` : ''}<br>
          <span class="sub2">zone <code>${esc(z.zone)}</code> · spawn weight ${z.chance}${clickable ? '' : ' · no fixed coords (mod-created zone)'}</span></div></div>`;
      }
    } else {
      h += `<div class="dsec">📍 Where it spawns</div><div class="count">Not in the standard vehicle spawn tables — this vehicle is placed by a custom script, quest, admin, or map (e.g. the Super Bulldozer uses its own spawner). Check the mod page or ask an admin.</div>`;
    }

    // performance
    const perf = [
      ['Top speed', v.maxSpeed], ['Engine force', s.engineForce], ['Engine power', s.enginePower],
      ['Engine quality', s.engineQuality], ['Engine loudness', s.engineLoudness], ['Braking force', s.brakingForce],
      ['Mass (kg)', s.mass], ['Off-road', v.offRoad], ['Wheel friction', s.wheelFriction],
      ['Roll influence', s.rollInfluence], ['Steering', s.steeringIncrement],
      ['Front health', s.frontEndHealth], ['Rear health', s.rearEndHealth],
      ['Damage protection', s.playerDamageProtection], ['Repair skill', s.engineRepairLevel ? 'Mechanics ' + s.engineRepairLevel : null],
      ['Wheels', v.wheelCount || null],
    ].filter(([, val]) => val != null && val !== '');
    if (perf.length) h += `<div class="dsec">⚙️ Performance</div><div class="statgrid">` +
      perf.map(([k, val]) => `<div><b>${esc(k)}</b>${esc(String(val))}</div>`).join('') + `</div>`;

    // capacity
    const cap = [
      ['⛽ Fuel tank', v.fuel], ['📦 Truck bed', v.trunk], ['🧰 Glovebox', v.glovebox],
      ['💺 Seat storage', v.seatStorage], ['Σ Total storage', v.storage], ['👥 Seats', v.seatsDeclared],
      ['🎨 Paint/camo skins', v.skins || null],
    ].filter(([, val]) => val != null && val !== '');
    if (cap.length) h += `<div class="dsec">🎒 Capacity & fuel</div><div class="statgrid">` +
      cap.map(([k, val]) => `<div><b>${esc(k)}</b>${esc(String(val))}</div>`).join('') + `</div>`;

    // parts, grouped
    if (v.parts?.length) {
      const byCat = {};
      for (const p of v.parts) (byCat[p.cat] = byCat[p.cat] || []).push(p);
      h += `<div class="dsec">🔧 Parts & components (${v.parts.length})</div>`;
      for (const [cat, label] of PART_GROUPS) {
        const ps = byCat[cat];
        if (!ps?.length) continue;
        h += `<div style="margin:8px 0 3px;color:var(--dim);font-size:12px;font-weight:600">${esc(label)}</div><div class="itemgrid">` +
          ps.map(p => `<div class="cell"><div style="flex:1">${esc(p.name.replace(/\*/g, ''))}${p.cap ? ` <span class="count">cap ${p.cap}</span>` : ''}</div></div>`).join('') + `</div>`;
      }
    }
    return h;
  }

  function crumbs(label, kind) {
    const tab = kind === 'vehicle' ? 'Vehicles' : (kind === 'QoL' ? 'Loot' : 'Character');
    return `<nav class="wikicrumbs">
      <a href="#" data-wiki-back>Guide</a> ›
      <a href="#" data-wiki-tab="${esc(tab)}">${esc(tab)}</a> ›
      <span>${esc(label)}</span>
    </nav>`;
  }

  function setOgMeta({ title, desc, image, url }) {
    const set = (prop, content) => {
      if (!content) return;
      let el = document.querySelector(`meta[property="${prop}"]`) || document.querySelector(`meta[name="${prop}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(prop.startsWith('og:') ? 'property' : 'name', prop); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };
    document.title = title;
    set('og:title', title);
    set('og:description', desc);
    set('og:image', image);
    set('og:url', url);
    set('twitter:card', 'summary');
    set('twitter:title', title);
    set('twitter:description', desc);
    if (image) set('twitter:image', image);
  }

  function renderWikiPage(mainEl, payload) {
    const { id, kind, title, bodyHTML, infobox } = payload;
    mainEl.innerHTML = `<div class="wiki-page">${crumbs(title, kind)}<div class="wikigrid"><article class="wikibody">${bodyHTML}</article>${infoboxHTML(infobox)}</div></div>`;
    document.body.classList.add('wiki-mode');
    const url = sharePath(id, kind === 'vehicle' ? 'vehicle' : 'item');
    setOgMeta({
      title: `${title} — ${cfg.siteName}`,
      desc: infobox.stats.slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(' · ') || title,
      image: infobox.icon,
      url,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resolveItem(id) {
    return window.BY_ID?.get(id) || window.QOL_BY_ID?.get(id);
  }

  function open(id, opts = {}) {
    const { push = true, kind: forceKind } = opts;
    let kind = forceKind;
    let entity = null;

    if (kind === 'vehicle' || (!window.BY_ID?.has(id) && vehicles.has(id))) {
      const v = vehicles.get(id);
      if (!v) return false;
      kind = 'vehicle';
      const stats = [];
      const add = (k, val) => { if (val != null && val !== '') stats.push([k, val]); };
      add('Top speed', v.maxSpeed);
      add('Seats', v.seatsDeclared || v.seats);
      add('Fuel', v.fuel);
      add('Truck bed', v.trunk);
      add('Total storage', v.storage);
      add('Off-road', v.offRoad);
      add('Armed', v.armed ? 'Yes 🔫' : null);
      add('Armored', v.armored ? 'Yes 🛡️' : null);
      add('Spawn zones', v.zones?.length || null);
      add('Mod', v.mod);
      entity = {
        id, kind, title: v.display || v.name, emoji: vehEmoji(v),
        bodyHTML: vehicleWikiBody(v),
        infobox: { title: v.display || v.name, id, kind: 'Vehicle', mod: v.mod, icon: null, emoji: vehEmoji(v), stats, tags: null },
      };
    } else {
      const it = window.BY_ID?.get(id);
      const q = window.QOL_BY_ID?.get(id);
      if (it) {
        kind = it._kind;
        entity = {
          id, kind, title: it.DisplayName,
          bodyHTML: itemWikiBody(it),
          infobox: {
            title: it.DisplayName, id, kind, mod: it._src,
            icon: iconUrl(id), stats: pickInfoboxStats(it), tags: null,
          },
        };
      } else if (q) {
        kind = 'QoL';
        entity = {
          id, kind, title: q.DisplayName,
          bodyHTML: qolWikiBody(q),
          infobox: {
            title: q.DisplayName, id, kind: 'QoL', mod: q._src,
            icon: iconUrl(id), stats: [['Category', q._cat || 'utility'], ['Mod', q._src]],
            tags: window.GUIDE_FN?.tagHTML?.(q._tags) || null,
          },
        };
      }
    }
    if (!entity) return false;

    const hash = kind === 'vehicle' ? `#wiki/vehicle/${encodeURIComponent(id)}` : `#wiki/item/${encodeURIComponent(id)}`;
    if (push && location.hash !== hash) history.pushState({ wiki: true }, '', hash);
    else if (push) history.replaceState({ wiki: true }, '', hash);

    renderWikiPage(document.getElementById('main'), entity);
    return true;
  }

  function closeWiki(restoreTab) {
    document.body.classList.remove('wiki-mode');
    document.title = cfg.siteName;
    if (restoreTab !== false && window.GUIDE_BOOT?.showTab) {
      const last = window.GUIDE_BOOT.lastTab || 'Home';
      if (last === 'Home' && window.GUIDE_BOOT.showHome) window.GUIDE_BOOT.showHome();
      else window.GUIDE_BOOT.showTab(last);
    }
    setOgMeta({ title: cfg.siteName, desc: cfg.description || '', image: `${cfg.siteUrl}/assets/og-default.png`, url: cfg.siteUrl });
  }

  function parseHash() {
    const h = location.hash.slice(1);
    const mItem = h.match(/^wiki\/item\/(.+)$/);
    if (mItem) return { type: 'item', id: decodeURIComponent(mItem[1]) };
    const mVeh = h.match(/^wiki\/vehicle\/(.+)$/);
    if (mVeh) return { type: 'vehicle', id: decodeURIComponent(mVeh[1]) };
    return null;
  }

  function buildVariantMap(items) {
    const groups = new Map();
    for (const it of items) {
      const base = it.DisplayName.replace(/\s*\((Wood|Black|White|Brown|Grey|Green|Pink|Orange|Blue|Purple|Red|Camo[\w ]*)\)\s*/gi, '').trim();
      const key = [it._src, it._kind, base, it.MinDamage, it.MaxDamage, it.Capacity, it.BiteDefense, it.BodyLocation, it.AmmoType, it.PartType].join('|');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(it._id);
    }
    variantMap = new Map();
    for (const ids of groups.values()) {
      if (ids.length < 2) continue;
      for (const id of ids) variantMap.set(id, ids.filter(x => x !== id));
    }
  }

  function init(options) {
    cfg = { ...cfg, ...options.config };
    icons = options.icons || icons;
    if (options.vehicles) vehicles = new Map(options.vehicles.map(v => [v.name, v]));
    buildVariantMap(options.items || []);

    window.addEventListener('hashchange', () => {
      const r = parseHash();
      if (r) open(r.id, { push: false, kind: r.type === 'vehicle' ? 'vehicle' : undefined });
      else closeWiki();
    });
    window.addEventListener('popstate', () => {
      const r = parseHash();
      if (r) open(r.id, { push: false, kind: r.type === 'vehicle' ? 'vehicle' : undefined });
      else closeWiki(false);
    });

    document.addEventListener('click', e => {
      const back = e.target.closest('[data-wiki-back]');
      if (back) { e.preventDefault(); history.pushState(null, '', '#'); closeWiki(); return; }
      const tab = e.target.closest('[data-wiki-tab]');
      if (tab) {
        e.preventDefault();
        history.pushState(null, '', '#');
        closeWiki(false);
        window.GUIDE_BOOT?.showTab(tab.dataset.wikiTab);
        return;
      }
      const wi = e.target.closest('[data-wiki-id]');
      if (wi) { e.preventDefault(); open(wi.dataset.wikiId); return; }
      const share = e.target.closest('[data-share]');
      if (share) {
        navigator.clipboard?.writeText(share.dataset.share);
        window.copyToast?.('Link copied — paste in Discord');
      }
    });

    const r = parseHash();
    if (r) open(r.id, { push: false, kind: r.type === 'vehicle' ? 'vehicle' : undefined });
  }

  window.WIKI = { init, open, close: closeWiki, slug, fromSlug, sharePath, wikiHash, iconUrl };
})();

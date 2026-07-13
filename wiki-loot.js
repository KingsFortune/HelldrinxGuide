/**
 * Loot Finder — search-first UI for "where does X spawn?"
 * Depends on: I, LOOT, ensureLoot, WIKI, GUIDE_ICONS, esc, linkItem, mergeSpawns, spawnLocHTML
 */
(function () {
  'use strict';

  let searchIndex = null;

  const TERM_SYNONYMS = {
    magazine: ['magazine', 'mag', 'clip', 'box', 'drum', 'belt', 'stanag'],
    sniper: ['sniper', 'dmr', 'marksman', 'psg', 'msr'],
    rifle: ['rifle', 'gun', 'carbine'],
    mold: ['mold', 'mould'],
  };

  const ITEM_ALIASES = [
    { q: 'iron bar mold', id: 'Base.IronBarMold' },
    { q: 'iron ingot mold', id: 'Base.IronIngotMold' },
    { q: 'steel bar mold', id: 'Base.SteelBarMold' },
    { q: 'm60 magazine', id: 'MarzGuns.762x51_Box' },
    { q: 'm60 mag', id: 'MarzGuns.762x51_Box' },
    { q: 'm60 ammo', id: 'MarzGuns.762x51_Box' },
    { q: 'm60', id: 'MarzGuns.M60' },
    { q: 'm24 magazine', id: 'MarzGuns.762x51Magazine5_M24' },
    { q: 'm24 mag', id: 'MarzGuns.762x51Magazine5_M24' },
    { q: '556 magazine', id: 'Base.556Clip' },
    { q: 'stanag', id: 'Base.556Clip' },
    { q: 'exoskeleton', id: 'Base.Exoskeleton' },
  ];

  function aliasIdForQuery(q) {
    const ql = normQ(q);
    for (const a of ITEM_ALIASES) {
      if (ql === normQ(a.q) || ql.includes(normQ(a.q))) return a.id;
    }
    return null;
  }

  function normQ(s) {
    return String(s ?? '')
      .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
      .replace(/([0-9])([A-Za-z])/g, '$1 $2')
      .replace(/[_.]/g, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function iconUrl(id) {
    if (!id || typeof GUIDE_ICONS === 'undefined') return null;
    if (typeof WIKI !== 'undefined' && WIKI.iconUrl) {
      const u = WIKI.iconUrl(id);
      if (u) return u;
    }
    const rel = GUIDE_ICONS.icons?.[id];
    if (!rel) return null;
    if (/^https?:\/\//i.test(rel)) return rel;
    return rel.replace(/^\//, '');
  }

  function iconFor(id) {
    const u = iconUrl(id);
    return u ? `<img src="${esc(u)}" alt="" loading="lazy">` : '';
  }

  function haystack(r) {
    return [r.disp, r.short, r.id, r.kind, r.mod, r.ammo, normQ(r.id), normQ(r.disp)].filter(Boolean).join(' ').toLowerCase();
  }

  function termMatches(term, r) {
    const hay = haystack(r);
    const variants = TERM_SYNONYMS[term] || [term];
    return variants.some(v => hay.includes(v));
  }

  function termScore(term, r) {
    const disp = r.disp.toLowerCase();
    const short = r.short.toLowerCase();
    const idnorm = normQ(r.id);
    const variants = TERM_SYNONYMS[term] || [term];
    let best = 0;
    for (const v of variants) {
      if (disp === v) best = Math.max(best, 20);
      else if (disp.includes(v)) best = Math.max(best, 12);
      else if (short.includes(v)) best = Math.max(best, 8);
      else if (idnorm.includes(v)) best = Math.max(best, 6);
      else if (haystack(r).includes(v)) best = Math.max(best, 3);
    }
    return best;
  }

  function spawnSummary(row) {
    if (row.summary) return row.summary;
    const spots = row.spots || [];
    if (!spots.length) return 'No spawn data — open for recipes / stats';
    const rooms = new Set(), pools = new Set();
    for (const s of spots) {
      const rm = s.where.match(/^room "([^"]+)"/);
      if (rm) rooms.add(rm[1]);
      else pools.add(s.where.replace(/^pool /, '').slice(0, 40));
    }
    const bits = [];
    if (rooms.size) bits.push(`${rooms.size} room${rooms.size > 1 ? 's' : ''}`);
    if (pools.size) bits.push(`${pools.size} pool${pools.size > 1 ? 's' : ''}`);
    return bits.join(' · ') || `${spots.length} spawn${spots.length > 1 ? 's' : ''}`;
  }

  function enrichRow(r) {
    if (!r.id || typeof SPAWN_RESOLVE === 'undefined') return r;
    const resolved = SPAWN_RESOLVE.resolveSpawns(r.id);
    const pins = SPAWN_RESOLVE.collectMapPins(resolved.all);
    return {
      ...r,
      hasSpawn: resolved.all.length > 0,
      summary: resolved.all.length ? `${resolved.all.length} loot source${resolved.all.length !== 1 ? 's' : ''}` : 'No loot data',
      spawnDirect: resolved.direct.length,
      spawnInferred: resolved.inferred.length,
      hasPins: pins.length > 0,
      pinCount: pins.length,
    };
  }

  function enrichRows(rows, cap) {
    const n = cap ?? 30;
    return rows.map((r, i) => (i < n ? enrichRow(r) : r));
  }

  function renderCompactCard(r, selected) {
    const ico = r.id ? iconFor(r.id) : '';
    const poolCount = (r.spawnDirect ?? 0) + (r.spawnInferred ?? 0);
    const hasSpawn = r.hasSpawn ?? (r.spots?.length > 0);
    const badge = hasSpawn
      ? (r.hasPins ? `📍 ${r.pinCount || ''} pins` : (poolCount ? `${poolCount} pools` : `${r.spots?.length || '?'} pools`))
      : 'no data';
    return `<div class="lf-card lf-compact${selected ? ' on' : ''}" data-pick-id="${esc(r.id || '')}">
      ${ico || '<div class="ph">?</div>'}
      <div class="lf-card-body">
        <div class="nm">${esc(r.disp)}</div>
        <div class="sp">${esc(r.mod || '')} · ${esc(r.kind || 'item')}</div>
        <div class="lf-badge ${hasSpawn ? 'ok' : ''}">${esc(badge)}</div>
      </div>
    </div>`;
  }

  function renderDetailPanel(guide) {
    if (!guide || !guide.id) {
      return `<div class="lf-detail-empty"><h3>Loot guide</h3><p>Search an item, then click a result to see exactly where to loot it — buildings, containers, map pins, and mod rules.</p></div>`;
    }
    const e = typeof esc === 'function' ? esc : x => x;
    const item = guide.item;
    const ico = iconFor(guide.id);
    let h = `<div class="lf-detail-head">
      ${ico || '<div class="ph">?</div>'}
      <div class="lf-detail-meta">
        <h3>${e(item?.DisplayName || guide.id)}</h3>
        <div class="count">${e(item?._src || '')} · ${e(item?._kind || 'item')}</div>
        <div class="lf-detail-actions">
          <button type="button" class="ws-chip" data-wiki-open="${e(guide.id)}">Full wiki page</button>
        </div>
      </div>
    </div>`;

    if (!guide.hasSpawn) {
      if (guide.qol?.note || guide.qol?.where?.length) {
        h += `<div class="note hot"><h3>Curated tips</h3>`;
        if (guide.qol.note) h += `<div class="prose">${guide.qol.note}</div>`;
        if (guide.qol.where.length) h += `<div class="prose">${guide.qol.where.join('<br>')}</div>`;
        h += `</div>`;
      }
      h += `<div class="note"><h3>No loot tables</h3><div class="prose">Not in parsed distribution files. May be crafted, bought, quest reward, or chest-only.</div></div>`;
      return h;
    }

    if (guide.qol?.note) {
      h += `<div class="note hot lf-qol-note"><h3>${guide.qol.star ? '★ ' : ''}Item notes</h3><div class="prose">${guide.qol.note}</div></div>`;
    }

    if (guide.quickAnswer?.length) {
      h += `<div class="lf-section lf-quick"><div class="lf-sec-h">Where to go (quick answer)</div>`;
      guide.quickAnswer.forEach((step, i) => {
        h += `<div class="lf-quick-step">
          <div class="lf-quick-num">${i + 1}</div>
          <div class="lf-quick-body">
            <b>${e(step.where)}</b> — ${e(step.do)}
            ${step.find ? `<div class="lf-find"><span class="lbl">How to find it</span> ${e(step.find)}</div>` : ''}
            ${step.areas ? `<div class="lf-find"><span class="lbl">Areas</span> ${e(step.areas)}</div>` : ''}
          </div>
        </div>`;
      });
      h += `</div>`;
    }

    if (guide.qol?.where?.length) {
      h += `<div class="lf-section"><div class="lf-sec-h">Curated spawn tips</div><div class="prose">${guide.qol.where.join('<br>')}</div></div>`;
    }

    if (guide.hasWorldPools && guide.worldNote) {
      h += `<div class="note hot lf-world-note"><h3>${e(guide.worldNote.title)}</h3>
        <div class="prose"><p><b>How world loot works:</b> ${e(guide.worldNote.find)}</p>
        <p><b>Tip:</b> ${e(guide.worldNote.identify)}</p>
        <p><b>Towns to search:</b> ${e(guide.worldNote.areas)}</p></div></div>`;
    }

    if (guide.pins.length) {
      h += `<div class="lf-section"><div class="lf-sec-h">📍 Exact map pins (${guide.pins.length})</div>`;
      for (const p of guide.pins.slice(0, 12)) {
        const fl = typeof floorName === 'function' ? floorName(p.z) : `floor ${p.z}`;
        h += `<div class="loc"><span class="pin">📍</span><div style="flex:1">
          <b>${e(p.map)}</b> — room <code>${e(p.room)}</code> · ${e(labelContainerLoot(p.container))}<br>
          <span class="sub2">Go to <b style="color:#7ee2a0">${p.x}, ${p.y}</b> · ${e(fl)} · ${e(p.mod)} map</span>
        </div><span class="viewall" data-copy="${p.x},${p.y},${p.z}">⧉ copy</span></div>`;
      }
      if (guide.pins.length > 12) h += `<p class="count">+${guide.pins.length - 12} more pins on wiki page</p>`;
      h += `</div>`;
    }

    h += `<div class="lf-section"><div class="lf-sec-h">Loot sources (${guide.lines.length}${guide.otherLines?.length ? ` · ${guide.total} total` : ''})</div>`;
  if (guide.inferred) h += `<p class="count" style="margin-bottom:10px">${guide.direct} direct · ${guide.inferred} traced via mod insert rules</p>`;

    for (const line of guide.lines) {
      const border = line.origin === 'direct' ? 'var(--green)' : 'var(--ws-gold-dim)';
      h += `<div class="lf-pool-card" style="border-left-color:${border}">
        <div class="lf-pool-top">
          <b>${line.origin === 'inferred' ? '↳ ' : ''}${e(line.title)}</b>
          ${line.poolName ? `<button type="button" class="viewall" data-lf-pool="${e(line.poolName)}" data-lf-mod="${e(line.poolMod)}">see all items in pool ▸</button>` : ''}
        </div>
        <div class="sub2">${e(line.detail)}</div>
        ${line.meta ? `<div class="count">${e(line.meta)}</div>` : ''}
        ${line.rule ? `<div class="count" style="font-style:italic">${e(line.rule)}</div>` : ''}`;

      for (const r of line.structured?.rooms || []) {
        h += `<div class="lf-building"><b>${e(r.label)}</b>`;
        if (r.containers?.length) {
          h += `<div class="sub2">Open: ${r.containers.map(c => e(c.name) + (c.chance ? ` (${c.chance}%)` : '')).join(', ')}</div>`;
        }
        if (r.guide) {
          h += `<div class="lf-find"><span class="lbl">How to find it</span> ${e(r.guide.find)}</div>
            <div class="lf-find"><span class="lbl">Look for</span> ${e(r.guide.identify)}</div>
            <div class="lf-find"><span class="lbl">Areas</span> ${e(r.guide.areas)}</div>`;
        } else {
          h += `<div class="lf-find count">Open map (M) and search for "${e(r.label)}" buildings — loot all containers inside.</div>`;
        }
        h += `</div>`;
      }

      if (line.structured?.vehicle && line.structured?.text) {
        h += `<div class="lf-building"><b>Vehicle spawn</b><div class="lf-find">${e(line.structured.text)}</div></div>`;
      }

      h += `</div>`;
    }
    h += `</div>`;

    if (guide.otherLines?.length) {
      h += `<details class="lf-section lf-other"><summary class="lf-sec-h">+ ${guide.otherLines.length} mod-specific / vehicle spawn tables</summary>`;
      for (const line of guide.otherLines.slice(0, 20)) {
        const border = line.origin === 'direct' ? 'var(--green)' : 'var(--ws-gold-dim)';
        h += `<div class="lf-pool-card lf-pool-mini" style="border-left-color:${border}">
          <b>${e(line.title)}</b>
          <div class="sub2 count">${e(line.detail)}</div>
          ${line.rule ? `<div class="count" style="font-style:italic">${e(line.rule)}</div>` : ''}
        </div>`;
      }
      if (guide.otherLines.length > 20) h += `<p class="count">+${guide.otherLines.length - 20} more</p>`;
      h += `</details>`;
    }

    return h;
  }

  function labelContainerLoot(c) {
    const map = { militarylocker: 'military lockers', metal_shelves: 'metal shelving', crate: 'crates', all: 'all containers' };
    return map[c] || c.replace(/_/g, ' ');
  }

  function wireDetailPanel(root, onWiki) {
    root.querySelector('[data-wiki-open]')?.addEventListener('click', e => {
      const id = e.target.closest('[data-wiki-open]')?.dataset.wikiOpen;
      if (id && onWiki) onWiki(id);
    });
    root.querySelectorAll('[data-lf-pool]').forEach(btn => {
      btn.onclick = () => {
        if (typeof openPoolByName === 'function') openPoolByName(btn.dataset.lfPool, btn.dataset.lfMod);
      };
    });
    root.querySelectorAll('[data-copy]').forEach(cp => {
      cp.onclick = ev => { ev.stopPropagation(); if (typeof copyToast === 'function') copyToast(cp.dataset.copy); };
    });
  }

  function buildIndex() {
    if (searchIndex) return searchIndex;
    if (typeof ensureLoot === 'function') ensureLoot();

    const spawnByShort = new Map();
    const spawnById = new Map();
    if (typeof LOOT !== 'undefined' && LOOT.finder) {
      for (const r of LOOT.finder) {
        spawnByShort.set(r.short, r);
        if (r.id) spawnById.set(r.id, r);
      }
    }

    const seen = new Set();
    const rows = [];

    function addEntry(it, kindOverride) {
      const id = it._id;
      if (!id || seen.has(id)) return;
      seen.add(id);
      const short = id.replace(/^[\w]+\./, '');
      const spawn = spawnById.get(id) || spawnByShort.get(short);
      const disp = it.DisplayName || spawn?.disp || short;
      const spots = spawn?.spots || [];
      rows.push({
        short,
        disp,
        id,
        kind: kindOverride || it._kind || spawn?.kind || 'item',
        mod: it._src || spawn?.mod || '',
        ammo: (it.AmmoType || '').replace(/^[\w]+:/, ''),
        tags: spawn?.tags || [],
        spots,
        hasSpawn: spots.length > 0,
        q: haystack({ disp, short, id, kind: it._kind, mod: it._src, ammo: it.AmmoType }),
        summary: spawnSummary({ spots }),
      });
    }

    if (typeof I !== 'undefined') {
      for (const it of I) addEntry(it);
    }
    if (typeof QOL_BY_ID !== 'undefined') {
      for (const q of QOL_BY_ID.values()) addEntry(q, 'QoL');
    }

    searchIndex = rows;
    return searchIndex;
  }

  function searchLoot(q, limit) {
    const idx = buildIndex();
    const ql = (q || '').trim().toLowerCase();
    if (!ql) return [];
    const terms = ql.split(/\s+/).filter(Boolean);
    const aliasId = aliasIdForQuery(q);
    const scored = [];

    for (const r of idx) {
      let score = 0;
      let matched = 0;
      for (const t of terms) {
        const ts = termScore(t, r);
        if (ts > 0 || termMatches(t, r)) {
          score += ts || 2;
          matched++;
        }
      }
      if (!matched) continue;
      if (terms.length > 1 && matched < terms.length) {
        score = Math.max(1, score - (terms.length - matched) * 4);
      }
      if (r.hasSpawn) score += 3;
      if (aliasId && r.id === aliasId) score += 100;
      if (/magazine|clip|box/i.test(r.disp + r.id) && terms.some(t => TERM_SYNONYMS.magazine?.includes(t) || t === 'magazine' || t === 'mag')) {
        score += 2;
      }
      scored.push({ ...r, score });
    }

    scored.sort((a, b) => b.score - a.score || (b.hasSpawn - a.hasSpawn) || a.disp.localeCompare(b.disp));
    const out = scored.slice(0, limit || 40);
    if (aliasId && !out.find(r => r.id === aliasId)) {
      const hit = idx.find(r => r.id === aliasId);
      if (hit) out.unshift({ ...hit, score: 999 });
    }
    return out.slice(0, limit || 40);
  }

  function openItem(id, opts) {
    if (!id) return;
    if (opts?.detailOnly && typeof SPAWN_RESOLVE !== 'undefined') return SPAWN_RESOLVE.buildItemGuide(id);
    if (id && typeof WIKI !== 'undefined' && !opts?.detailOnly) {
      document.body.classList.add('wiki-mode');
      if (typeof WIKI_SHELL !== 'undefined') WIKI_SHELL.setSidebarActive('Loot', 'Item Finder');
      WIKI.open(id);
    } else if (typeof GUIDE_BOOT !== 'undefined') GUIDE_BOOT.showTab('Loot', 'Item Finder');
  }

  function renderCard(r) {
    return renderCompactCard(r, false);
  }

  function attachAutocomplete(input, onPick) {
    const wrap = input.closest('.ws-hero-search, .ws-search-wrap') || input.parentElement;
    let ac = wrap.querySelector('.ws-ac');
    if (!ac) {
      ac = document.createElement('div');
      ac.className = 'ws-ac';
      wrap.style.position = 'relative';
      wrap.appendChild(ac);
    }
    const pick = id => {
      ac.classList.remove('open');
      if (!id) return;
      if (onPick) onPick(id);
      else if (typeof WIKI !== 'undefined') openItem(id);
    };
    const show = results => {
      if (!results.length) { ac.classList.remove('open'); ac.innerHTML = ''; return; }
      ac.innerHTML = results.slice(0, 12).map(r => {
        const ico = r.id ? iconFor(r.id) : '';
        const sub = r.hasSpawn ? `${r.spawnDirect + r.spawnInferred} loot sources` : (r.summary || 'no loot data');
        return `<div class="ws-ac-item" data-id="${esc(r.id || '')}" data-short="${esc(r.short)}">
          ${ico || '<span style="width:32px;text-align:center">?</span>'}
          <div><div class="t">${esc(r.disp)}</div><div class="m">${esc(sub)}</div></div>
        </div>`;
      }).join('');
      ac.classList.add('open');
      ac.querySelectorAll('.ws-ac-item').forEach(el => {
        el.onclick = () => pick(el.dataset.id || el.dataset.short);
      });
    };
    input.addEventListener('input', () => show(enrichRows(searchLoot(input.value, 12), 12)));
    input.addEventListener('focus', () => { if (input.value.trim()) show(enrichRows(searchLoot(input.value, 12), 12)); });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const hits = searchLoot(input.value, 1).map(enrichRow);
        if (hits[0]?.id) pick(hits[0].id);
      }
      if (e.key === 'Escape') ac.classList.remove('open');
    });
    document.addEventListener('click', e => { if (!wrap.contains(e.target)) ac.classList.remove('open'); });
    return ac;
  }

  const QUICK = ['Iron bar mold', '762x51Box100 M60', '762x51Magazine5 M24', 'Exoskeleton', '556 magazine', 'M60'];

  function buildLootFinderPage() {
    const root = document.createElement('div');
    root.className = 'lf-page';
    root.innerHTML = `
      <div class="ws-hero">
        <h2>Loot Finder</h2>
        <p>Search any item → get <b>which buildings</b>, <b>which containers</b>, and <b>map pins</b> to check. Click a result for the full guide.</p>
        <div class="ws-hero-search">
          <input type="search" id="lf-main-search" placeholder="Iron bar mold, M60 magazine, exoskeleton…" autocomplete="off">
        </div>
        <div class="ws-chips" id="lf-chips"></div>
        <div class="lf-filters" id="lf-filters">
          <button type="button" class="ws-chip on" data-f="all">All results</button>
          <button type="button" class="ws-chip" data-f="spawn">Has loot data</button>
          <button type="button" class="ws-chip" data-f="pins">Has map pins</button>
        </div>
      </div>
      <div class="lf-split">
        <div class="lf-col-results">
          <div class="ws-box">
            <div class="ws-box-h"><span id="lf-result-count">Results</span></div>
            <div class="ws-box-b flush" id="lf-body"></div>
          </div>
        </div>
        <div class="lf-col-detail" id="lf-detail-wrap">
          <div class="ws-box lf-detail-box">
            <div class="ws-box-b" id="lf-detail"></div>
          </div>
        </div>
      </div>`;

    const chips = root.querySelector('#lf-chips');
    for (const c of QUICK) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ws-chip'; b.textContent = c;
      b.onclick = () => {
        const inp = root.querySelector('#lf-main-search');
        inp.value = c; inp.dispatchEvent(new Event('input')); inp.focus();
      };
      chips.append(b);
    }

    const body = root.querySelector('#lf-body');
    const detailEl = root.querySelector('#lf-detail');
    const countEl = root.querySelector('#lf-result-count');
    let view = 'grid';
    let filter = 'all';
    let selectedId = null;
    let lastHits = [];

    const tableHost = document.createElement('div');
    const gridHost = document.createElement('div');
    gridHost.className = 'lf-results lf-compact-grid';

    function applyFilter(hits) {
      if (filter === 'spawn') return hits.filter(h => h.hasSpawn);
      if (filter === 'pins') return hits.filter(h => h.hasPins);
      return hits;
    }

    function selectItem(id) {
      selectedId = id;
      try {
        const guide = id && typeof SPAWN_RESOLVE !== 'undefined' ? SPAWN_RESOLVE.buildItemGuide(id) : null;
        detailEl.innerHTML = renderDetailPanel(guide);
        wireDetailPanel(detailEl, wikiId => openItem(wikiId));
      } catch (err) {
        console.error('Loot guide failed for', id, err);
        detailEl.innerHTML = `<div class="note"><h3>Guide error</h3><div class="prose">Could not build spawn guide. Try the full wiki page.</div></div>`;
      }
      gridHost.querySelectorAll('.lf-card').forEach(c => c.classList.toggle('on', c.dataset.pickId === id));
    }

    function renderResults(q) {
      try {
        const raw = enrichRows(searchLoot(q, 100), 40);
        lastHits = applyFilter(raw);
        countEl.textContent = q ? `${lastHits.length} result${lastHits.length !== 1 ? 's' : ''}` : 'Results — type to search';

        if (!lastHits.length) {
          gridHost.innerHTML = `<div class="lf-empty">${q ? 'No items match.' : 'Type an item name to start.'}</div>`;
          tableHost.innerHTML = '';
          if (!q) detailEl.innerHTML = renderDetailPanel(null);
          return;
        }

        if (view === 'grid') {
          gridHost.innerHTML = lastHits.map(r => renderCompactCard(r, r.id === selectedId)).join('');
          gridHost.querySelectorAll('.lf-card').forEach(el => {
            el.onclick = () => selectItem(el.dataset.pickId);
            el.ondblclick = () => openItem(el.dataset.pickId);
          });
          if (!selectedId || !lastHits.find(h => h.id === selectedId)) selectItem(lastHits[0].id);
        } else {
          const rows = lastHits.map(r => ({
            DisplayName: r.disp, _id: r.id, _src: r.mod, _spots: r.summary, _kind: r.kind,
          }));
          if (typeof lootTableSection === 'function' && typeof tableView === 'function') {
            tableHost.innerHTML = '';
            const tbl = lootTableSection(tableView(rows, [
              { k: 'DisplayName', h: 'Item', cls: 'name', f: row => {
                const id = row._id;
                return id ? `<a href="#" class="ilink" data-lf-pick="${esc(row._id)}">${esc(row.DisplayName)}</a>` : esc(row.DisplayName);
              }},
              { k: '_spots', h: 'Loot sources' },
              { k: '_kind', h: 'Type' },
              { k: '_src', h: 'Mod', cls: 'mod' },
            ]), 'DisplayName', '_tags', '');
            tableHost.append(tbl);
            tbl.querySelectorAll('[data-lf-pick]').forEach(a => {
              a.onclick = e => { e.preventDefault(); selectItem(a.dataset.lfPick); };
            });
          }
        }
      } catch (err) {
        console.error('Loot search failed', err);
        gridHost.innerHTML = `<div class="lf-empty">Search error — check browser console (F12).</div>`;
        countEl.textContent = 'Search error';
      }
    }

    body.append(gridHost);
    detailEl.innerHTML = renderDetailPanel(null);

    const inp = root.querySelector('#lf-main-search');
    attachAutocomplete(inp, id => {
      if (!id) return;
      renderResults(inp.value);
      selectItem(id);
      inp.focus();
    });
    inp.addEventListener('input', () => renderResults(inp.value));
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter' && lastHits[0]?.id) selectItem(lastHits[0].id);
    });

    root.querySelector('#lf-filters').addEventListener('click', e => {
      const b = e.target.closest('button[data-f]');
      if (!b) return;
      filter = b.dataset.f;
      root.querySelectorAll('#lf-filters button').forEach(x => x.classList.toggle('on', x === b));
      renderResults(inp.value);
    });

    renderResults('');

    return root;
  }

  function buildHeroSearch(placeholder) {
    const wrap = document.createElement('div');
    wrap.className = 'ws-hero-search';
    wrap.innerHTML = `<input type="search" placeholder="${esc(placeholder || 'Search loot…')}" autocomplete="off">`;
    attachAutocomplete(wrap.querySelector('input'));
    return wrap;
  }

  window.WIKI_LOOT = {
    buildIndex,
    searchLoot,
    buildLootFinderPage,
    buildHeroSearch,
    attachAutocomplete,
    spawnSummary,
    renderDetailPanel,
    wireDetailPanel,
    QUICK,
  };
})();

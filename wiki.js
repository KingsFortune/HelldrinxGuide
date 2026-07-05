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
    const { title, id, kind, mod, icon, stats, tags } = entity;
    const img = icon
      ? `<img class="wikiicon" src="${icon}" alt="" loading="lazy">`
      : `<div class="wikiicon-ph">${kindEmoji(kind)}</div>`;
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
    const desc = it._desc || it.Tooltip?.replace(/^"|"$/g, '');
    if (desc) h += `<div class="wiki-desc">${esc(desc)}</div>`;
    if (g) h += `<div class="note hot"><h3>Source</h3><div class="prose">${g.t}</div></div>`;
    const q = window.QOL_BY_ID?.get(id);
    if (q?._note) h += `<div class="note hot"><h3>Notes</h3><div class="prose">${q._note}</div></div>`;
    if (q?._where?.length && FN.whereCards) h += FN.whereCards(q._where);
    const sp = FN.mergeSpawns?.(id, window.GUIDE_DETAILS?.spawns) || [];
    if (sp.length && FN.spawnLocHTML) h += FN.spawnLocHTML(sp);
    else if (!g && !q?._where?.length) h += `<div class="dsec">Spawns</div><div class="count">Not in distribution files — crafted, shop, quest, or custom spawn.</div>`;
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

  function vehicleWikiBody(v) {
    let h = `<div class="wiki-desc">${esc(v.display || v.name)} — ${esc(v.mod)}</div>`;
    h += `<div class="statgrid">`;
    const add = (k, val) => { if (val != null && val !== '') h += `<div><b>${esc(k)}</b>${esc(String(val))}</div>`; };
    add('Top speed', v.maxSpeed);
    add('Engine', v.engineForce);
    add('Quality', v.engineQuality);
    add('Seats', v.seats);
    add('Trunk', v.trunk);
    add('Storage', v.storage);
    add('Off-road', v.offRoad);
    add('Mass', v.mass);
    h += '</div>';
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
      add('Seats', v.seats);
      add('Trunk', v.trunk);
      add('Mod', v.mod);
      entity = {
        id, kind, title: v.display || v.name,
        bodyHTML: vehicleWikiBody(v),
        infobox: { title: v.display || v.name, id, kind: 'Vehicle', mod: v.mod, icon: null, stats, tags: null },
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
    if (restoreTab !== false && window.GUIDE_BOOT?.showTab) window.GUIDE_BOOT.showTab(window.GUIDE_BOOT.lastTab || 'Overview');
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

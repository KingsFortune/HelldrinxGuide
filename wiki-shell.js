/**
 * Wiki shell — sidebar nav, homepage, global search
 */
(function () {
  'use strict';

  const NAV = [
    { id: 'Home', label: 'Home', icon: '🏠' },
    { group: 'Loot' },
    { id: 'Loot', sub: 'Item Finder', label: 'Loot Finder', icon: '🔍', hl: true },
    { id: 'Loot', sub: 'Hotspot Rooms', label: 'Hotspot Rooms', icon: '📍' },
    { id: 'Loot', sub: 'Container Pools', label: 'Container Pools', icon: '📦' },
    { id: 'Loot', sub: 'QoL & Tools', label: 'QoL & Tools', icon: '🛠' },
    { group: 'Character' },
    { id: 'Character', sub: 'Build Planner', label: 'Build Planner', icon: '👤' },
    { id: 'Character', sub: 'Melee', label: 'Melee', icon: '⚔' },
    { id: 'Character', sub: 'Gun', label: 'Guns', icon: '🔫' },
    { id: 'Character', sub: 'Clothing', label: 'Clothing', icon: '🧥' },
    { id: 'Character', sub: 'Container', label: 'Containers', icon: '🎒' },
    { group: 'Other' },
    { id: 'Economy', sub: 'Earning HC', label: 'Economy', icon: '💰' },
    { id: 'Vehicles', label: 'Vehicles', icon: '🚗' },
  ];

  function buildSidebar() {
    const el = document.getElementById('wiki-sidebar');
    if (!el) return;
    const itemCount = typeof I !== 'undefined' ? I.length : 0;
    const modCount = typeof GUIDE_DATA !== 'undefined' ? GUIDE_DATA.mods.length : 0;
    el.innerHTML = `
      <div class="ws-brand">
        <h1>HellDrinx</h1>
        <div class="sub">Field guide · ${itemCount.toLocaleString()} items · ${modCount} mods</div>
      </div>
      <nav class="ws-nav" id="wiki-nav"></nav>`;
    const nav = el.querySelector('#wiki-nav');
    let g = null;
    for (const item of NAV) {
      if (item.group) {
        g = document.createElement('div');
        g.className = 'ws-nav-group';
        g.innerHTML = `<div class="ws-nav-label">${item.group}</div>`;
        nav.append(g);
        continue;
      }
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.tab = item.id;
      if (item.sub) b.dataset.sub = item.sub;
      b.className = item.hl ? 'hl' : '';
      b.innerHTML = `<span class="ico">${item.icon}</span>${item.label}`;
      b.onclick = () => navigate(item.id, item.sub);
      (g || nav).append(b);
    }
  }

function setSidebarActive(tab, sub) {
  document.querySelectorAll('#wiki-nav button').forEach(b => {
    const on = tab === 'Home'
      ? b.dataset.tab === 'Home'
      : sub
        ? b.dataset.tab === tab && b.dataset.sub === sub
        : b.dataset.tab === tab && !b.dataset.sub;
    b.classList.toggle('on', on);
  });
}

  function navigate(tab, sub) {
    if (typeof GUIDE_BOOT === 'undefined') return;
    document.body.classList.remove('wiki-mode');
    if (tab === 'Home') {
      GUIDE_BOOT.showHome();
      setSidebarActive('Home');
      return;
    }
    GUIDE_BOOT.showTab(tab, sub);
    setSidebarActive(tab, sub);
    document.getElementById('wiki-sidebar')?.classList.remove('open');
  }

  function buildHomePage() {
    const w = document.createElement('div');
    const quick = (typeof WIKI_LOOT !== 'undefined' ? WIKI_LOOT.QUICK : ['M60 magazine', 'M24 sniper']).map(c =>
      `<button type="button" class="ws-chip" data-q="${esc(c)}">${esc(c)}</button>`).join('');

    w.innerHTML = `
      <div class="ws-hero">
        <h2>Find any loot</h2>
        <p>Search magazines, guns, armor, and tools — see every room and container pool where they spawn, with map coordinates.</p>
        <div id="home-search-slot"></div>
        <div class="ws-chips" id="home-chips">${quick}</div>
      </div>
      <div class="ws-box-h" style="margin-bottom:8px">Browse</div>
      <div class="ws-catgrid" id="home-cats"></div>
      <div class="ws-box">
        <div class="ws-box-h">Map pins</div>
        <div class="ws-box-b"><div class="opstrip" id="home-pins"></div></div>
      </div>`;

    const slot = w.querySelector('#home-search-slot');
    if (typeof WIKI_LOOT !== 'undefined') {
      const hs = WIKI_LOOT.buildHeroSearch('M60 magazine, M24 sniper rifle magazine…');
      slot.append(hs);
    }

    w.querySelectorAll('#home-chips .ws-chip').forEach(chip => {
      chip.onclick = () => {
        const q = chip.dataset.q;
        const inp = w.querySelector('input[type=search]');
        if (inp) { inp.value = q; inp.dispatchEvent(new Event('input')); inp.focus(); }
      };
    });

    const cats = [
      { em: '🔍', nm: 'Loot Finder', tab: 'Loot', sub: 'Item Finder' },
      { em: '📍', nm: 'Hotspot Rooms', tab: 'Loot', sub: 'Hotspot Rooms' },
      { em: '📦', nm: 'Container Pools', tab: 'Loot', sub: 'Container Pools' },
      { em: '⚔', nm: 'Melee', tab: 'Character', sub: 'Melee' },
      { em: '🔫', nm: 'Guns', tab: 'Character', sub: 'Gun' },
      { em: '👤', nm: 'Build Planner', tab: 'Character', sub: 'Build Planner' },
      { em: '💰', nm: 'Economy', tab: 'Economy', sub: 'Earning HC' },
      { em: '🚗', nm: 'Vehicles', tab: 'Vehicles' },
    ];
    const catEl = w.querySelector('#home-cats');
    for (const c of cats) {
      const a = document.createElement('a');
      a.className = 'ws-cat';
      a.href = '#';
      a.innerHTML = `<span class="em">${c.em}</span><span class="nm">${c.nm}</span>`;
      a.onclick = e => { e.preventDefault(); navigate(c.tab, c.sub); };
      catEl.append(a);
    }

    const pins = w.querySelector('#home-pins');
    if (typeof MAP_PINS !== 'undefined' && typeof pinItem === 'function') {
      pins.innerHTML = MAP_PINS.map(g => {
        const hit = pinItem(g);
        return hit ? `<a class="ilink" data-id="${esc(hit._id)}">${esc(g.label)}</a>` : '';
      }).join('');
    }

    return w;
  }

  function initGlobalSearch() {
    const inp = document.getElementById('wiki-global-search');
    if (!inp || typeof WIKI_LOOT === 'undefined') return;
    WIKI_LOOT.attachAutocomplete(inp, id => {
      if (id && typeof WIKI !== 'undefined') {
        document.body.classList.add('wiki-mode');
        WIKI.open(id);
        setSidebarActive('Loot', 'Item Finder');
      }
    });
  }

  function initMenuBtn() {
    const btn = document.getElementById('wiki-menu-btn');
    const sb = document.getElementById('wiki-sidebar');
    if (btn && sb) btn.onclick = () => sb.classList.toggle('open');
  }

  function init() {
    buildSidebar();
    initGlobalSearch();
    initMenuBtn();
  }

  window.WIKI_SHELL = { init, buildHomePage, navigate, setSidebarActive, NAV };
})();

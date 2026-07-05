// Generates index.html — HellDrinx Field Guide SPA with wiki integration
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
const patches = JSON.parse(readFileSync(join(ROOT, 'tools/_replaces.json'), 'utf8'));

// Pull final-state blocks from patches (last neu wins for duplicate old keys)
const finalBlocks = new Map();
for (const p of patches) finalBlocks.set(p.old, p.neu);

function neu(old) {
  return finalBlocks.get(old) ?? old;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HellDrinx Field Guide / Wiki</title>
<meta name="description" content="${SITE.description || 'HellDrinx server guide'}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE.siteName}">
<meta property="og:title" content="HellDrinx Field Guide / Wiki">
<meta property="og:description" content="${SITE.description || ''}">
<meta property="og:url" content="${SITE.siteUrl}">
<meta property="og:image" content="${SITE.siteUrl.replace(/\/$/, '')}/assets/og-default.svg">
<meta name="twitter:card" content="summary">
<style>
:root {
  --bg: #0d0f14; --panel: #151820; --panel2: #1c2030; --text: #d8dce8;
  --dim: #7a8498; --gold: #e8c547; --accent: #c45c5c; --green: #7ee2a0;
  --blue: #6eb5f0; --border: #2a3040;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; }
header { background: var(--panel); border-bottom: 1px solid var(--border); padding: 14px 24px 0; position: sticky; top: 0; z-index: 50; }
header h1 { margin: 0 0 4px; font-size: 22px; color: var(--gold); letter-spacing: 0.5px; }
#genInfo { color: var(--dim); font-size: 12.5px; margin-bottom: 10px; }
nav { display: flex; gap: 4px; flex-wrap: wrap; }
${neu(`  nav button { background: var(--panel); color: var(--dim); border: 1px solid var(--border); border-bottom: none;
    padding: 9px 20px; cursor: pointer; font-size: 14px; border-radius: 8px 8px 0 0; }
  nav button.on { background: var(--panel2); color: var(--gold); font-weight: 600; }`)}
.subnav { display: flex; gap: 8px; flex-wrap: wrap; padding: 12px 24px; background: var(--panel2); border-bottom: 1px solid var(--border); }
${neu(`  .subnav button { background: var(--panel); color: var(--dim); border: 1px solid var(--border); padding: 8px 18px; border-radius: 16px; cursor: pointer; font-size: 13.5px; }
  .subnav button.on { color: var(--bg); background: var(--gold); border-color: var(--gold); font-weight: 600; }`)}
body.wiki-mode .subnav { display: none; }
${neu('  main { padding: 24px 28px 80px; max-width: 1400px; margin: 0 auto; }')}
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { background: var(--panel2); color: var(--gold); padding: 8px 10px; text-align: left; position: sticky; top: 0; cursor: pointer; white-space: nowrap; border-bottom: 2px solid var(--border); }
${neu('  td { padding: 5px 9px; border-bottom: 1px solid #232838; vertical-align: top; }')}
td.name { font-weight: 500; color: #fff; }
td.mod { color: var(--dim); font-size: 12px; }
.count { color: var(--dim); font-size: 12px; }
.badge { font-size: 10px; padding: 1px 7px; border-radius: 8px; background: #3a2818; color: var(--gold); }
.badge.op { background: #1a3328; color: var(--green); }
.arr { font-size: 10px; }
.controls { display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; align-items: center; }
.controls input, .controls select { background: var(--panel2); border: 1px solid var(--border); color: var(--text); padding: 7px 12px; border-radius: 6px; font-size: 13px; }
.controls input { flex: 1; min-width: 180px; }
.sechead { font-size: 17px; font-weight: 600; color: var(--gold); margin: 28px 0 14px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
.sechead:first-child { margin-top: 0; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; margin-bottom: 20px; }
.note { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; }
.note.hot { border-color: var(--gold); background: #1a1810; }
${neu(`  .note h3 { margin: 0 0 8px; color: var(--gold); font-size: 15px; letter-spacing: 0.3px; }`)}
${neu(`  .prose { color: var(--text); }
  .prose b, .prose strong { color: #fff; font-weight: 600; }
  .prose a { color: var(--blue); text-decoration: none; border-bottom: 1px dotted var(--blue); }
  .prose a:hover { color: #8ec5f0; }`)}
a.ilink { color: var(--blue); cursor: pointer; text-decoration: none; border-bottom: 1px dotted var(--blue); }
a.ilink:hover { color: #8ec5f0; }
a.ilink.star::before { content: '★ '; color: var(--gold); }
.opstrip { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
${neu(`  .opstrip a { background: var(--panel2); border: 1px solid var(--gold); color: var(--gold); border-radius: 16px; padding: 6px 14px; font-size: 13px; cursor: pointer; text-decoration: none; }`)}
#dossier { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.75); z-index: 200; overflow: auto; padding: 20px; }
#dossier.open { display: flex; justify-content: center; align-items: flex-start; }
.dcard { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 24px 28px; max-width: 900px; width: 100%; margin: 20px auto; position: relative; max-height: 90vh; overflow: auto; }
${neu(`  .dclose { position: absolute; top: 14px; right: 16px; background: var(--panel2); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 4px 12px; cursor: pointer; }`)}
.dcard h2 { margin: 0 0 8px; color: #fff; font-size: 22px; }
.dmeta { color: var(--dim); font-size: 13px; margin-bottom: 16px; }
.dsec { font-weight: 600; color: var(--gold); margin: 18px 0 8px; font-size: 14px; }
.statgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 6px 16px; font-size: 13px; }
.statgrid b { color: var(--dim); font-weight: 500; margin-right: 6px; }
.loc { display: flex; gap: 10px; padding: 10px 12px; background: var(--panel2); border-radius: 6px; margin-bottom: 8px; border-left: 3px solid var(--gold); }
.pin { font-size: 18px; }
.sub2 { color: var(--dim); font-size: 12.5px; }
.itemgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 6px; }
.itemgrid .cell { display: flex; gap: 8px; align-items: center; padding: 6px 8px; background: var(--panel2); border-radius: 5px; font-size: 13px; min-width: 0; }
.itemgrid .cell img { width: 32px; height: 32px; max-width: 32px; max-height: 32px; object-fit: contain; flex: none; image-rendering: pixelated; }
.itemgrid .cell > div { min-width: 0; overflow: hidden; }
.em { font-size: 16px; }
.rcard { background: var(--panel2); border-radius: 6px; padding: 10px 12px; margin-bottom: 8px; font-size: 13px; line-height: 1.55; }
.rname { font-weight: 600; color: #fff; }
.mod { color: var(--dim); font-size: 12px; }
.chestgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; }
.chestcard { display: flex; gap: 14px; align-items: center; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 14px; cursor: pointer; transition: border-color .15s, transform .1s; }
.chestcard:hover { border-color: var(--gold); }
.chestcard img { width: 48px; height: 48px; max-width: 48px; max-height: 48px; object-fit: contain; flex: none; image-rendering: pixelated; }
.dcard h2 img, .dcard .chest-ico { width: 48px !important; height: 48px !important; max-width: 48px; max-height: 48px; object-fit: contain; vertical-align: middle; margin-right: 10px; image-rendering: pixelated; }
.chestcard .cn { font-weight: 600; color: #fff; }
${neu(`  .chestcard .cmeta { color: var(--dim); font-size: 12.5px; margin-top: 2px; }`)}
.chestcard .cp { margin-left: auto; font-weight: 600; white-space: nowrap; }
${neu(`  .viewall { color: var(--blue); cursor: pointer; font-size: 12px; white-space: nowrap; }
  .viewall:hover { text-decoration: underline; }`)}
ul.tight { margin: 4px 0; padding-left: 18px; }
ul.tight li { margin: 3px 0; }
#toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(80px); background: var(--panel2); border: 1px solid var(--gold); color: var(--gold); padding: 10px 20px; border-radius: 8px; font-size: 13px; opacity: 0; transition: all .25s; z-index: 300; pointer-events: none; }
#toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
tr[data-room], tr[data-pool], tr[data-veh] { cursor: pointer; }
tr[data-room]:hover, tr[data-pool]:hover, tr[data-veh]:hover { background: var(--panel2); }
${neu(`  .rewline { display: block; margin: 2px 0; }
  .rewline.hc { color: var(--green); font-weight: 600; }
  .tagbar { display: flex; gap: 7px; flex-wrap: wrap; margin: 0 0 14px; align-items: center; }
  .tagbar .lbl { color: var(--dim); font-size: 12px; margin-right: 4px; }
  .tagchip { background: var(--panel2); color: var(--dim); border: 1px solid var(--border); padding: 5px 13px; border-radius: 14px; cursor: pointer; font-size: 12px;
    transition: all .15s; user-select: none; }
  .tagchip:hover { border-color: var(--gold); color: var(--gold); }
  .tagchip.on { background: var(--gold); color: var(--bg); border-color: var(--gold); font-weight: 600; }
  .tagchip:active { transform: scale(.97); }
  .ltag { display: inline-block; font-size: 10px; font-weight: 600; padding: 1px 7px; border-radius: 8px; margin: 1px 3px 1px 0; white-space: nowrap; }
  .ltag.smithing { background: #3a2818; color: #e8b86d; }
  .ltag.mechanics { background: #1a2838; color: #8fb8e8; }
  .ltag.reloading { background: #331f1a; color: #ff9c8a; }
  .ltag.medical { background: #1a3328; color: #7ee2a0; }
  .ltag.electrical { background: #2a2a18; color: #e8e568; }
  .ltag.tools { background: #252530; color: #b8b8d0; }
  .ltag.storage { background: #1f2a1f; color: #a8d8a8; }
  .ltag.farming { background: #2a3318; color: #b8e878; }
  .ltag.survival { background: #331a28; color: #e898b8; }`)}
/* Wiki layout */
.wiki-page { animation: fadeIn .22s ease; }
.wikicrumbs { font-size: 13px; color: var(--dim); margin-bottom: 16px; }
.wikicrumbs a { color: var(--blue); text-decoration: none; }
.wikicrumbs a:hover { text-decoration: underline; }
.wikigrid { display: grid; grid-template-columns: 1fr min(300px, 32%); gap: 28px; align-items: start; }
@media (max-width: 860px) { .wikigrid { grid-template-columns: 1fr; } }
.wikibody { min-width: 0; }
.wiki-desc { color: var(--dim); margin-bottom: 16px; font-size: 14px; line-height: 1.6; }
.wikiinfobox { background: var(--panel2); border: 1px solid var(--border); border-radius: 8px; padding: 16px; position: sticky; top: 80px; }
.wikiicon { width: 96px; height: 96px; image-rendering: pixelated; display: block; margin: 0 auto 12px; }
.wikiicon-ph { width: 96px; height: 96px; display: flex; align-items: center; justify-content: center; font-size: 48px; margin: 0 auto 12px; background: var(--panel); border-radius: 8px; }
.ib-title { font-weight: 700; font-size: 16px; color: #fff; text-align: center; margin-bottom: 4px; }
.ib-id { font-size: 11px; color: var(--dim); text-align: center; margin-bottom: 12px; word-break: break-all; }
.ib-table { width: 100%; font-size: 12.5px; }
.ib-table th { background: transparent; color: var(--dim); font-weight: 500; padding: 4px 8px 4px 0; border: none; position: static; cursor: default; }
.ib-table td { padding: 4px 0; border: none; color: var(--text); }
.ib-share { margin-top: 12px; width: 100%; background: var(--panel); border: 1px solid var(--border); color: var(--text); padding: 8px; border-radius: 6px; cursor: pointer; font-size: 12px; }
.ib-share:hover { border-color: var(--gold); color: var(--gold); }
@keyframes fadeIn { from { opacity: .55; transform: translateY(4px); } to { opacity: 1; transform: none; } }
${neu(`  #dossier.open .dcard { animation: dossierIn .2s ease-out; }
  @keyframes dossierIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }`)}
td.wrap { max-width: 340px; white-space: normal; word-break: break-word; line-height: 1.55; }
td.rewards { max-width: 260px; line-height: 1.55; }
</style>
</head>
<body>
<header>
  <h1>HellDrinx Field Guide / Wiki</h1>
  <div id="genInfo"></div>
  <nav id="tabs"></nav>
</header>
<div class="subnav" id="subnav"></div>
<main id="main"></main>
<div id="dossier"><div class="dcard"></div></div>
<div id="toast"></div>
<script src="data.js"></script>
<script src="details.js"></script>
<script src="economy.js"></script>
<script src="vehicles.js"></script>
<script src="rooms.js"></script>
<script src="qol.js"></script>
<script src="pool_locs.js"></script>
<script src="icons.js"></script>
<script>
`;

// JS body — read from companion file to keep generator maintainable
const js = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index_app.js'), 'utf8');

const footer = `
</script>
<script src="wiki.js"></script>
<script>
WIKI.init({
  config: ${JSON.stringify(SITE)},
  icons: typeof GUIDE_ICONS !== 'undefined' ? GUIDE_ICONS : {},
  items: I,
  vehicles: (typeof GUIDE_VEH !== 'undefined' ? GUIDE_VEH.vehicles : []),
});
</script>
</body>
</html>`;

writeFileSync(join(ROOT, 'index.html'), html + js + footer);
console.log('Wrote index.html —', (html + js + footer).length, 'bytes');

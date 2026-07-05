# HellDrinx Wiki

Static wiki for the HellDrinx Project Zomboid server — items, loot spawns, vehicles, economy.

## Local preview

```bash
node tools/serve.mjs
# open http://localhost:8642
```

## Regenerate data (from your PZ install)

Requires workshop + vanilla paths in the parser scripts (`D:/SteamLibrary/...`).

```bash
node tools/parse.mjs
node tools/parse_details.mjs
node tools/parse_pool_locs.mjs
node tools/parse_qol.mjs
node tools/parse_economy.mjs
node tools/parse_vehicles.mjs
node tools/parse_rooms.mjs
```

## Wiki assets (icons + Discord share pages)

1. Edit `site.config.json` — set `siteUrl` to your GitHub Pages URL  
   Example: `https://yourname.github.io/HelldrinxGuide`

2. Build (double-click `tools/build.bat` on Windows, or run):

```bash
node tools/build_wiki.mjs
```

This writes:
- `assets/icons/` — item PNGs copied from game/mod files
- `icons.js` — id → icon path manifest
- `i/{item-slug}/index.html` — Open Graph stubs for Discord embeds
- `v/{vehicle-slug}/index.html` — vehicle share stubs

## GitHub Pages deploy

1. Push this repo to GitHub
2. **Settings → Pages → Build from branch → `main` / root**
3. Run `node tools/build_wiki.mjs` locally before pushing (icons + `i/` pages are large)
4. Optional: add `.gitignore` entry for `assets/icons/` if you prefer CI build later

### Share links

| Type | URL pattern |
|------|-------------|
| Item (Discord) | `https://yoursite.github.io/HelldrinxGuide/i/Base--Katana/` |
| Item (in-app) | `https://yoursite.github.io/HelldrinxGuide/#wiki/item/Base.Katana` |
| Vehicle | `https://yoursite.github.io/HelldrinxGuide/v/M60A3/` |

Discord reads OG tags from the `i/` / `v/` stub pages, then redirects into the SPA.

## Structure

| File | Role |
|------|------|
| `index.html` | Main SPA (tabs + wiki pages) |
| `wiki.js` | Wiki routing, infobox layout, share URLs |
| `icons.js` | Generated icon manifest |
| `data.js` | Gear index |
| `details.js` | Recipes + spawns |
| `qol.js` | Utility items + tags |
| `tools/index_app.js` | App logic source (regenerate with `node tools/gen_index.mjs`) |

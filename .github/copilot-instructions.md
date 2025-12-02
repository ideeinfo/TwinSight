**Repository Overview**

- **Type:** Vue 3 single-page app (Vite) with Autodesk Forge Viewer assets.
- **Entry points:** `index.html` (loads Forge Viewer CDN) and `src/main.js` (mounts Vue App).
- **Model assets:** under `public/models/my-building/` (SVF/manifest files and `output/3d.svf`).
- **Runtime data:** generated CSV at `public/data/room_temperatures.csv` (script: `scripts/generate_csv.js`).

**Big-picture architecture**

- **Frontend app:** `src/` — Vue 3 SFCs using `<script setup>`; main UI pieces are `TopBar`, `LeftPanel`, `MainView`, `RightPanel`, and `BottomChart` in `src/components/`.
- **3D integration:** `MainView.vue` initializes the Autodesk Viewer (reads `MODEL_URL = '/models/my-building/output/3d.svf'`) and implements the room-tag system, material caching, and viewer event handlers.
- **Data flow:** `scripts/generate_csv.js` writes `public/data/room_temperatures.csv`. Chart data in `MainView.vue` is currently synthesized, but CSV is the canonical sample data location.
- **Why structured this way:** static model files are served from `public/` so the Viewer can load them directly; the app simulates IoT/time-series overlays on top of the Viewer instead of streaming real telemetry.

**Key files to inspect when making changes**

- `index.html` — loads the Autodesk Viewer SDK via CDN; network access to this CDN is required at runtime.
- `src/components/MainView.vue` — Viewer init, model path (`MODEL_URL`), room processing (`processRooms`), material caching (`roomFragData`) and tag position updates. Most Forge integration lives here.
- `public/models/my-building/manifest-model.json` and `public/models/my-building/output/3d.svf` — model manifest and geometry consumed by the Viewer.
- `scripts/generate_csv.js` — Node ES module that produces `public/data/room_temperatures.csv`. Run with Node (project `package.json` uses `"type": "module"` so ESM works).
- `package.json` — dev/build scripts: `npm run dev`, `npm run build`, `npm run preview`.

**Project-specific conventions & important patterns**

- Components use Vue 3 `<script setup>` and local `scoped` CSS; follow existing component style and keep reactive state in `ref`/`computed` as shown in `MainView.vue`.
- Viewer material handling: the project caches original fragment materials in `roomFragData[fragId] = fragList.getMaterial(fragId)` and later restores them with `fragList.setMaterial(fragId, original)`. Do NOT set materials to `null` when restoring — pass the original object.
- Resize/refresh pattern: when panels open/close or are resized the code dispatches `window.dispatchEvent(new Event('resize'))` (see `triggerResize()` in the layout) so the Forge Viewer recomputes layout. Keep this when changing panel behavior.
- Model path: change `MODEL_URL` in `src/components/MainView.vue` (constant near top of the file) to point at different `public/models/...` assets.

**Developer workflows (how to build, run, and debug)**

- Install & run dev server:
```powershell
npm install
npm run dev
```
- Build for production:
```powershell
npm run build
npm run preview
```
- Generate sample CSV data (no npm script included; run directly):
```powershell
node scripts/generate_csv.js
```
Note: `package.json` sets `"type": "module"` so `node` can run the ESM script directly.

**Common pitfalls & debugging notes**

- If the Viewer fails to load, check network access to the CDN script included in `index.html` (the viewer SDK is loaded from `developer.api.autodesk.com`).
- Missing model files under `public/models/...` will cause `viewer.loadModel` errors. Confirm the `output/3d.svf` path matches `MODEL_URL`.
- When changing materials or fragment handling, preserve original references — restoring `null` causes rendering issues.
- To force a Viewer layout refresh after DOM-size changes, use the existing `triggerResize()` pattern (it dispatches a `resize` event).

**Examples / quick edits**

- To point the app at a different model: open `src/components/MainView.vue`, update `const MODEL_URL = '/models/your-model/output/3d.svf'` and ensure the files are placed under `public/models/your-model/`.
- To regenerate sample telemetry: run `node scripts/generate_csv.js` and open `public/data/room_temperatures.csv`.
- To inspect the Viewer initialization options, look at the `Autodesk.Viewing.Initializer(...)` call inside `MainView.vue` (it currently uses `env: 'Local'` and `document: null`).

If any of the above pieces are incomplete or you want the instructions expanded with examples (e.g., adding a `npm` script to run the CSV generator or a short debug checklist for Forge Viewer auth/network problems), tell me which area to expand and I'll iterate.

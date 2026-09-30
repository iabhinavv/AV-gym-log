# Workout Log

A workout log book built around a 3D anatomical muscle model. Tap a muscle to see its
exercises ranked best first. Each exercise lists its equipment, a how-to guide and the
other muscles it works. Log sets in a couple of taps.

Plain HTML, CSS and ES modules. There is no build step, no server code and no login.
Data stays in the browser (`localStorage`), with JSON export and import.

## Running it

Serve the folder over HTTP. ES modules and the model file do not load from `file://`.

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

To use it on a phone, host the folder as a static site (for example GitHub Pages) and
use "Add to Home Screen". `sw.js` caches everything for offline use. It is not registered
on localhost, so development never serves stale files.

## Screens

- **Home**: the muscle figure fills the screen. The top-left button opens the menu; the
  top-right plus opens Quick Log.
  - Drag to turn, pinch or scroll to zoom, double-tap empty space to reset the view.
  - Tapping a muscle moves the camera to it and opens its ranked exercise list.
- **Exercise sheet**: has three tabs, Log, Guide and History.
  - The body lights the exercise's muscles: primary red, secondary amber, stabilisers grey.
  - The camera frames those muscles.
- **Journal**: a month calendar. Each day's sets form one session. Session pages allow
  editing and removing sets.
- **Progress**: per exercise, the best set, the estimated one-rep max (Epley: w × (1 + reps/30)),
  an e1RM trend chart, volume per session and the full history.
- **Exercise Library**: search, plus filters by muscle and equipment.
- **Recovery view** (menu switch): tints muscles by recent load.
  - Each primary set counts 1.0 and each secondary set 0.5.
  - Each set fades linearly over 72 hours, and 6 fresh sets count as full.
- **Settings and Backup**: kg/lb (stored in kg), export, import (merge or replace),
  clear all data.

## Files

| Path | What it is |
|---|---|
| `index.html`, `css/app.css` | Shell and styles (dark studio look, no emoji). |
| `js/main.js` | Boot, hash router, drawer, plus button, glue between stage and sheet. |
| `js/viewer.js` | Three.js stage: loads the model, lighting, picking, colour and camera easing. |
| `js/sheets.js` | Bottom sheet (right panel on desktop): muscle, exercise and quick-log views, set logging and editing. |
| `js/store.js` | The `wlog.v1` record; sessions, stats and recovery are derived from the flat list of sets. |
| `js/journal.js`, `js/progress.js`, `js/library.js`, `js/settings.js` | Pages. |
| `js/muscles.js` | The 25 clickable muscle groups: names, anatomy, what they do, camera side. |
| `data/exercises.js` | 119 exercises with muscles and guides, plus `RANKINGS` (the ordered list per muscle). |
| `assets/body.glb` | The processed anatomy model (2 MB, about 200k triangles). |
| `vendor/three/` | three.js r169 and the addons used, kept locally so the app works offline. |
| `tools/build_model.py` | Rebuilds `body.glb` from BodyParts3D. |
| `tools/check_data.py` | Validates exercises against the muscle list and the model. |

## Editing the exercise data

- Each exercise has `p` (primary), `s` (secondary) and `st` (stabiliser) muscle ids from
  `js/muscles.js`.
- A muscle's list shows `RANKINGS[muscle]` in order, then any other exercise that works
  it as a primary mover, then as a secondary mover.
- After editing, run:

```bash
python3 tools/check_data.py
```

It fails if an id is unknown, duplicated or missing from the model. It also fails if a
ranking lists an exercise that doesn't work that muscle, or if a group has fewer than 4
exercises.

## Rebuilding the model

The build uses the per-part STL mirror of BodyParts3D at
github.com/Kevin-Mattheus-Moerman/BodyParts3D. It's used because the official DBCLS
download lacks latissimus dorsi and rectus abdominis.

```bash
python3 -m venv /tmp/wlog-venv && /tmp/wlog-venv/bin/pip install numpy pyfqmr
/tmp/wlog-venv/bin/python tools/build_model.py --cache /tmp/wlog-cache          # dry run: parts and download size
/tmp/wlog-venv/bin/python tools/build_model.py --cache /tmp/wlog-cache --build  # about 740 MB of STL, cached
```

- `GROUPS` in the script maps BodyParts3D part names to muscle groups.
- Node names are `m|<group>|L`, `m|<group>|R`, `ctx|muscle`, `ctx|tendon` and `bone`. The
  separator is `|` because three.js strips `:` `.` `/` `[` `]` from node names.
- Positions are stored as int16 (`KHR_mesh_quantization`), and normals are computed in the
  browser.

If you add or rename a group, update `js/muscles.js` and `data/exercises.js` to match,
then run the check.

## Releasing an update

Bump `VERSION` in `sw.js` whenever any file changes. Otherwise installed phones keep
serving the cached copy.

## Development aids

- `?debug` exposes the viewer as `window.__viewer`.
- `?nogl` forces the flat muscle list shown when WebGL is unavailable.

## Credits

See [CREDITS.md](CREDITS.md). The anatomy is BodyParts3D, (c) The Database Center for
Life Science, CC BY-SA 2.1 JP. three.js is MIT.

## Note for AI assistants

Make minimal changes, keep the no-emoji rule, and update this README when behaviour or
file layout changes. Run `tools/check_data.py` after touching exercises or muscles.

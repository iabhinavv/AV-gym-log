# AV's Gym Log

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
  - The Guide opens with two public-domain photos crossfading on a loop: the start and the
    halfway point where the rep turns around. They come from free-exercise-db, and 107 of the
    119 exercises have them. A photo showing a close variant carries a note saying so.
  - Reps step in halves. A set ending in .5 means the last rep failed partway, and it is
    tagged Failure. Seconds and metres stay whole numbers.
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

## On a laptop

- From 1024 px wide, the pages use two columns:
  - Journal: the calendar and month totals sit beside the session list.
  - Progress: each exercise page puts its charts beside its history, and the list shows a
    trend line per exercise.
  - Library: a sticky filter sidebar sits beside a grid of photo cards.
- The exercise panel widens to 480 px (1280 px screens) and 540 px (1600 px).
- Hovering an exercise in a muscle's list previews its muscles on the model.
- Keyboard: N log a set, / search, J/P/L Journal/Progress/Library, B body, arrows turn the
  body, R reset view, Esc close. The shortcuts are listed at the bottom of the menu on
  screens that have a mouse.

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
| `tools/check_data.py` | Validates exercises against the muscle list and the model, and checks the photos exist. |
| `tools/analyze.py` | Turns an export into report numbers; see Strength reports. |
| `reports/` | Strength report page and its data; see Strength reports. |
| `tools/fetch_images.py` | Downloads and shrinks the exercise photos, and writes `data/exercise-images.js`. Edit its `MAP` to add or fix a photo. |
| `assets/exercises/` | `<id>-0.jpg` (start) and `<id>-1.jpg` (halfway), 600 px wide, about 8 MB in all. The service worker caches each one when it is first viewed. |

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

## Strength reports (every 3 or 6 months)

`reports/report.html` turns an export into a written training review. It covers:
- a 3D strength map with every muscle rated and labelled
- key lifts compared with bodyweight
- strengths and weaknesses, each card showing its muscles on the 3D model
- weekly sets per muscle
- what to change, exercises to add, a weekly plan, and targets for the next report

It opens from the app menu (Strength Reports), and the dropdown at the top switches between
past reports. When there is an earlier report, key lifts and weekly sets show the change
since then.

### For the user

1. In the app, open **Settings and Backup** and press **Export** to download
   `avs-gym-log-YYYY-MM-DD.json`.
2. Ask your AI assistant something like: *"Read Workout Log/README.md and make a strength
   report from ~/Downloads/avs-gym-log-2027-01-15.json. I'm 173 cm, 88 kg, about 22% body fat.
   I train push/pull/legs 4 days a week and do MMA. No injuries."* Include anything that has
   changed: goals, sport, injuries, days available.
3. Open `reports/report.html` from the app menu, or with the local server running, at
   http://localhost:8000/reports/report.html.

### For the AI assistant

Do these steps in order. Don't edit app code to make a report.

1. **Run the numbers.** Use the export path and the profile the user gave you:

   ```bash
   python3 tools/analyze.py <export.json> --height <cm> --weight <kg> --bodyfat <percent>
   ```

   - Add `--since YYYY-MM-DD` to analyse only the period since the last report (its id is
     the last entry in `reports/data/index.js`).
   - This writes `reports/data/<id>.stats.js`, where `<id>` is the date of the last logged
     set. It also adds the id to `reports/data/index.js` and prints a digest: sessions,
     weekly sets per muscle, key lifts against bodyweight, and per-exercise progress and
     failure rates.
   - Never hand-edit the stats file; re-run the script instead.

2. **Read the digest.** If there is a previous report, also read its
   `reports/data/<previous id>.coach.js` and compare: did the user hit the targets, and did
   the weak muscles get more sets?

3. **Write `reports/data/<id>.coach.js`.** Copy the structure of the newest existing coach
   file (`2026-10-15.coach.js` is the reference) and replace every value. The fields are:
   - `profile` holds height, weight, body fat, training split, sport, injuries and goal.
   - `headline` is one sentence. `summary` is one or two paragraphs, separated by a blank
     line.
   - `muscles` needs **every** id from `js/muscles.js`, each with `{ status, note }`. Status
     is one of `strong`, `solid`, `developing`, `weak` or `untrained`. These drive the
     colours and labels on the 3D map. As a guide:
     - **untrained:** 0 sets a week.
     - **weak:** under about 3 sets a week, or clearly lagging strength.
     - **developing:** 3 to 6 sets a week, or machine-only work.
     - **solid:** 6 or more sets a week, progressing.
     - **strong:** good volume *and* a lift that is relatively strong or rising fast.
   - `strengths` and `weaknesses`: 4 to 6 each, as `{ title, muscles: [ids], text,
     evidence }`. `muscles` decides what the card's 3D still shows; leave it empty for a
     whole-body still. `evidence` must quote real numbers from the digest.
   - `improvements` are `{ title, text }` items.
   - `addExercises` are `{ id, day, dose, why }` items. `id` must be an exercise id in
     `data/exercises.js`, which gives the card its photo. `reduce` items are
     `{ title, text }`.
   - `plan` is `{ title, note, days: [{ name, items: [strings] }] }`. It must fit the days
     a week the user actually trains.
   - `mma` (or any sport) is a list of `{ phase, text }`. Leave it out if not relevant.
     `nutrition` is a list of `{ title, text }`.
   - `keyLifts` is keyed by `bench`, `squat`, `deadlift`, `ohp`, `row`, `pulldown` and
     `pullups`, each `{ target, note }`. Add `untested: true` when the only data is a
     warm-up or empty bar.
   - `targets` are `{ label, now, target }` items, the measurable goals for the next report.
   - `logging` lists data-quality notes; `caveats` lists the limits of the analysis.

4. **Write for the user.** Keep the advice specific and grounded:
   - Use their numbers, their split and their sport.
   - No emoji.
   - Use plain words, and spell out any jargon the first time it appears.
   - Training guidance only: no medical claims. Suggest a doctor for anything
     health-related.

5. **Check it.** Serve the folder and open `reports/report.html?r=<id>`:
   - The console must be free of errors.
   - The 3D map should show every muscle coloured.
   - Every strengths, weaknesses and exercise card should have an image.
   - Run `python3 tools/check_data.py` if you touched exercise data.

How the numbers are counted (from `tools/analyze.py`):
- **Hard sets:** every logged set except those whose note contains "warm".
- **Muscle sets:** a set counts 1 for each primary muscle and 0.5 for each secondary one.
- **Rest-pause sets:** a set whose note lists mini-sets (for example "7,4,6") counts as one
  set but is left out of strength estimates.
- **Failure:** a set whose reps end in .5 counts as taken to failure.
- **Estimated one-rep max (e1RM):** uses the Epley formula. Machine or variant lifts are
  converted roughly where they stand in for a barbell lift; `STANDARDS` in the script lists
  the conversions and the bodyweight levels.

Files:

| Path | What it is |
|---|---|
| `reports/report.html`, `report.js`, `report.css` | The report page (one template for every report). |
| `reports/data/index.js` | List of report ids, maintained by the script. |
| `reports/data/<id>.stats.js` | Generated numbers. |
| `reports/data/<id>.coach.js` | Written analysis and advice. |
| `tools/analyze.py` | Export to stats, plus the printed digest. |

The report reuses the app's viewer (`js/viewer.js`). The report page alone uses these viewer
functions: `paint({ colors, glow })`, `snapshot(ids, spec, opts)`, `screenOf(id)` and
`onFrame(fn)`.

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

If you're asked for a strength report or training analysis, follow "Strength reports" above:
run `tools/analyze.py`, then write the coach file. Don't change app code for a report.

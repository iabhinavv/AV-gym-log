# Workout Log — Design Spec

Date: 2026-09-30
Status: approved 2026-09-30, built (see section 12 for where the build differs)

## 1. Intent

A personal workout log book / journal, used mainly on a phone at the gym. The
home page is a 3D anatomical muscle system (inspired by anatomy3datlas.com).
Tapping a muscle group shows the exercises for it, ranked best-first, each with
the equipment it needs, a how-to guide, and the other muscles it works. Any
exercise can be logged from there, or from a plus button on the home page.

Success means: open the app on the phone, tap a muscle, pick a ranked exercise,
read how to do it, log weight x reps, and later review the session in a journal
and the exercise's progress over time.

### What AV asked for
- 3D human muscle system on the home page, each major group clickable
- Smooth animations and transitions
- Exercises per muscle, ranked top-down, with required machine/equipment
- A guide for each exercise
- Other muscle groups hit (e.g. compound movements)
- Log an exercise by clicking it
- Home page minimal: the whole body, a plus icon top-right for adding a log,
  a burger menu top-left
- Real anatomy meshes from BodyParts3D, processed with Python, plain Three.js app
- Dark anatomy-studio look
- Journal features: recovery heat map on the 3D model, progress per exercise,
  sessions and calendar (no rest timer in v1)
- Phone-first, hosted as a static site, data on device with export/import

### Assumptions (open to correction)
- Weights in kg by default, with a kg/lb switch.
- No login, no server, no sync.
- No emoji anywhere. The plus and burger are thin SVG line icons, as asked;
  everything else is labelled with words.

## 2. Architecture

Folder: `Workout Log/`

```
Workout Log/
  index.html              app shell (single page, hash routes)
  manifest.webmanifest    add-to-home-screen
  sw.js                   offline cache of shell, model, vendor
  css/app.css
  js/
    main.js               boot, router, menu, plus button
    viewer.js             Three.js scene: load GLB, pick, highlight, camera tweens, recovery tint
    store.js              localStorage record, versioned; sets/sessions CRUD; export/import
    muscles.js            muscle-group ids, display names, camera focus hints
    sheets.js             bottom-sheet UI: muscle list, exercise detail, log form
    journal.js            calendar + session pages
    progress.js           per-exercise history, best set, e1RM, SVG trend chart
    library.js            browse/search all exercises
  data/exercises.js       exercise library (window.EXERCISES)
  assets/body.glb         processed anatomy model
  vendor/three/           three.module.js, GLTFLoader, OrbitControls (pinned version, local)
  tools/
    build_model.py        BodyParts3D OBJ -> assets/body.glb
    check_data.py         validates exercises.js against muscle ids in the model
  CREDITS.md              BodyParts3D attribution (CC BY-SA 2.1 JP)
  README.md
```

No build step for the app: ES modules loaded directly. Python is only used to
produce `body.glb` once (and to re-run if the grouping changes), inside a
throwaway virtualenv in the session scratchpad.

## 3. The 3D model pipeline (`tools/build_model.py`)

Source: BodyParts3D 4.0, `partof_BP3D_4.0_obj_99.zip` (62 MB) plus
`partof_parts_list_e.txt` and `partof_element_parts.txt` from
dbarchive.biosciencedbc.jp. Downloaded once into the scratchpad, not into the
project.

Steps:
1. Read the parts lists; select skeletal-muscle FMA ids by name.
2. Map each selected part to one of the groups below via an explicit table in
   the script (name patterns -> group id, split left/right by the part name).
3. Merge each group-side into one mesh, decimate (quadric) to a per-group
   triangle budget, recompute smooth normals.
4. Add the skeleton as one merged, heavily decimated, non-clickable mesh for
   context.
5. Convert from BodyParts3D's millimetre Z-up frame to metres Y-up, centred at
   the feet.
6. Write `assets/body.glb` with one named node per group-side
   (`m:<group>:L`, `m:<group>:R`, `bone`). Target under 5 MB total, about
   150k triangles.
7. Print a report: each group, its source part count, triangles, and any
   selected muscle part left unmapped. Unmapped parts are drawn as neutral
   non-clickable muscle so the body still looks complete.

Muscle groups (about 24, all clickable):
upper chest, mid/lower chest, front delts, side delts, rear delts, traps,
lats, upper back (rhomboids/teres), lower back (erectors), biceps, triceps,
forearms, abs (rectus abdominis), obliques, glutes, hip flexors, adductors,
abductors (glute med/TFL), quads, hamstrings, calves, tibialis, neck.

If BodyParts3D does not split a muscle into regions we want (e.g. pectoralis
major into clavicular and sternal heads, or deltoid into three heads), the
script splits that mesh by vertex position along a stated axis. The split planes
live in the same table.

## 4. Screens and behaviour

### Home (the only thing on screen)
- Full-screen dark stage, soft three-point studio lighting, subtle floor
  shadow. The whole muscle figure stands in view and turns slowly until first
  touched.
- Drag to orbit, pinch or scroll to zoom, double-tap empty space to reset view.
- Hovering (desktop) or touching a muscle shows its name in a small label.
- Tapping a muscle:
  - The camera eases (about 600 ms) to face that group.
  - That group brightens and the rest dim.
  - Its left and right sides highlight together.
  - The muscle sheet slides up.
- Top-left: burger icon opens the menu drawer. Top-right: plus icon opens
  Quick Log.
- Nothing else on the home screen.

### Menu drawer (slides in from the left)
- Journal (calendar and sessions)
- Progress (per-exercise)
- Exercise Library (browse and search all)
- Recovery view (on/off switch; tints the model)
- Settings and Backup (units, export, import, clear data)
- About and Credits (BodyParts3D attribution, how to use)

### Muscle sheet (bottom sheet, draggable between half and full height)
- Muscle name and a one-line description of its function.
- Ranked exercise list, #1 first. Each row shows:
  - the exercise name
  - an equipment tag, e.g. Barbell, Cable, Machine: Pec Deck
  - a line reading "Also works:" followed by the other muscles as small
    tappable tags. Tapping a tag moves the model to that muscle.
- Tapping a row opens the Exercise sheet.

### Exercise sheet
- Name, equipment/machine, rank for the current muscle.
- Muscles worked: primary, secondary, stabilisers. A small inset view of the
  model lights these at three intensities.
- Guide: setup, numbered execution steps, common mistakes, breathing cue.
- Log panel:
  - weight and reps fields, pre-filled from the last set of this exercise
  - an optional note
  - a Log set button, with a short confirmation animation after each set
  - the sets logged today for this exercise, each editable and removable
- A link to this exercise's progress page.

### Quick Log (plus button)
- A search field over all exercises, plus a "recent" list.
- Picking an exercise opens the same log panel as the Exercise sheet.

### Journal
- A month calendar. Days with a session are shaded by total volume.
- Tapping a day opens that session: exercises in order, sets, volume, the
  first-to-last set time span, and notes.
- Sets can be edited and deleted there.
- A session is defined as all sets logged on the same local calendar day.

### Progress
- A list of exercises you have logged, most recent first.
- Exercise page:
  - best set (heaviest weight, then most reps)
  - estimated one-rep max, using Epley: w x (1 + reps/30)
  - volume per session
  - an SVG line chart of e1RM over time
  - the full set history

### Recovery view
- Each muscle group gets a fatigue score of 1.0 per primary set and 0.5 per
  secondary set, decaying linearly to zero over 72 hours from each set.
- The score is capped, then drawn as a warm-to-cool tint on the model.
- A small legend shows while the view is on.

### Exercise Library
- Muscle filter chips, equipment filter, and search. Tapping an exercise opens
  the Exercise sheet.

## 5. Exercise data (`data/exercises.js`)

About 120 to 150 exercises. Each entry:

```js
{
  id: 'barbell-bench-press',
  name: 'Barbell Bench Press',
  equipment: 'Barbell + flat bench',
  category: 'compound',            // compound | isolation
  muscles: {
    primary:    ['chest-mid'],
    secondary:  ['delts-front', 'triceps', 'chest-upper'],
    stabilisers:['lats', 'abs']
  },
  rank: { 'chest-mid': 1 },        // position in each muscle's list
  guide: {
    setup: '...',
    steps: ['...', '...'],
    mistakes: ['...'],
    breathing: '...'
  }
}
```

Every group lists its exercises by `rank`. An exercise appears in a group's list
if that group is primary or secondary for it. Where no explicit rank exists,
primary-muscle exercises come after all ranked ones, then secondary ones.
Rankings favour the exercises that load the target muscle best in a full range
of motion and are practical in a commercial gym; the ordering is editorial and
is written as such in About.

`tools/check_data.py` fails if any exercise references a muscle id that is not
a node in `body.glb`. It also fails if a group has fewer than 4 exercises, or if
ids are duplicated.

## 6. Storage

- One localStorage key `wlog.v1` holding
  `{ version, units, sets: [{id, exId, ts, weight, reps, note}] }`.
- Sessions, progress and recovery are all derived from `sets`; nothing is
  stored twice.
- Weights are stored in kg; the unit setting only changes display and input.
- Export downloads `workout-log-YYYY-MM-DD.json`.
- Import validates the shape, then either merges (sets matched by `id`) or
  replaces, whichever you choose. Replace needs confirmation.
- A gentle "last backup N days ago" line appears in Settings.
- If localStorage is unavailable, the app runs in memory and shows a warning
  banner.

## 7. Visual design

- Near-black stage, `#0B0D10` to `#15181D`, with a vignette.
- Muscles use a fleshy red material with a faint fibre normal texture that is
  generated in code, not downloaded.
- Bone is ivory at low opacity.
- Highlight: a warmer, brighter red with a rim glow. Dimmed groups drop to about
  35% brightness.
- UI surfaces are translucent dark panels with hairline borders.
- Type: serif for headings, clean sans for numbers and forms, small caps for
  labels.
- There's a single accent colour for actions.
- No emoji. The only icons are the burger and the plus, drawn as thin SVG
  strokes.
- Motion: bottom sheets and the drawer use about 280 ms ease-out. Camera moves
  use about 600 ms ease-in-out, and respect `prefers-reduced-motion` by cutting
  instead of easing.
- Phone-first layout. On desktop, sheets become a right-hand side panel so the
  model stays visible.

## 8. Error handling

- If the model fails to load or WebGL is unavailable, the home page shows a flat
  list of muscle groups in its place. Everything else still works.
- Log form: weight must be 0 or more, reps a whole number of 1 or more. Invalid
  input is refused with an inline message and nothing is written.
- Import with a bad file: an error message, and the existing data is untouched.

## 9. Testing

- `tools/check_data.py` for data integrity.
- Browser preview checks at 375x812 and desktop:
  - Each muscle group is pickable and highlights both sides.
  - The camera tween and sheet open and close.
  - Log, edit and delete a set.
  - The journal calendar and a session page.
  - The progress chart.
  - The recovery tint.
  - An export then import round trip.
  - The WebGL-off fallback.
- Check load size and frame rate on the phone-size viewport.

## 10. Out of scope for v1

Rest timer, cloud sync or login, workout templates or programmes, body weight
tracking, female anatomy model.

## 11. Licensing

BodyParts3D, (c) The Database Center for Life Science, licensed under CC BY-SA
2.1 Japan. `body.glb` is a derivative, so it carries the same licence, with
credit in CREDITS.md and the About screen. Three.js is MIT.

## 12. Implementation notes (differences from the plan above)

- **Model source:** meshes come from the per-part STL mirror of BodyParts3D
  (github.com/Kevin-Mattheus-Moerman/BodyParts3D, v3.0), not the DBCLS zip. The official
  4.0 download has no latissimus dorsi and no rectus abdominis, and it downloaded at about
  15 KB/s. Same data and the same licence.
- **Groups:** there are 25 groups; serratus was added. Deltoid heads and pec heads come
  split in the source, so no plane splitting was needed.
- **Node names:** nodes use `m|group|L`, not `m:group:L`, because three.js strips `:` from
  node names.
- **Rankings:** these live in one `RANKINGS` table in `data/exercises.js` instead of a
  `rank` field on each exercise.
- **Exercise sheet:** the main 3D model lights the exercise's muscles and the camera frames
  them. There's no separate inset viewer, since a second WebGL view would cost too much on
  phones. Opening an exercise from a page hides the page behind the sheet until it closes.
- **Sheet history:** the phone Back button does not close sheets. The sheet has its own
  Back and Close buttons, and Escape. Mixing history entries with hash routes made closes
  undo navigations.
- **Timed and distance exercises:** plank, side plank, dead hang and Copenhagen plank log
  seconds. The carries and heel walk log metres.
- **Fibre texture:** the fibre normal texture was dropped. The meshes have no UVs, and the
  sculpted BodyParts3D surfaces already read as muscle.

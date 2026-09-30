// The journal record. One localStorage key; everything else (sessions, progress, recovery)
// is derived from the flat list of sets. Weights are always stored in kg.
import { EX, dayKey, volume, e1rm } from './lib.js';

const KEY = 'wlog.v1';
const listeners = new Set();
let db = blank();
let persistent = true;

function blank() { return { version: 1, units: 'kg', recovery: false, lastBackup: null, sets: [] }; }

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) db = { ...blank(), ...JSON.parse(raw) };
    localStorage.setItem(KEY + '.probe', '1');
    localStorage.removeItem(KEY + '.probe');
  } catch {
    persistent = false;
  }
  db.sets.sort((a, b) => a.ts - b.ts);
  return persistent;
}
export const isPersistent = () => persistent;

function save() {
  if (persistent) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { persistent = false; }
  }
  listeners.forEach(fn => fn());
}
export const onChange = fn => (listeners.add(fn), () => listeners.delete(fn));

export const get = k => db[k];
export function setPref(k, v) { db[k] = v; save(); }

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Rep counts may end in .5: a half rep marks the set as taken to failure.
// Seconds and metres stay whole numbers.
export function validSet(w, r, measure = 'reps') {
  if (!Number.isFinite(w) || w < 0 || w > 2000) return 'Weight must be 0 or more.';
  if (measure === 'reps') {
    if (!Number.isInteger(r * 2) || r < 0.5 || r > 1000) return 'Reps must be 0.5 or more, in steps of 0.5.';
  } else if (!Number.isInteger(r) || r < 1 || r > 100000) return 'Enter a whole number of 1 or more.';
  return null;
}
export const isFailure = s => s.r % 1 === 0.5;

export function addSet(ex, w, r, note) {
  const s = { id: uid(), ex, ts: Date.now(), w, r };
  if (note) s.note = note;
  db.sets.push(s);
  save();
  return s;
}
export function updateSet(id, patch) {
  const s = db.sets.find(x => x.id === id);
  if (!s) return;
  Object.assign(s, patch);
  if (!s.note) delete s.note;
  save();
}
export function deleteSet(id) {
  db.sets = db.sets.filter(x => x.id !== id);
  save();
}

// ------------------------------------------------------------ derived views
export const allSets = () => db.sets;
export const setsFor = ex => db.sets.filter(s => s.ex === ex);
export const lastSetFor = ex => { for (let i = db.sets.length - 1; i >= 0; i--) if (db.sets[i].ex === ex) return db.sets[i]; return null; };
export const setsOnDay = k => db.sets.filter(s => dayKey(s.ts) === k);

export function byDay() {
  const m = new Map();
  for (const s of db.sets) {
    const k = dayKey(s.ts);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(s);
  }
  return m;
}

export function session(sets) {
  const exOrder = [];
  const byEx = new Map();
  for (const s of sets) {
    if (!byEx.has(s.ex)) { byEx.set(s.ex, []); exOrder.push(s.ex); }
    byEx.get(s.ex).push(s);
  }
  const vol = sets.reduce((a, s) => a + volume(s), 0);
  const span = sets.length > 1 ? sets[sets.length - 1].ts - sets[0].ts : 0;
  const muscles = new Set();
  exOrder.forEach(id => EX[id]?.p.forEach(m => muscles.add(m)));
  return { exOrder, byEx, vol, span, muscles: [...muscles], count: sets.length };
}

// Per exercise: best set (heaviest weight, then most reps), best estimated 1RM, sessions.
export function exerciseStats(ex) {
  const sets = setsFor(ex);
  let best = null, bestE = 0;
  const days = new Map();
  for (const s of sets) {
    if (!best || s.w > best.w || (s.w === best.w && s.r > best.r)) best = s;
    bestE = Math.max(bestE, e1rm(s.w, s.r));
    const k = dayKey(s.ts);
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(s);
  }
  const series = [...days].map(([k, ss]) => ({
    k,
    e1rm: Math.max(...ss.map(s => e1rm(s.w, s.r))),
    top: Math.max(...ss.map(s => s.r)),
    vol: ss.reduce((a, s) => a + volume(s), 0),
    sets: ss,
  }));
  return { sets, best, bestE, series, last: sets[sets.length - 1] || null };
}

// Fatigue per muscle group: 1.0 per primary set, 0.5 per secondary set, each fading
// linearly to zero over 72 hours. Returned as 0..1 intensity (6 fresh sets = full).
export const RECOVERY_HOURS = 72;
export function recoveryScores(now = Date.now()) {
  const win = RECOVERY_HOURS * 3600e3;
  const score = {};
  for (let i = db.sets.length - 1; i >= 0; i--) {
    const s = db.sets[i];
    const age = now - s.ts;
    if (age > win) break;
    const ex = EX[s.ex];
    if (!ex || age < 0) continue;
    const f = 1 - age / win;
    ex.p.forEach(m => (score[m] = (score[m] || 0) + f));
    ex.s.forEach(m => (score[m] = (score[m] || 0) + 0.5 * f));
  }
  for (const k in score) score[k] = Math.min(1, score[k] / 6);
  return score;
}

// ------------------------------------------------------------ backup
export function exportData() {
  db.lastBackup = Date.now();
  save();
  const blob = new Blob([JSON.stringify({ app: 'avs-gym-log', ...db }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `avs-gym-log-${dayKey(Date.now())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function parseImport(text) {
  let d;
  try { d = JSON.parse(text); } catch { throw new Error('That file is not valid JSON.'); }
  if (!d || !Array.isArray(d.sets)) throw new Error('That file is not a gym log backup.');
  const sets = d.sets.filter(s => s && typeof s.id === 'string' && typeof s.ex === 'string'
    && Number.isFinite(s.ts) && Number.isFinite(s.w) && Number.isFinite(s.r));
  if (sets.length !== d.sets.length) throw new Error(`${d.sets.length - sets.length} sets in that file are malformed; nothing was imported.`);
  return { sets, units: d.units === 'lb' ? 'lb' : 'kg' };
}
export function importData(parsed, mode) {
  if (mode === 'replace') {
    db.sets = parsed.sets.slice();
    db.units = parsed.units;
  } else {
    const have = new Set(db.sets.map(s => s.id));
    parsed.sets.forEach(s => { if (!have.has(s.id)) db.sets.push(s); });
  }
  db.sets.sort((a, b) => a.ts - b.ts);
  save();
}
export function clearAll() {
  const units = db.units;
  db = { ...blank(), units };
  save();
}

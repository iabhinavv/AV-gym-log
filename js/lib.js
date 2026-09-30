// Exercise lookups, formatting and small DOM helpers shared by every view.
import { EXERCISES, RANKINGS } from '../data/exercises.js';
import { MUSCLE } from './muscles.js';

export const EX = Object.fromEntries(EXERCISES.map(e => [e.id, e]));

// Timed and distance exercises log seconds or metres instead of reps.
const MEASURE = {
  'plank': 'sec', 'side-plank': 'sec', 'dead-hang': 'sec', 'copenhagen-plank': 'sec',
  'farmers-carry': 'm', 'suitcase-carry': 'm', 'heel-walk': 'm', 'banded-lateral-walk': 'reps',
};
export const measure = ex => MEASURE[ex.id] || 'reps';
export const measureLabel = ex => ({ reps: 'Reps', sec: 'Seconds', m: 'Metres' })[measure(ex)];
export const measureUnit = ex => ({ reps: '', sec: 's', m: 'm' })[measure(ex)];

export function roleOf(ex, muscleId) {
  if (ex.p.includes(muscleId)) return 'p';
  if (ex.s.includes(muscleId)) return 's';
  if (ex.st.includes(muscleId)) return 'st';
  return null;
}
export const ROLE_NAME = { p: 'Primary', s: 'Secondary', st: 'Stabiliser' };

// Ranked list for a muscle: the editorial ranking first, then any other exercise that
// hits it as a primary mover, then as a secondary mover.
export function rankedFor(muscleId) {
  const ranked = (RANKINGS[muscleId] || []).map(id => EX[id]).filter(Boolean);
  const seen = new Set(ranked.map(e => e.id));
  const rest = EXERCISES.filter(e => !seen.has(e.id) && roleOf(e, muscleId) === 'p')
    .concat(EXERCISES.filter(e => !seen.has(e.id) && roleOf(e, muscleId) === 's'));
  return ranked.concat(rest).map((ex, i) => ({ ex, rank: i + 1, role: roleOf(ex, muscleId) }));
}

export const musclesOf = ex => [...ex.p, ...ex.s, ...ex.st];
export const muscleName = id => MUSCLE[id]?.name || id;

export function equipKind(ex) {
  const e = ex.equipment.toLowerCase();
  if (e.startsWith('machine') || e.includes('smith')) return 'Machine';
  if (e.includes('cable')) return 'Cable';
  if (e.includes('barbell') || e.includes('ez bar')) return 'Barbell';
  if (e.includes('dumbbell') || e.includes('kettlebell')) return 'Dumbbell';
  if (e.includes('band')) return 'Band';
  if (e.includes('bodyweight') || e.includes('pull-up bar') || e.includes('dip station') || e.includes('wall')) return 'Bodyweight';
  return 'Other';
}
export const EQUIP_KINDS = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Band', 'Other'];

// ------------------------------------------------------------ numbers and units
const LB = 2.2046226218;
export function toDisplayW(kg, units) {
  const v = units === 'lb' ? kg * LB : kg;
  return Math.round(v * 10) / 10;
}
export function fromDisplayW(v, units) { return units === 'lb' ? v / LB : v; }
export function fmtW(kg, units) {
  if (!kg) return 'BW';
  return `${trim(toDisplayW(kg, units))} ${units}`;
}
export function trim(n) { return String(Math.round(n * 10) / 10).replace(/\.0$/, ''); }
export function fmtSet(s, ex, units) {
  const m = measure(ex);
  if (m === 'reps') return `${fmtW(s.w, units)} × ${s.r}`;
  const amt = `${s.r} ${measureUnit(ex)}`;
  return s.w ? `${fmtW(s.w, units)} · ${amt}` : amt;
}
export const e1rm = (w, r) => (w > 0 && r > 0 ? (r === 1 ? w : w * (1 + r / 30)) : 0); // Epley
export const volume = s => (s.w || 0) * (s.r || 0);
export function fmtVol(kg, units) {
  const v = toDisplayW(kg, units);
  return v >= 10000 ? `${trim(v / 1000)}k` : String(Math.round(v));
}

// ------------------------------------------------------------ dates
export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function keyToDate(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function fmtDay(k, withYear) {
  const d = keyToDate(k);
  const y = withYear || d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${d.getDate()} ${MON[d.getMonth()]}${y}`;
}
export function fmtDayLong(k) {
  const d = keyToDate(k);
  return `${DOW[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
export function fmtTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function fmtSpan(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return 'under 1 min';
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}
export function relDay(k) {
  const today = dayKey(Date.now());
  const diff = Math.round((keyToDate(today) - keyToDate(k)) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  return fmtDay(k);
}

// ------------------------------------------------------------ DOM
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

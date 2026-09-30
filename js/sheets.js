// The sheet: a bottom sheet on phones, a right-hand panel on desktop. It holds a small
// stack of views (muscle -> exercise -> muscle ...) with Back and Close.
import { MUSCLE, MUSCLES } from './muscles.js';
import { EXERCISES } from '../data/exercises.js';
import * as store from './store.js';
import {
  EX, rankedFor, roleOf, ROLE_NAME, muscleName, measure, measureLabel, measureUnit, equipKind,
  toDisplayW, fromDisplayW, fmtSet, fmtW, trim, e1rm, dayKey, fmtDay, relDay, fmtTime, esc, $, $$, toast,
} from './lib.js';
import { RANKINGS } from '../data/exercises.js';

const sheet = $('#sheet'), body = $('#sheet-body'), kicker = $('#sheet-kicker');
const btnBack = $('#sheet-back'), btnClose = $('#sheet-close'), grip = $('#sheet-grip');
const desktop = matchMedia('(min-width: 900px)');

let stack = [];
let hooks = {};
let height = 'half';         // phone only: 'half' | 'full'

export function initSheets(h) {
  hooks = h;
  btnClose.addEventListener('click', () => close());
  btnBack.addEventListener('click', back);
  addEventListener('keydown', e => { if (e.key === 'Escape' && stack.length && !document.querySelector('.drawer.open')) close(); });
  store.onChange(() => { if (stack.length && top().type !== 'quick') refreshLogPanel(); });
  initGrip();
  desktop.addEventListener('change', () => reportInsets());
}

export const top = () => stack[stack.length - 1];
export const isOpen = () => stack.length > 0;

export function open(view, { replace = false, fresh = false } = {}) {
  if (fresh) stack = [];
  if (replace && stack.length) stack[stack.length - 1] = view;
  else stack.push(view);
  if (stack.length === 1) height = view.type === 'quick' ? 'full' : 'half';
  render();
}

export function back() {
  if (stack.length > 1) { stack.pop(); render(true); }
  else close();
}

export function close() {
  if (!stack.length) return;
  stack = [];
  render();
}

function setHeight(h) { height = h; sheet.style.setProperty('--sheet-h', h === 'full' ? 92 : 58); reportInsets(); }

function reportInsets() {
  const openNow = stack.length > 0;
  if (!openNow) return hooks.onInsets?.({ bottom: 0, right: 0 });
  if (desktop.matches) return hooks.onInsets?.({ bottom: 0, right: sheet.offsetWidth + 28 });
  const h = (height === 'full' ? 0.92 : 0.58) * innerHeight;
  hooks.onInsets?.({ bottom: height === 'full' ? innerHeight * 0.5 : h });
}

function render(back = false) {
  const v = top();
  sheet.classList.toggle('open', !!v);
  sheet.setAttribute('aria-hidden', v ? 'false' : 'true');
  if (!v) { reportInsets(); hooks.onChange?.(null); return; }
  setHeight(height);
  btnBack.hidden = stack.length < 2;
  const html = v.type === 'muscle' ? muscleView(v) : v.type === 'exercise' ? exerciseView(v) : quickView(v);
  body.innerHTML = `<div class="view${back ? ' back' : ''}">${html}</div>`;
  body.scrollTop = 0;
  bind(v);
  hooks.onChange?.(v);
}

// ------------------------------------------------------------ muscle view
function muscleView(v) {
  const m = MUSCLE[v.id];
  kicker.textContent = m.region;
  const list = rankedFor(v.id);
  const ranked = new Set(RANKINGS[v.id] || []);
  const score = store.recoveryScores()[v.id] || 0;
  const lastHit = lastTrained(v.id);
  const units = store.get('units');
  const rows = [];
  let dividerShown = false;
  for (const { ex, rank } of list) {
    if (!ranked.has(ex.id) && !dividerShown) {
      rows.push(`<li class="divider-label label">Also trains ${esc(m.name.toLowerCase())}</li>`);
      dividerShown = true;
    }
    const others = [...ex.p, ...ex.s].filter(x => x !== v.id);
    const last = store.lastSetFor(ex.id);
    rows.push(`<li class="ex-row${rank <= 3 && ranked.has(ex.id) ? ' top' : ''}" data-ex="${ex.id}" tabindex="0">
      <span class="rank">${ranked.has(ex.id) ? rank : ''}</span>
      <span class="name">${esc(ex.name)}</span>
      <span class="meta"><span class="tag equip">${esc(shortEquip(ex))}</span>
        <span class="tag role"><span class="dot ${roleOf(ex, v.id)}"></span>${ROLE_NAME[roleOf(ex, v.id)]}</span></span>
      ${others.length ? `<span class="also">Also works ${others.map(o => `<button class="tag" data-muscle="${o}">${esc(muscleName(o))}</button>`).join('')}</span>` : ''}
      ${last ? `<span class="last">Last: ${esc(fmtSet(last, ex, units))}, ${esc(relDay(dayKey(last.ts)).toLowerCase())}</span>` : ''}
    </li>`);
  }
  return `<div class="m-head">
      <h2>${esc(m.name)}</h2>
      <div class="anat">${esc(m.anat)}</div>
      <p class="job">${esc(m.job)}</p>
      ${lastHit ? `<div class="stat">Last trained <b>${esc(relDay(lastHit).toLowerCase())}</b>${score > 0.05 ? ` · recovery load <b>${Math.round(score * 100)}%</b>` : ''}</div>` : ''}
    </div>
    <div class="label" style="margin-bottom:6px">Exercises, best first</div>
    <ul class="ex-list">${rows.join('')}</ul>`;
}

function lastTrained(muscleId) {
  const sets = store.allSets();
  for (let i = sets.length - 1; i >= 0; i--) {
    const ex = EX[sets[i].ex];
    if (ex && (ex.p.includes(muscleId) || ex.s.includes(muscleId))) return dayKey(sets[i].ts);
  }
  return null;
}

function shortEquip(ex) {
  const e = ex.equipment;
  if (e.startsWith('Machine: ')) return 'Machine: ' + e.slice(9).split(/[,(]/)[0].trim();
  return e.split(/[,(]/)[0].trim();
}

// ------------------------------------------------------------ exercise view
function exerciseView(v) {
  const ex = EX[v.id];
  kicker.textContent = ex.type === 'compound' ? 'Compound' : 'Isolation';
  const tab = v.tab || (v.from === 'quick' || store.lastSetFor(ex.id) ? 'log' : 'guide');
  v.tab = tab;
  const roleRows = [['p', ex.p], ['s', ex.s], ['st', ex.st]].filter(([, ids]) => ids.length).map(([r, ids]) =>
    `<div class="worked-row"><span class="label" style="padding-top:4px"><span class="dot ${r}"></span> ${ROLE_NAME[r]}</span>
      <span class="chips">${ids.map(id => `<button class="tag" data-muscle="${id}">${esc(muscleName(id))}</button>`).join('')}</span></div>`).join('');
  return `<div class="x-head">
      <h2>${esc(ex.name)}</h2>
      <div class="equip-line"><span class="tag equip">${esc(equipKind(ex))}</span> ${esc(ex.equipment)}</div>
    </div>
    <div class="label" style="margin-bottom:8px">Muscles worked</div>
    <div class="worked">${roleRows}</div>
    <div class="seg" role="tablist">
      ${['log', 'guide', 'history'].map(t => `<button role="tab" data-tab="${t}" aria-selected="${t === tab}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}
    </div>
    <div id="tab-body">${tabBody(ex, tab)}</div>`;
}

function tabBody(ex, tab) {
  if (tab === 'guide') return guideHTML(ex);
  if (tab === 'history') return historyHTML(ex);
  return logHTML(ex);
}

function guideHTML(ex) {
  const ranks = Object.entries(RANKINGS).filter(([, ids]) => ids.includes(ex.id))
    .map(([m, ids]) => `#${ids.indexOf(ex.id) + 1} for ${muscleName(m)}`);
  return `<div class="guide">
    ${ranks.length ? `<p style="font-size:13px">Ranked ${esc(ranks.join(', '))}.</p>` : ''}
    <h4 class="label">Setup</h4><p>${esc(ex.setup)}</p>
    <h4 class="label">How to do it</h4><ol>${ex.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    <h4 class="label">Common mistakes</h4><ul>${ex.mistakes.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    <h4 class="label">Breathing</h4><p>${esc(ex.breathe)}</p>
  </div>`;
}

function historyHTML(ex) {
  const st = store.exerciseStats(ex.id), units = store.get('units');
  if (!st.sets.length) return `<p class="empty">No sets logged yet. Log one on the Log tab and it will show here.</p>`;
  const m = measure(ex);
  const recent = st.series.slice(-6).reverse();
  return `<div class="tiles">
      <div class="tile"><div class="v">${esc(fmtSet(st.best, ex, units))}</div><div class="k">Best set</div></div>
      ${m === 'reps' && st.bestE ? `<div class="tile"><div class="v">${trim(toDisplayW(st.bestE, units))}<small>${units}</small></div><div class="k">Est. 1RM</div></div>` : ''}
      <div class="tile"><div class="v">${st.series.length}</div><div class="k">Sessions</div></div>
    </div>
    <ul class="plain-list">${recent.map(d => `<li data-day="${d.k}"><span>${esc(fmtDay(d.k))}<div class="sub">${d.sets.map(s => esc(fmtSet(s, ex, units))).join(', ')}</div></span></li>`).join('')}</ul>
    <button class="btn block" data-go="#/progress/${ex.id}">Full progress and chart</button>`;
}

function defaults(ex) {
  const last = store.lastSetFor(ex.id);
  if (last) return { w: last.w, r: last.r };
  const kind = equipKind(ex), m = measure(ex);
  return { w: kind === 'Barbell' ? 20 : 0, r: m === 'sec' ? 30 : m === 'm' ? 20 : 8 };
}

function logHTML(ex) {
  const units = store.get('units'), d = defaults(ex), m = measure(ex);
  const today = store.setsOnDay(dayKey(Date.now())).filter(s => s.ex === ex.id);
  const prev = previousSession(ex.id);
  return `<div class="log-form" data-ex="${ex.id}">
      <div class="fields">
        <div class="field"><span class="label">Weight (${units})${equipKind(ex) === 'Bodyweight' ? ', added' : ''}</span>
          <div class="stepper"><button type="button" data-step="w" data-d="-1" aria-label="Less weight">&minus;</button>
          <input id="in-w" type="number" inputmode="decimal" step="any" min="0" value="${trim(toDisplayW(d.w, units))}">
          <button type="button" data-step="w" data-d="1" aria-label="More weight">+</button></div></div>
        <div class="field"><span class="label">${measureLabel(ex)}</span>
          <div class="stepper"><button type="button" data-step="r" data-d="-1" aria-label="Less">&minus;</button>
          <input id="in-r" type="number" inputmode="numeric" step="1" min="1" value="${d.r}">
          <button type="button" data-step="r" data-d="1" aria-label="More">+</button></div></div>
      </div>
      <textarea id="in-note" class="note-input" rows="1" placeholder="Note (optional)"></textarea>
      <div class="form-err" id="log-err" role="alert"></div>
      <button class="btn primary block" id="btn-log">Log set</button>
    </div>
    <div class="label" style="margin-top:18px">Today</div>
    <ul class="sets" id="today-sets">${today.length ? today.map((s, i) => setRow(s, ex, i + 1)).join('') : '<li class="empty">No sets yet today.</li>'}</ul>
    ${prev ? `<p class="lasttime">Last time, ${esc(fmtDay(prev.k))}: <b>${prev.sets.map(s => esc(fmtSet(s, ex, units))).join(', ')}</b></p>` : ''}
    ${m !== 'reps' ? `<p class="lasttime">${measureLabel(ex)} are logged in ${measureUnit(ex) === 's' ? 'seconds' : 'metres'}; weight can be 0.</p>` : ''}`;
}

function previousSession(exId) {
  const today = dayKey(Date.now());
  const sets = store.setsFor(exId).filter(s => dayKey(s.ts) !== today);
  if (!sets.length) return null;
  const k = dayKey(sets[sets.length - 1].ts);
  return { k, sets: sets.filter(s => dayKey(s.ts) === k) };
}

export function setRow(s, ex, n, editing = false) {
  const units = store.get('units');
  if (editing) return `<li class="set-row" data-set="${s.id}"><div class="set-edit">
      <input data-f="w" type="number" inputmode="decimal" step="any" min="0" value="${trim(toDisplayW(s.w, units))}" aria-label="Weight">
      <input data-f="r" type="number" inputmode="numeric" step="1" min="1" value="${s.r}" aria-label="${measureLabel(ex)}">
      <textarea data-f="note" class="note-input" rows="1" placeholder="Note">${esc(s.note || '')}</textarea>
      <div class="row-actions"><button class="btn small primary" data-act="save">Save</button><button class="btn small" data-act="cancel">Cancel</button><button class="btn small danger" data-act="del">Remove</button></div>
    </div></li>`;
  return `<li class="set-row" data-set="${s.id}">
      <span class="n">Set ${n}</span>
      <span class="v">${esc(fmtSet(s, ex, units))}<small>${fmtTime(s.ts)}</small></span>
      <button class="text-btn" data-act="edit">Edit</button>
      ${s.note ? `<span class="note">${esc(s.note)}</span>` : ''}
    </li>`;
}

// Inline set editing, shared with the journal page.
export function bindSetEditing(root, rerender) {
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const li = b.closest('[data-set]');
    const s = store.allSets().find(x => x.id === li?.dataset.set);
    if (!s) return;
    const ex = EX[s.ex], units = store.get('units');
    const act = b.dataset.act;
    if (act === 'edit') {
      li.outerHTML = setRow(s, ex, 0, true);
    } else if (act === 'cancel') rerender();
    else if (act === 'del') {
      if (confirm('Remove this set?')) { store.deleteSet(s.id); toast('Set removed'); rerender(); }
    } else if (act === 'save') {
      const w = fromDisplayW(parseFloat($('[data-f="w"]', li).value || '0'), units);
      const r = Number($('[data-f="r"]', li).value);
      const err = store.validSet(w, r);
      if (err) { toast(err); return; }
      store.updateSet(s.id, { w: Math.round(w * 1000) / 1000, r, note: $('[data-f="note"]', li).value.trim() });
      toast('Set updated');
      rerender();
    }
  });
}

function refreshLogPanel() {
  const v = top();
  if (v?.type !== 'exercise' || v.tab !== 'log') return;
  const ex = EX[v.id];
  const list = $('#today-sets');
  if (!list || list.querySelector('.set-edit')) return;
  const today = store.setsOnDay(dayKey(Date.now())).filter(s => s.ex === ex.id);
  list.innerHTML = today.length ? today.map((s, i) => setRow(s, ex, i + 1)).join('') : '<li class="empty">No sets yet today.</li>';
}

// ------------------------------------------------------------ quick log view
function quickView(v) {
  kicker.textContent = 'Log an exercise';
  return `<input class="search" id="q" type="search" placeholder="Search exercises or muscles" autocomplete="off" value="${esc(v.q || '')}">
    <div id="q-results">${quickResults(v.q || '')}</div>`;
}

function quickResults(q) {
  q = q.trim().toLowerCase();
  if (!q) {
    const seen = new Set(), recent = [];
    const sets = store.allSets();
    for (let i = sets.length - 1; i >= 0 && recent.length < 8; i--) {
      if (!seen.has(sets[i].ex) && EX[sets[i].ex]) { seen.add(sets[i].ex); recent.push(EX[sets[i].ex]); }
    }
    const all = [...EXERCISES].sort((a, b) => a.name.localeCompare(b.name));
    return (recent.length ? `<div class="label" style="margin:6px 0">Recent</div>${exList(recent)}` : '')
      + `<div class="label" style="margin:18px 0 6px">All exercises</div>${exList(all)}`;
  }
  const hits = EXERCISES.filter(e => e.name.toLowerCase().includes(q) || e.equipment.toLowerCase().includes(q)
    || [...e.p, ...e.s].some(m => muscleName(m).toLowerCase().includes(q) || m.includes(q)));
  return hits.length ? exList(hits) : `<p class="empty">Nothing matches "${esc(q)}".</p>`;
}

function exList(list) {
  const units = store.get('units');
  return `<ul class="plain-list">${list.map(e => {
    const last = store.lastSetFor(e.id);
    return `<li data-ex="${e.id}" tabindex="0"><span>${esc(e.name)}<div class="sub">${e.p.map(muscleName).join(', ')} · ${esc(equipKind(e))}</div></span>
      ${last ? `<span class="right">${esc(fmtSet(last, e, units))}<div class="sub">${esc(relDay(dayKey(last.ts)))}</div></span>` : ''}</li>`;
  }).join('')}</ul>`;
}

// ------------------------------------------------------------ events
function bind(v) {
  body.onclick = e => {
    const mBtn = e.target.closest('[data-muscle]');
    if (mBtn) { e.stopPropagation(); open({ type: 'muscle', id: mBtn.dataset.muscle }); return; }
    const exEl = e.target.closest('[data-ex]');
    if (exEl && !exEl.classList.contains('log-form')) { open({ type: 'exercise', id: exEl.dataset.ex, from: v.type }); return; }
    const go = e.target.closest('[data-go]');
    if (go) { close(); location.hash = go.dataset.go; return; }
    const day = e.target.closest('[data-day]');
    if (day) { close(); location.hash = '#/journal/' + day.dataset.day; return; }
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      v.tab = tab.dataset.tab;
      $$('[data-tab]', body).forEach(b => b.setAttribute('aria-selected', b === tab));
      $('#tab-body').innerHTML = tabBody(EX[v.id], v.tab);
      if (v.tab === 'log') bindLog(v);
      return;
    }
  };
  body.onkeydown = e => {
    if (e.key === 'Enter' && e.target.matches('[data-ex][tabindex]')) e.target.click();
  };
  if (v.type === 'exercise') {
    bindLog(v);
    if (!body.dataset.editBound) { bindSetEditing(body, () => refreshLogPanelForce()); body.dataset.editBound = '1'; }
  }
  if (v.type === 'quick') {
    const q = $('#q');
    q.addEventListener('input', () => { v.q = q.value; $('#q-results').innerHTML = quickResults(q.value); });
    if (desktop.matches) setTimeout(() => q.focus(), 300);
  }
}

function refreshLogPanelForce() {
  const v = top();
  if (v?.type !== 'exercise') return;
  $('#tab-body').innerHTML = tabBody(EX[v.id], v.tab);
  if (v.tab === 'log') bindLog(v);
}

function bindLog(v) {
  const ex = EX[v.id];
  const form = $('.log-form', body);
  if (!form) return;
  const units = store.get('units'), m = measure(ex);
  const wIn = $('#in-w'), rIn = $('#in-r'), err = $('#log-err'), btn = $('#btn-log');
  const wStep = units === 'lb' ? 5 : 2.5, rStep = m === 'reps' ? 1 : 5;
  form.addEventListener('click', e => {
    const s = e.target.closest('[data-step]');
    if (!s) return;
    const d = Number(s.dataset.d);
    if (s.dataset.step === 'w') wIn.value = trim(Math.max(0, (parseFloat(wIn.value) || 0) + d * wStep));
    else rIn.value = Math.max(1, (parseInt(rIn.value, 10) || 0) + d * rStep);
  });
  btn.addEventListener('click', () => {
    const w = fromDisplayW(parseFloat(wIn.value || '0'), units);
    const r = Number(rIn.value);
    const msg = store.validSet(w, r);
    err.textContent = msg || '';
    if (msg) return;
    const note = $('#in-note').value.trim();
    store.addSet(ex.id, Math.round(w * 1000) / 1000, r, note);
    $('#in-note').value = '';
    btn.textContent = 'Logged';
    btn.classList.add('logged');
    setTimeout(() => { btn.textContent = 'Log set'; btn.classList.remove('logged'); }, 1100);
    const rows = $$('#today-sets .set-row');
    rows[rows.length - 1]?.classList.add('new');
    rows[rows.length - 1]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    hooks.onLogged?.(ex);
  });
}

// ------------------------------------------------------------ drag grip (phone)
function initGrip() {
  let y0 = null, h0 = 0;
  grip.addEventListener('pointerdown', e => {
    y0 = e.clientY; h0 = sheet.getBoundingClientRect().height;
    sheet.classList.add('dragging');
    grip.setPointerCapture(e.pointerId);
  });
  grip.addEventListener('pointermove', e => {
    if (y0 === null) return;
    const h = Math.max(80, h0 - (e.clientY - y0));
    sheet.style.height = h + 'px';
  });
  const end = e => {
    if (y0 === null) return;
    const dy = e.clientY - y0;
    y0 = null;
    sheet.classList.remove('dragging');
    sheet.style.height = '';
    if (Math.abs(dy) < 6) { setHeight(height === 'full' ? 'half' : 'full'); return; }
    if (dy > 70) { if (height === 'full') setHeight('half'); else close(); }
    else if (dy < -50) setHeight('full');
    else setHeight(height);
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
}

export { MUSCLES };

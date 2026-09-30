// Journal: month calendar of sessions, and a page per session day.
import * as store from './store.js';
import { EX, MONTHS, dayKey, keyToDate, fmtDayLong, fmtDay, fmtSpan, fmtVol, fmtSet, muscleName, esc, $ } from './lib.js';
import { setRow, bindSetEditing } from './sheets.js';

let month = null; // Date at the first of the shown month

export function journalPage(root) {
  if (!month) { const n = new Date(); month = new Date(n.getFullYear(), n.getMonth(), 1); }
  const days = store.byDay();
  const units = store.get('units');
  const y = month.getFullYear(), mo = month.getMonth();
  const first = new Date(y, mo, 1).getDay();          // 0 = Sunday
  const offset = (first + 6) % 7;                      // weeks start on Monday
  const nDays = new Date(y, mo + 1, 0).getDate();
  const today = dayKey(Date.now());
  const inMonth = [...days].filter(([k]) => k.startsWith(`${y}-${String(mo + 1).padStart(2, '0')}`));
  const vols = inMonth.map(([, s]) => store.session(s).vol);
  const maxVol = Math.max(1, ...vols);

  const cells = [];
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(d => cells.push(`<div class="dow">${d}</div>`));
  for (let i = 0; i < offset; i++) cells.push('<div class="day blank"></div>');
  for (let d = 1; d <= nDays; d++) {
    const k = `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const sets = days.get(k);
    let cls = 'day', extra = '';
    if (sets) {
      const s = store.session(sets);
      const lvl = s.vol ? Math.min(4, 1 + Math.floor((s.vol / maxVol) * 3.999)) : 1;
      cls += ` has l${lvl}`;
      extra = `<span class="vol">${s.count} sets</span>`;
    }
    if (k === today) cls += ' today';
    cells.push(sets
      ? `<a class="${cls}" href="#/journal/${k}" aria-label="${esc(fmtDayLong(k))}, ${sets.length} sets">${d}${extra}</a>`
      : `<div class="${cls}">${d}</div>`);
  }

  const monthSessions = inMonth.sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([k, sets]) => {
    const s = store.session(sets);
    return `<li onclick="location.hash='#/journal/${k}'"><span>${esc(fmtDayLong(k))}
        <div class="sub">${s.exOrder.map(id => esc(EX[id]?.name || id)).join(', ')}</div></span>
      <span class="right">${s.count} sets<div class="sub">${fmtVol(s.vol, units)} ${units}${s.span ? ' · ' + fmtSpan(s.span) : ''}</div></span></li>`;
  }).join('');

  const total = [...days.values()].length;
  root.innerHTML = `<div class="page-inner">
    <h1>Journal</h1>
    <p class="lede">${total ? `${total} training ${total === 1 ? 'day' : 'days'} logged.` : 'Sessions appear here as you log sets. All sets logged on the same day make one session.'}</p>
    <div class="cal-head">
      <button class="btn small" id="prev">Previous</button>
      <span class="month">${MONTHS[mo]} ${y}</span>
      <button class="btn small" id="next">Next</button>
    </div>
    <div class="cal">${cells.join('')}</div>
    <h2>Sessions in ${MONTHS[mo]}</h2>
    ${monthSessions ? `<ul class="plain-list">${monthSessions}</ul>` : '<p class="empty">No sessions this month.</p>'}
  </div>`;
  $('#prev', root).onclick = () => { month = new Date(y, mo - 1, 1); journalPage(root); };
  $('#next', root).onclick = () => { month = new Date(y, mo + 1, 1); journalPage(root); };
}

export function sessionPage(root, k, rerender) {
  const sets = store.setsOnDay(k);
  const units = store.get('units');
  const d = keyToDate(k);
  month = new Date(d.getFullYear(), d.getMonth(), 1);
  if (!sets.length) {
    root.innerHTML = `<div class="page-inner"><a class="btn small" href="#/journal">Journal</a>
      <h1 style="margin-top:16px">${esc(fmtDayLong(k))}</h1><p class="empty">No sets logged on this day.</p></div>`;
    return;
  }
  const s = store.session(sets);
  const blocks = s.exOrder.map(id => {
    const ex = EX[id];
    const list = s.byEx.get(id);
    const vol = list.reduce((a, x) => a + x.w * x.r, 0);
    return `<div class="session-ex">
      <h3><a href="#/progress/${id}">${esc(ex?.name || id)}</a><span class="sub" style="font-weight:400;font-size:12px;color:var(--ink-3)">${vol ? fmtVol(vol, units) + ' ' + units : ''}</span></h3>
      <ul class="sets">${list.map((x, i) => setRow(x, ex, i + 1)).join('')}</ul>
    </div>`;
  }).join('');
  root.innerHTML = `<div class="page-inner">
    <a class="btn small" href="#/journal">Journal</a>
    <h1 style="margin-top:16px">${esc(fmtDayLong(k))}</h1>
    <div class="tiles">
      <div class="tile"><div class="v">${s.count}</div><div class="k">Sets</div></div>
      <div class="tile"><div class="v">${s.exOrder.length}</div><div class="k">Exercises</div></div>
      <div class="tile"><div class="v">${fmtVol(s.vol, units)}<small>${units}</small></div><div class="k">Volume</div></div>
      <div class="tile"><div class="v">${s.span ? fmtSpan(s.span) : '-'}</div><div class="k">First to last set</div></div>
    </div>
    <div class="label">Muscles trained</div>
    <p style="margin:6px 0 10px">${s.muscles.map(m => `<span class="tag" style="margin:0 4px 4px 0">${esc(muscleName(m))}</span>`).join('')}</p>
    ${blocks}
  </div>`;
  bindSetEditing(root, rerender);
}

export { fmtDay, fmtSet };

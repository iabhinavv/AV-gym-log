// Progress: list of logged exercises, and a page per exercise with a trend chart.
import * as store from './store.js';
import { EX, measure, measureUnit, fmtSet, fmtDay, relDay, dayKey, toDisplayW, trim, fmtVol, keyToDate, esc } from './lib.js';

export function progressList(root) {
  const units = store.get('units');
  const ids = [];
  const sets = store.allSets();
  for (let i = sets.length - 1; i >= 0; i--) if (!ids.includes(sets[i].ex) && EX[sets[i].ex]) ids.push(sets[i].ex);
  const rows = ids.map(id => {
    const ex = EX[id], st = store.exerciseStats(id);
    const best = measure(ex) === 'reps' && st.bestE ? `e1RM ${trim(toDisplayW(st.bestE, units))} ${units}` : `Best ${fmtSet(st.best, ex, units)}`;
    const pts = st.series.map(d => (measure(ex) === 'reps' && d.e1rm ? d.e1rm : d.top));
    return `<li class="prog-row" onclick="location.hash='#/progress/${id}'"><span>${esc(ex.name)}
        <div class="sub">${st.series.length} ${st.series.length === 1 ? 'session' : 'sessions'} · last ${esc(relDay(dayKey(st.last.ts)).toLowerCase())}</div></span>
      ${spark(pts.slice(-12))}
      <span class="right">${esc(best)}<div class="sub">${esc(fmtSet(st.last, ex, units))}</div></span></li>`;
  }).join('');
  root.innerHTML = `<div class="page-inner wide">
    <h1>Progress</h1>
    <p class="lede">Every exercise you have logged, most recent first.</p>
    ${rows ? `<ul class="plain-list prog-list">${rows}</ul>` : '<p class="empty">Nothing logged yet. Tap a muscle on the body, pick an exercise and log a set.</p>'}
  </div>`;
}

// Tiny trend line of the last sessions (e1RM, or best hold/distance/reps).
function spark(v) {
  if (v.length < 2) return '<span class="spark"></span>';
  const w = 96, h = 26, lo = Math.min(...v), hi = Math.max(...v), r = hi - lo || 1;
  const pts = v.map((y, i) => `${((i / (v.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 3 - ((y - lo) / r) * (h - 6)).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}"/></svg>`;
}

export function progressPage(root, id, openExercise) {
  const ex = EX[id];
  if (!ex) { root.innerHTML = '<div class="page-inner"><p class="empty">Unknown exercise.</p></div>'; return; }
  const units = store.get('units'), st = store.exerciseStats(id), m = measure(ex);
  const head = `<a class="btn small" href="#/progress">Progress</a>
    <h1 style="margin-top:16px">${esc(ex.name)}</h1>
    <p class="lede">${esc(ex.equipment)}</p>`;
  if (!st.sets.length) {
    root.innerHTML = `<div class="page-inner">${head}<p class="empty">No sets logged yet.</p>
      <button class="btn primary" id="open-ex">Open exercise</button></div>`;
    root.querySelector('#open-ex').onclick = () => openExercise(id);
    return;
  }
  const isReps = m === 'reps';
  const series = st.series.map(d => ({ k: d.k, y: isReps && d.e1rm ? toDisplayW(d.e1rm, units) : d.top, vol: toDisplayW(d.vol, units) }));
  const yLabel = isReps && st.bestE ? `Estimated 1RM (${units}), best set each session` : `Best ${m === 'sec' ? 'hold (s)' : m === 'm' ? 'distance (m)' : 'reps'} each session`;
  const totalVol = st.sets.reduce((a, s) => a + s.w * s.r, 0);
  const history = [...st.series].reverse().map(d => `<li onclick="location.hash='#/journal/${d.k}'"><span>${esc(fmtDay(d.k))}
      <div class="sub">${d.sets.map(s => esc(fmtSet(s, ex, units))).join(', ')}</div></span>
      <span class="right">${isReps && d.e1rm ? `${trim(toDisplayW(d.e1rm, units))} ${units}` : ''}<div class="sub">${d.vol ? fmtVol(d.vol, units) + ' ' + units : ''}</div></span></li>`).join('');
  root.innerHTML = `<div class="page-inner wide">${head}
    <div class="tiles">
      <div class="tile"><div class="v">${esc(fmtSet(st.best, ex, units))}</div><div class="k">Best set</div></div>
      ${isReps && st.bestE ? `<div class="tile"><div class="v">${trim(toDisplayW(st.bestE, units))}<small>${units}</small></div><div class="k">Est. 1RM (Epley)</div></div>` : ''}
      <div class="tile"><div class="v">${st.series.length}</div><div class="k">Sessions</div></div>
      ${totalVol ? `<div class="tile"><div class="v">${fmtVol(totalVol, units)}<small>${units}</small></div><div class="k">Total volume</div></div>` : ''}
    </div>
    <div class="split">
      <section>
        <h2 class="split-h">Trend</h2>
        <div class="label">${esc(yLabel)}</div>
        ${lineChart(series)}
        ${series.some(s => s.vol) ? `<h2>Volume per session</h2><div class="label">${units} lifted (weight × reps)</div>${barChart(series)}` : ''}
        <div class="row-actions" style="margin-top:14px"><button class="btn primary" id="open-ex">Log this exercise</button></div>
      </section>
      <section>
        <h2 class="split-h">History</h2>
        <ul class="plain-list">${history}</ul>
      </section>
    </div>
  </div>`;
  root.querySelector('#open-ex').onclick = () => openExercise(id);
}

// Small dependency-free SVG charts. x is spaced by date, not by index.
const W = 640, H = 220, PAD = { l: 44, r: 14, t: 14, b: 26 };
function scales(series, key) {
  const xs = series.map(s => keyToDate(s.k).getTime());
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const ys = series.map(s => s[key]);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (key === 'vol') y0 = 0;
  const pad = (y1 - y0) * 0.12 || Math.max(1, y1 * 0.1);
  y0 = Math.max(0, y0 - (key === 'vol' ? 0 : pad)); y1 += pad;
  const X = t => PAD.l + (x1 === x0 ? (W - PAD.l - PAD.r) / 2 : ((t - x0) / (x1 - x0)) * (W - PAD.l - PAD.r));
  const Y = v => H - PAD.b - ((v - y0) / (y1 - y0)) * (H - PAD.t - PAD.b);
  return { X, Y, y0, y1, xs };
}
function axes(y0, y1, Y, series) {
  const ticks = [0, 0.5, 1].map(f => y0 + (y1 - y0) * f);
  const g = ticks.map(v => `<line class="grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${Y(v)}" y2="${Y(v)}"/>
    <text class="axis" x="${PAD.l - 6}" y="${Y(v) + 3}" text-anchor="end">${y1 - y0 > 6 ? Math.round(v) : trim(v)}</text>`).join('');
  const first = series[0].k, last = series[series.length - 1].k;
  return g + `<text class="axis" x="${PAD.l}" y="${H - 6}">${esc(fmtDay(first))}</text>`
    + (first !== last ? `<text class="axis" x="${W - PAD.r}" y="${H - 6}" text-anchor="end">${esc(fmtDay(last))}</text>` : '');
}
function lineChart(series) {
  const { X, Y, y0, y1, xs } = scales(series, 'y');
  const pts = series.map((s, i) => [X(xs[i]), Y(s.y)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  const area = pts.length > 1 ? `<path class="area" d="${d}L${pts[pts.length - 1][0]},${H - PAD.b}L${pts[0][0]},${H - PAD.b}Z"/>` : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Trend chart">${axes(y0, y1, Y, series)}${area}
    <path class="line" d="${d}"/>${pts.map((p, i) => `<circle class="pt" cx="${p[0]}" cy="${p[1]}" r="3.5"><title>${esc(fmtDay(series[i].k))}: ${trim(series[i].y)}</title></circle>`).join('')}</svg>`;
}
function barChart(series) {
  const { X, Y, y0, y1, xs } = scales(series, 'vol');
  const bw = Math.max(3, Math.min(18, (W - PAD.l - PAD.r) / (series.length * 2)));
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Volume chart">${axes(y0, y1, Y, series)}
    ${series.map((s, i) => `<rect class="bar" x="${X(xs[i]) - bw / 2}" y="${Y(s.vol)}" width="${bw}" height="${H - PAD.b - Y(s.vol)}" rx="2"><title>${esc(fmtDay(s.k))}: ${Math.round(s.vol)}</title></rect>`).join('')}</svg>`;
}

export { measureUnit };

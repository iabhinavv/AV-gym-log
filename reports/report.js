// Strength report renderer. Loads data/<id>.stats.js (numbers, from tools/analyze.py) and
// data/<id>.coach.js (written advice), plus the previous report for comparisons, then draws the
// page and a 3D strength map with the app's viewer.
import { MUSCLES, MUSCLE } from '../js/muscles.js';
import { EXERCISES } from '../data/exercises.js';
import { IMAGES } from '../data/exercise-images.js';

const EX = Object.fromEntries(EXERCISES.map(e => [e.id, e]));
const STATUS = {
  strong:     { label: 'Strong',     color: '#6FBF8A' },
  solid:      { label: 'Solid',      color: '#8FA9C4' },
  developing: { label: 'Developing', color: '#E3A857' },
  weak:       { label: 'Weak',       color: '#E0553F' },
  untrained:  { label: 'Untrained',  color: '#5A606B' },
};
const ORDER = ['strong', 'solid', 'developing', 'weak', 'untrained'];
const GOOD = '#6FBF8A', BAD = '#E0553F';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $ = (s, r = document) => r.querySelector(s);
// Text blocks: blank lines separate paragraphs; single line breaks are just wrapping.
const paras = t => String(t || '').trim().split(/\n\s*\n/).map(p => `<p class="summary">${esc(p.replace(/\s*\n\s*/g, ' '))}</p>`).join('');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MON[m - 1]} ${y}`; };
const fmtRange = (a, b) => {
  const [ya, ma, da] = a.split('-').map(Number), [yb, mb, db] = b.split('-').map(Number);
  if (ya === yb && ma === mb) return `${da} to ${db} ${MON[mb - 1]} ${yb}`;
  return `${fmtDate(a)} to ${fmtDate(b)}`;
};

function loadScript(src) {
  return new Promise(res => {
    const s = document.createElement('script');
    s.src = src; s.onload = () => res(true); s.onerror = () => res(false);
    document.head.appendChild(s);
  });
}

// Fallback: when the coaching notes give no status, derive one from weekly sets.
function autoStatus(m) {
  if (m.setsPerWeek === 0) return 'untrained';
  if (m.setsPerWeek < 3) return 'weak';
  if (m.setsPerWeek < 6) return 'developing';
  return 'solid';
}

async function main() {
  const ids = window.GYM_REPORT_INDEX || [];
  const pick = $('#report-pick');
  const want = new URLSearchParams(location.search).get('r');
  const id = ids.includes(want) ? want : ids[ids.length - 1];
  if (!id) { $('#report').innerHTML = '<div class="wrap"><p class="banner">No reports yet. See README.md, "Strength reports".</p></div>'; return; }
  pick.innerHTML = ids.slice().reverse().map(r => `<option value="${r}"${r === id ? ' selected' : ''}>Report ${fmtDate(r)}</option>`).join('');
  pick.hidden = ids.length < 2;
  pick.onchange = () => { location.search = '?r=' + pick.value; };

  const prevId = ids[ids.indexOf(id) - 1];
  await Promise.all([loadScript(`data/${id}.stats.js`), loadScript(`data/${id}.coach.js`),
    prevId ? loadScript(`data/${prevId}.stats.js`) : null]);
  const rep = (window.GYM_REPORTS || {})[id] || {};
  if (!rep.stats) { $('#report').innerHTML = `<div class="wrap"><p class="banner">data/${esc(id)}.stats.js is missing. Run tools/analyze.py.</p></div>`; return; }
  const prev = prevId ? (window.GYM_REPORTS[prevId] || {}).stats : null;
  render(rep.stats, rep.coach || null, prev);
}

function render(S, C, P) {
  const T = S.totals, B = S.body;
  const coachMuscles = C?.muscles || {};
  const mStats = Object.fromEntries(S.muscles.map(m => [m.id, m]));
  const status = id => coachMuscles[id]?.status || autoStatus(mStats[id] || { setsPerWeek: 0 });
  document.title = `Strength Report ${fmtDate(S.id)} · AV's Gym Log`;
  const prof = C?.profile || {};
  const chip = t => (t ? `<span class="chip">${esc(t)}</span>` : '');

  const kpis = [
    [T.sessions, '', 'Sessions'], [T.sessionsPerWeek, '/wk', 'Frequency'], [T.hardSetsPerWeek, '/wk', 'Hard sets'],
    [T.avgMinutes, 'min', 'Avg session'], [Math.round(T.failurePct), '%', 'Sets to failure'],
    ...(B.ffmi ? [[B.ffmi, '', 'FFMI'], [B.leanKg, 'kg', 'Lean mass']] : [[B.bmi, '', 'BMI']]),
  ];

  const html = [];
  // ---------------- hero
  html.push(`<section class="hero"><div class="wrap">
    <div class="label">Strength report · ${esc(fmtRange(T.from, T.to))} · ${T.sessions} sessions</div>
    <h1>${esc(fmtDate(S.id))}</h1>
    <div class="chips">${chip(prof.heightCm && `${prof.heightCm} cm`)}${chip(`${B.weightKg} kg`)}${chip(B.bodyfatPct && `about ${B.bodyfatPct}% body fat`)}
      ${chip(prof.training)}${chip(prof.sport)}${chip(prof.injuries)}</div>
    ${C ? `<p class="headline">${esc(C.headline)}</p>${paras(C.summary)}`
        : `<p class="banner">Coaching notes for this report have not been written yet (data/${esc(S.id)}.coach.js). The numbers below are complete.</p>`}
    <div class="tiles">${kpis.map(([v, u, k]) => `<div class="tile"><div class="v">${esc(v)}<small>${esc(u)}</small></div><div class="k">${esc(k)}</div></div>`).join('')}</div>
  </div></section>`);

  // ---------------- strength map
  const groups = ORDER.map(st => {
    const ms = MUSCLES.filter(m => status(m.id) === st);
    return ms.length ? `<div class="mgroup"><div class="label"><span class="dot s-${st}"></span>${STATUS[st].label}</div>
      <ul>${ms.map(m => `<li><button data-m="${m.id}">${esc(m.name)}</button></li>`).join('')}</ul></div>` : '';
  }).join('');
  html.push(`<section class="block" id="map"><div class="wrap">
    <div class="label">Strength map</div><h2>Every muscle, rated</h2>
    <p class="lede">Colour shows how well each muscle is trained and how strong it is, from your weekly sets and your lifts. Drag to turn; click a muscle, or a name in the list, for the detail.</p>
    <div class="map">
      <div class="stage-wrap">
        <div id="stage"></div><div class="labels" id="labels"></div><div class="tip" id="tip" hidden></div>
        <div class="stage-loading" id="stage-loading">Loading 3D model</div>
        <div class="stage-tools"><button data-view="front" aria-pressed="true">Front</button><button data-view="back" aria-pressed="false">Back</button><button data-view="spin" aria-pressed="false">Turn</button></div>
      </div>
      <aside class="side">
        <div class="legend">${ORDER.map(s => `<span><i class="dot s-${s}"></i>${STATUS[s].label}</span>`).join('')}</div>
        <div class="detail" id="detail" style="margin-top:14px"><div class="label">Muscle</div><p>Click a muscle to see why it is rated the way it is.</p></div>
        ${groups}
      </aside>
    </div>
  </div></section>`);

  // ---------------- key lifts
  const prevLift = key => P?.keyLifts?.find(k => k.key === key);
  const liftRows = S.keyLifts.map(k => {
    const note = C?.keyLifts?.[k.key] || {};
    const pv = prevLift(k.key);
    let best, ratio = '', level = k.level || 'Not trained', delta = '';
    if ('reps' in k) {
      best = k.logged ? `${k.reps} reps` : 'Not logged';
      if (pv && pv.reps != null && k.logged) { const d = k.reps - pv.reps; if (d) delta = `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</span>`; }
    } else if (k.estimate) {
      best = `${k.estimate} kg<div class="note" style="font-size:12px;color:var(--ink-3)">${esc(k.converted ? `from ${k.fromName} (${k.e1rm} kg)` : k.fromName)}</div>`;
      ratio = `${k.ratioBW.toFixed(2)}x`;
      if (pv?.estimate) { const d = Math.round((k.estimate - pv.estimate) * 10) / 10; if (d) delta = `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d} kg</span>`; }
    } else best = 'Not trained';
    if (note.untested) { level = 'Untested'; ratio = ''; delta = ''; best = `Not tested<div class="note" style="font-size:12px;color:var(--ink-3)">${k.fromName ? esc(`only ${k.fromName} at ${k.e1rm} kg est.`) : ''}</div>`; }
    return `<tr><td><b>${esc(k.label)}</b></td><td>${best}${delta}</td><td>${ratio}</td><td><span class="lvl">${esc(level)}</span></td>
      <td>${esc(note.target || '')}</td><td class="note">${esc(note.note || '')}</td></tr>`;
  }).join('');
  html.push(`<section class="block" id="lifts"><div class="wrap">
    <div class="label">Key lifts</div><h2>Where your strength stands</h2>
    <p class="lede">Estimated one-rep max (Epley) from your best set, compared with bodyweight (${B.weightKg} kg). Levels are rough guides for adult men${P ? `; changes are against the ${esc(fmtDate(P.id))} report` : ''}.</p>
    <div class="scroll-x"><table class="table"><thead><tr><th>Lift</th><th>Best (e1RM)</th><th>x BW</th><th>Level</th><th>Next target</th><th>Note</th></tr></thead>
    <tbody>${liftRows}</tbody></table></div>
  </div></section>`);

  // ---------------- strengths / weaknesses
  const card = (it, cls, i, kind) => `<article class="card ${cls}">
      <div class="shot" data-shot="${kind}-${i}"><div class="ph">Rendering</div>
        ${it.muscles?.length ? `<div class="tags">${it.muscles.map(m => `<span>${esc(MUSCLE[m]?.name || m)}</span>`).join('')}</div>` : ''}</div>
      <div class="body"><h3>${esc(it.title)}</h3><p>${esc(it.text)}</p>${it.evidence ? `<div class="ev">${esc(it.evidence)}</div>` : ''}</div>
    </article>`;
  if (C?.strengths?.length) html.push(`<section class="block" id="strengths"><div class="wrap">
    <div class="label">Strengths</div><h2>What you are doing well</h2>
    <div class="cards">${C.strengths.map((s, i) => card(s, 'good', i, 'good')).join('')}</div></div></section>`);
  if (C?.weaknesses?.length) html.push(`<section class="block" id="weaknesses"><div class="wrap">
    <div class="label">Weaknesses</div><h2>What is holding you back</h2>
    <div class="cards">${C.weaknesses.map((s, i) => card(s, 'bad', i, 'bad')).join('')}</div></div></section>`);

  // ---------------- volume bars
  const band = S.volumeBand, max = Math.max(22, ...S.muscles.map(m => m.setsPerWeek));
  const pct = v => `${(v / max) * 100}%`;
  const prevSets = Object.fromEntries((P?.muscles || []).map(m => [m.id, m.setsPerWeek]));
  const bars = S.muscles.map(m => {
    const st = status(m.id), d = P && prevSets[m.id] != null ? Math.round((m.setsPerWeek - prevSets[m.id]) * 10) / 10 : 0;
    return `<div class="bar-row" title="${esc(m.name)}: ${m.setsPerWeek} hard sets a week, ${m.daysPerWeek} days a week">
      <span class="nm"><i class="dot s-${st}"></i>${esc(m.name)}</span>
      <span class="bar-track"><span class="band" style="left:${pct(band.target)};width:calc(${pct(band.high)} - ${pct(band.target)})"></span>
        <span class="fill" style="width:${pct(m.setsPerWeek)};background:${STATUS[st].color}"></span></span>
      <span class="n">${m.setsPerWeek}${d ? `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</span>` : ''}</span></div>`;
  }).join('');
  html.push(`<section class="block" id="volume"><div class="wrap">
    <div class="label">Training volume</div><h2>Hard sets per muscle, per week</h2>
    <p class="lede">A set counts fully for its main muscles and half for secondary ones. The shaded band (${band.target} to ${band.high}) is a productive range for most muscles; under ${band.low} is too little to grow or get stronger.</p>
    <div class="bars">${bars}</div>
    <p class="bars-key">${T.hardSets} hard sets over ${T.weeks} weeks. Sessions: ${Object.entries(T.splits).map(([k, v]) => `${esc(k)} ${v}`).join(', ')}.</p>
  </div></section>`);

  // ---------------- improvements, add, reduce
  if (C?.improvements?.length) html.push(`<section class="block" id="improve"><div class="wrap">
    <div class="label">Areas for improvement</div><h2>What to change</h2>
    <ol class="steps">${C.improvements.map(it => `<li><div><h3>${esc(it.title)}</h3><p>${esc(it.text)}</p></div></li>`).join('')}</ol>
  </div></section>`);
  if (C?.addExercises?.length) html.push(`<section class="block" id="add"><div class="wrap">
    <div class="label">Exercises to add</div><h2>New lifts and where they go</h2>
    <p class="lede">Each one targets a gap above. Open it in the app's Exercise Library for the full guide.</p>
    <div class="cards">${C.addExercises.map((a, i) => {
      const ex = EX[a.id];
      const name = ex ? ex.name : a.id;
      const muscles = ex ? [...ex.p, ...ex.s] : [];
      return `<article class="card">
        <div class="shot" ${IMAGES[a.id] ? '' : `data-shot="add-${i}"`}>${IMAGES[a.id]
          ? `<img src="../assets/exercises/${a.id}-0.jpg" alt="${esc(name)}" loading="lazy">` : '<div class="ph">Rendering</div>'}
          <div class="tags">${(ex?.p || []).map(m => `<span>${esc(MUSCLE[m]?.name || m)}</span>`).join('')}</div></div>
        <div class="body"><h3>${esc(name)}</h3>
          <div class="dose"><span class="pill acc">${esc(a.dose)}</span><span class="pill">${esc(a.day)}</span>${ex ? `<span class="pill">${esc(ex.equipment.split(/[,(]/)[0])}</span>` : ''}</div>
          <p>${esc(a.why)}</p>${muscles.length > ex?.p.length ? `<div class="ev">Also works ${muscles.slice(ex.p.length).map(m => esc(MUSCLE[m]?.name || m)).join(', ')}</div>` : ''}</div>
      </article>`;
    }).join('')}</div>
    ${C.reduce?.length ? `<h3 class="label" style="margin:30px 0 10px">Swap out or cut back</h3>
      <ul class="plain">${C.reduce.map(r => `<li><b>${esc(r.title)}.</b> ${esc(r.text)}</li>`).join('')}</ul>` : ''}
  </div></section>`);

  // ---------------- plan + MMA
  if (C?.plan) html.push(`<section class="block" id="plan"><div class="wrap">
    <div class="label">Plan</div><h2>${esc(C.plan.title)}</h2>
    <div class="days">${C.plan.days.map(d => `<div class="day"><h3>${esc(d.name)}</h3><ol>${d.items.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>`).join('')}</div>
    ${C.plan.note ? `<p class="note-line">${esc(C.plan.note)}</p>` : ''}
    ${C.mma?.length || C.nutrition?.length ? `<div class="two" style="margin-top:36px">
      ${C.mma?.length ? `<div><div class="label" style="margin-bottom:14px">MMA</div><div class="timeline">${C.mma.map(p => `<div class="ph"><h3>${esc(p.phase)}</h3><p>${esc(p.text)}</p></div>`).join('')}</div></div>` : ''}
      ${C.nutrition?.length ? `<div><div class="label" style="margin-bottom:14px">Body composition and recovery</div>
        ${B.ffmi ? `<p style="color:var(--ink-2);margin:0 0 10px">${B.weightKg} kg = about ${B.leanKg} kg lean and ${B.fatKg} kg fat. BMI ${B.bmi}; FFMI ${B.ffmi} (normalised ${B.ffmiNormalised}).</p>` : ''}
        <ul class="plain">${C.nutrition.map(n => `<li><b>${esc(n.title)}.</b> ${esc(n.text)}</li>`).join('')}</ul></div>` : ''}
    </div>` : ''}
  </div></section>`);

  // ---------------- targets, sessions, notes
  html.push(`<section class="block" id="targets"><div class="wrap">
    <div class="label">Targets</div><h2>For the next report</h2>
    ${C?.targets?.length ? `<div class="scroll-x"><table class="table"><thead><tr><th>Measure</th><th>Now</th><th>Target</th></tr></thead><tbody>
      ${C.targets.map(t => `<tr><td><b>${esc(t.label)}</b></td><td>${esc(t.now)}</td><td>${esc(t.target)}</td></tr>`).join('')}
      ${S.keyLifts.filter(k => C.keyLifts?.[k.key]?.target).map(k => `<tr><td><b>${esc(k.label)}</b></td><td>${'reps' in k ? `${k.reps} reps` : k.estimate ? `${k.estimate} kg` : '-'}</td><td>${esc(C.keyLifts[k.key].target)}</td></tr>`).join('')}
    </tbody></table></div>` : ''}
    <h3 class="label" style="margin:34px 0 10px">Sessions in this report</h3>
    <div class="scroll-x"><table class="table"><thead><tr><th>Date</th><th>Type</th><th>Sets</th><th>Time</th><th>Exercises</th></tr></thead><tbody>
      ${S.sessions.map(s => `<tr><td>${esc(s.weekday)} ${esc(fmtDate(s.date))}</td><td>${esc(s.split)}</td><td>${s.sets}</td><td>${s.minutes} min</td>
        <td class="note">${s.exercises.map(e => esc(EX[e]?.name || e)).join(', ')}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="two" style="margin-top:34px">
      ${C?.logging?.length ? `<div><div class="label" style="margin-bottom:10px">Logging notes</div><ul class="plain">${C.logging.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>` : ''}
      <div><div class="label" style="margin-bottom:10px">How this was worked out</div><ul class="plain">
        ${(C?.caveats || []).map(l => `<li>${esc(l)}</li>`).join('')}
        <li>Generated from ${esc(S.export)} with tools/analyze.py on ${esc(fmtDate(S.generated))}. A hard set counts fully for primary muscles and half for secondary; warm-ups and rest-pause clusters are handled as described in README.md.</li>
      </ul></div>
    </div>
  </div></section>`);
  html.push(`<footer><div class="wrap">AV's Gym Log strength report · ${esc(fmtDate(S.id))}. Anatomy model: BodyParts3D, (c) The Database Center for Life Science, CC BY-SA 2.1 JP. Exercise photos: free-exercise-db (public domain).</div></footer>`);
  $('#report').innerHTML = html.join('');

  initMap(S, C, status, mStats);
}

// ------------------------------------------------------------ 3D strength map
async function initMap(S, C, status, mStats) {
  const stage = $('#stage'), loading = $('#stage-loading');
  let viewer;
  try {
    const mod = await import('../js/viewer.js');
    if (!mod.webglAvailable()) throw new Error('WebGL 2 is not available');
    viewer = mod.createViewer(stage, {
      onPick: id => select(id),
      onHover: (id, e) => {
        const tip = $('#tip');
        if (!id) { tip.hidden = true; return; }
        const r = stage.getBoundingClientRect();
        tip.hidden = false;
        tip.innerHTML = `<i class="dot s-${status(id)}"></i> ${esc(MUSCLE[id]?.name)} · ${STATUS[status(id)].label}`;
        tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top) + 'px';
      },
      onEmptyDoubleTap: () => { selected = null; paint(); viewer.frameBody(); showDetail(null); },
    });
    viewer.debug.controls.enableZoom = false;   // the page scrolls with the wheel; clicking a muscle zooms
    viewer.debug.controls.autoRotate = false;
    await viewer.load('../assets/body.glb');
    loading.remove();
  } catch (err) {
    loading.textContent = `3D model unavailable (${err.message}). The lists still work.`;
    viewer = null;
  }

  const colors = Object.fromEntries(MUSCLES.map(m => [m.id, STATUS[status(m.id)].color]));
  let selected = null;
  const paint = () => viewer?.paint({ colors, glow: selected ? [selected] : [] });
  paint();

  function showDetail(id) {
    const d = $('#detail');
    document.querySelectorAll('.mgroup button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === id)));
    if (!id) { d.innerHTML = '<div class="label">Muscle</div><p>Click a muscle to see why it is rated the way it is.</p>'; return; }
    const m = MUSCLE[id], st = status(id), ms = mStats[id] || {}, note = C?.muscles?.[id]?.note;
    d.innerHTML = `<div class="label">${esc(m.region)}</div>
      <h3><i class="dot s-${st}"></i>${esc(m.name)}</h3>
      <div class="meta">${STATUS[st].label} · ${ms.setsPerWeek ?? 0} hard sets a week${ms.lastTrained ? ` · last trained ${esc(fmtDate(ms.lastTrained))}` : ''}</div>
      ${note ? `<p>${esc(note)}</p>` : `<p>${esc(m.job)}</p>`}`;
  }
  function select(id) {
    selected = id;
    paint();
    viewer?.focus(id);
    showDetail(id);
  }
  document.querySelector('.side').addEventListener('click', e => {
    const b = e.target.closest('[data-m]');
    if (b) { select(b.dataset.m); if (innerWidth < 1000) $('#map').scrollIntoView({ block: 'start' }); }
  });
  document.querySelector('.stage-tools').addEventListener('click', e => {
    const b = e.target.closest('[data-view]');
    if (!b || !viewer) return;
    const v = b.dataset.view;
    if (v === 'spin') {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      viewer.debug.controls.autoRotate = on;
      return;
    }
    document.querySelectorAll('.stage-tools [data-view="front"], .stage-tools [data-view="back"]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    selected = null; paint(); showDetail(null);
    viewer.frameBody(v);
  });
  if (!viewer) return;

  // Labels on the model for the muscles worth calling out: strong, weak and untrained.
  const labelled = MUSCLES.filter(m => ['strong', 'weak', 'untrained'].includes(status(m.id))).map(m => m.id);
  const layer = $('#labels');
  const els = Object.fromEntries(labelled.map(id => {
    const el = document.createElement('div');
    el.className = 'mlabel';
    el.innerHTML = `<i class="dot s-${status(id)}"></i><b>${esc(MUSCLE[id].name)}</b><span>${STATUS[status(id)].label}</span>`;
    layer.appendChild(el);
    return [id, el];
  }));
  let tick = 0;
  viewer.onFrame(() => {
    if (tick++ % 4) return;
    const placed = [];
    const ids = selected && !labelled.includes(selected) ? [...labelled] : labelled;
    for (const id of ids) {
      const el = els[id], p = viewer.screenOf(id);
      const out = p && (p.y < 56 || p.y > stage.clientHeight - 16 || p.x < 50 || p.x > stage.clientWidth - 50);
      const clash = p && placed.some(q => Math.abs(q.y - p.y) < 22 && Math.abs(q.x - p.x) < 120);
      if (!p || out || clash) { el.style.opacity = 0; continue; }
      el.style.opacity = 1;
      el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
      placed.push(p);
    }
  });

  // Stills for the strength / weakness cards and for exercises without a photo.
  const still = (ids, color, view) => viewer.snapshot(ids, {
    colors: Object.fromEntries(ids.length ? ids.map(i => [i, color]) : MUSCLES.map(m => [m.id, STATUS[status(m.id)].color])),
  }, { view, w: 560, h: 420, margin: ids.length ? 1.35 : 1.06 });
  const sideOf = ids => (ids.filter(i => MUSCLE[i]?.view === 'back').length > ids.length / 2 ? 'back' : 'front');
  const jobs = [];
  (C?.strengths || []).forEach((s, i) => jobs.push([`good-${i}`, s.muscles || [], GOOD]));
  (C?.weaknesses || []).forEach((s, i) => jobs.push([`bad-${i}`, s.muscles || [], BAD]));
  (C?.addExercises || []).forEach((a, i) => { if (!IMAGES[a.id] && EX[a.id]) jobs.push([`add-${i}`, EX[a.id].p, '#E3A857']); });
  const run = () => {
    const job = jobs.shift();
    if (!job) { paint(); return; }
    const [key, ids, color] = job;
    const slot = document.querySelector(`[data-shot="${key}"]`);
    if (slot) {
      const img = new Image();
      img.alt = '';
      img.src = still(ids, color, sideOf(ids));
      slot.querySelector('.ph')?.remove();
      slot.prepend(img);
    }
    setTimeout(run, 16);
  };
  setTimeout(run, 50);
}

main();

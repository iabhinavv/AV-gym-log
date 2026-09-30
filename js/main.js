// Boot, routing, menu drawer, plus button, and the glue between the 3D stage and the sheet.
import * as store from './store.js';
import { MUSCLES, MUSCLE } from './muscles.js';
import { EX, esc, $, $$, relDay, dayKey, toast } from './lib.js';
import * as sheets from './sheets.js';
import { journalPage, sessionPage } from './journal.js';
import { progressList, progressPage } from './progress.js';
import { libraryPage } from './library.js';
import { settingsPage, aboutPage } from './settings.js';

const page = $('#page'), drawer = $('#drawer'), scrim = $('#scrim');
let viewer = null;
let pageDirty = false;

store.load();

// ------------------------------------------------------------ 3D stage
async function initStage() {
  const loader = $('#loader'), bar = $('.loader-bar span');
  const done = () => { loader.classList.add('done'); setTimeout(() => loader.remove(), 700); };
  let mod;
  try {
    mod = await import('./viewer.js');
    if (!mod.webglAvailable() || location.search.includes('nogl')) throw new Error('WebGL 2 is not available');
    viewer = mod.createViewer($('#stage'), {
      onPick: id => {
        $('#hint').classList.add('gone');
        const t = sheets.top();
        sheets.open({ type: 'muscle', id }, { replace: t?.type === 'muscle' });
      },
      onHover: (id, e) => {
        const l = $('#hover-label');
        if (!id) { l.hidden = true; return; }
        l.hidden = false;
        l.textContent = MUSCLE[id]?.name || id;
        l.style.left = e.clientX + 'px';
        l.style.top = e.clientY + 'px';
      },
      onProgress: p => (bar.style.width = Math.round(p * 100) + '%'),
      onEmptyDoubleTap: () => { sheets.close(); viewer.frameBody(); },
    });
    $('#stage').addEventListener('pointerdown', () => $('#hint').classList.add('gone'), { once: true });
    if (location.search.includes('debug')) window.__viewer = viewer;
    await viewer.load('assets/body.glb');
    repaint();
    done();
  } catch (err) {
    console.error(err);
    viewer = null;
    $('#stage').hidden = true;
    showFallback(err);
    repaint();
    done();
  }
}

function showFallback(err) {
  const f = $('#stage-fallback');
  const regions = [...new Set(MUSCLES.map(m => m.region))];
  f.innerHTML = `<h2>Muscle groups</h2>
    <p>The 3D model could not be shown on this device (${esc(err?.message || 'unknown error')}). Everything else works.</p>
    ${regions.map(r => `<div class="label" style="margin:16px 0 8px">${r}</div><div class="fallback-grid">
      ${MUSCLES.filter(m => m.region === r).map(m => `<button class="btn" data-m="${m.id}">${esc(m.name)}</button>`).join('')}</div>`).join('')}`;
  f.hidden = false;
  $('#hint').hidden = true;
  f.onclick = e => { const b = e.target.closest('[data-m]'); if (b) sheets.open({ type: 'muscle', id: b.dataset.m }); };
}

// What the body shows depends on the top sheet view, then the recovery switch.
function repaint() {
  const rec = store.get('recovery');
  $('#recovery-legend').hidden = !rec || !viewer || !!sheets.top() || !page.hidden;
  if (!viewer) return;
  const v = sheets.top();
  if (v?.type === 'muscle') viewer.paint({ focus: v.id });
  else if (v?.type === 'exercise') {
    const ex = EX[v.id], roles = {};
    ex.st.forEach(m => (roles[m] = 'st'));
    ex.s.forEach(m => (roles[m] = 's'));
    ex.p.forEach(m => (roles[m] = 'p'));
    viewer.paint({ roles });
  } else viewer.paint(rec ? { recovery: store.recoveryScores() } : {});
}

function onSheetChange(v) {
  if (v) $('#hint').classList.add('gone');
  page.classList.toggle('receded', !!v && !page.hidden);
  repaint();
  if (viewer) {
    if (v?.type === 'muscle') viewer.focus(v.id);
    else if (v?.type === 'exercise') {
      const ex = EX[v.id];
      viewer.focusMany([...ex.p, ...ex.s], MUSCLE[ex.p[0]]?.view === 'back' ? 'back' : 'front');
    }
    else if (!v || v.type === 'quick') viewer.frameBody();
  }
  if (!v && pageDirty) { pageDirty = false; route(); }
}

sheets.initSheets({
  onChange: onSheetChange,
  onInsets: i => viewer?.setInsets(i),
  onLogged: ex => { viewer?.pulse([...ex.p]); repaint(); updateDrawerSub(); },
});

// ------------------------------------------------------------ drawer
function setDrawer(open) {
  drawer.classList.toggle('open', open);
  drawer.setAttribute('aria-hidden', String(!open));
  $('#btn-menu').setAttribute('aria-expanded', String(open));
  if (open) { scrim.hidden = false; requestAnimationFrame(() => scrim.classList.add('show')); updateDrawerSub(); }
  else { scrim.classList.remove('show'); setTimeout(() => { if (!drawer.classList.contains('open')) scrim.hidden = true; }, 300); }
}
function updateDrawerSub() {
  const sets = store.allSets();
  $('#drawer-sub').textContent = sets.length
    ? `${sets.length} sets logged · last session ${relDay(dayKey(sets[sets.length - 1].ts)).toLowerCase()}`
    : 'No sets logged yet';
}
$('#btn-menu').onclick = () => setDrawer(!drawer.classList.contains('open'));
scrim.onclick = () => setDrawer(false);
drawer.addEventListener('click', e => { if (e.target.closest('a[data-nav]')) { sheets.close(); setDrawer(false); } });
addEventListener('keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('open')) setDrawer(false); });

const recToggle = $('#recovery-toggle');
recToggle.checked = !!store.get('recovery');
recToggle.onchange = () => {
  store.setPref('recovery', recToggle.checked);
  if (recToggle.checked && !page.hidden) location.hash = '#/';
  setDrawer(false);
  repaint();
  if (recToggle.checked && !store.allSets().length) toast('Log some sets to see recovery');
};

$('#btn-add').onclick = () => {
  setDrawer(false);
  if (sheets.top()?.type === 'quick') return;
  sheets.open({ type: 'quick' }, { fresh: true });
};

// ------------------------------------------------------------ routing
const openExercise = id => sheets.open({ type: 'exercise', id, from: 'page' });

function route() {
  const [name, arg] = location.hash.replace(/^#\/?/, '').split('/');
  $$('a[data-nav]').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#/' + (name || '')));
  const el = document.createElement('div');
  const rerender = () => route();
  const pages = {
    journal: () => (arg ? sessionPage(el, arg, rerender) : journalPage(el)),
    progress: () => (arg ? progressPage(el, arg, openExercise) : progressList(el)),
    library: () => libraryPage(el, openExercise),
    settings: () => settingsPage(el, rerender),
    about: () => aboutPage(el),
  };
  if (!name || !pages[name]) {
    page.hidden = true;
    page.replaceChildren();
    document.title = 'Workout Log';
  } else {
    pages[name]();
    const wasHidden = page.hidden;
    page.replaceChildren(el);
    page.hidden = false;
    if (wasHidden) page.scrollTop = 0;
    document.title = `${name[0].toUpperCase() + name.slice(1)} · Workout Log`;
  }
  page.classList.toggle('receded', sheets.isOpen() && !page.hidden);
  repaint();
}
addEventListener('hashchange', () => { page.scrollTop = 0; route(); });
store.onChange(() => { if (!page.hidden) { if (sheets.isOpen()) pageDirty = true; else route(); } updateDrawerSub(); });

// Recovery fades continuously; refresh the tint every few minutes while the app is open.
setInterval(() => { if (store.get('recovery') && !sheets.isOpen()) repaint(); }, 5 * 60e3);

if (!store.isPersistent()) setTimeout(() => toast('Storage is unavailable: sets will not be saved'), 1500);
updateDrawerSub();
route();
initStage();

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

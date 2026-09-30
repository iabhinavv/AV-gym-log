// Exercise library: browse and filter everything.
import { EXERCISES } from '../data/exercises.js';
import { MUSCLES } from './muscles.js';
import { equipKind, EQUIP_KINDS, muscleName, esc, $ } from './lib.js';
import { IMAGES } from '../data/exercise-images.js';

const state = { q: '', muscle: '', equip: '' };

export function libraryPage(root, openExercise) {
  root.innerHTML = `<div class="page-inner wide">
    <h1>Exercise Library</h1>
    <p class="lede">${EXERCISES.length} exercises. Tap one for its guide and to log it.</p>
    <div class="lib-layout">
      <aside class="lib-filters">
        <input class="search" id="lib-q" type="search" placeholder="Search" value="${esc(state.q)}" autocomplete="off">
        <div class="label lib-flabel">Muscle</div>
        <div class="chips-row" id="lib-m">
          <button class="chip" data-m="" aria-pressed="${!state.muscle}">All muscles</button>
          ${MUSCLES.map(m => `<button class="chip" data-m="${m.id}" aria-pressed="${state.muscle === m.id}">${esc(m.name)}</button>`).join('')}
        </div>
        <div class="label lib-flabel">Equipment</div>
        <div class="chips-row" id="lib-e">
          <button class="chip" data-e="" aria-pressed="${!state.equip}">Any equipment</button>
          ${EQUIP_KINDS.map(k => `<button class="chip" data-e="${k}" aria-pressed="${state.equip === k}">${k}</button>`).join('')}
        </div>
      </aside>
      <div id="lib-list"></div>
    </div>
  </div>`;
  const draw = () => {
    const q = state.q.trim().toLowerCase();
    const list = EXERCISES.filter(e =>
      (!state.muscle || e.p.includes(state.muscle) || e.s.includes(state.muscle))
      && (!state.equip || equipKind(e) === state.equip)
      && (!q || e.name.toLowerCase().includes(q) || e.equipment.toLowerCase().includes(q)
          || [...e.p, ...e.s].some(m => muscleName(m).toLowerCase().includes(q))))
      .sort((a, b) => {
        if (state.muscle) {
          const ra = a.p.includes(state.muscle) ? 0 : 1, rb = b.p.includes(state.muscle) ? 0 : 1;
          if (ra !== rb) return ra - rb;
        }
        return a.name.localeCompare(b.name);
      });
    $('#lib-list', root).innerHTML = (list.length
      ? `<div class="lib-count label">${list.length} ${list.length === 1 ? 'exercise' : 'exercises'}</div>
        <ul class="lib-cards">${list.map(e => `<li data-ex="${e.id}" tabindex="0">
          ${IMAGES[e.id] ? `<img class="thumb" src="assets/exercises/${e.id}-0.jpg" alt="" loading="lazy" decoding="async">` : `<span class="thumb none"><span>${esc(muscleName(e.p[0]))}</span></span>`}
          <span class="body"><span class="nm">${esc(e.name)}</span>
            <span class="sub">${e.p.map(muscleName).join(', ')}${e.s.length ? ' · also ' + e.s.map(muscleName).join(', ') : ''}</span>
            <span class="meta"><span class="tag equip">${esc(equipKind(e))}</span><span class="tag">${e.type}</span></span></span></li>`).join('')}</ul>`
      : '<p class="empty">No exercises match those filters.</p>');
  };
  draw();
  $('#lib-q', root).addEventListener('input', e => { state.q = e.target.value; draw(); });
  root.addEventListener('click', e => {
    const m = e.target.closest('[data-m]'), q = e.target.closest('[data-e]'), ex = e.target.closest('[data-ex]');
    if (m) { state.muscle = m.dataset.m; root.querySelectorAll('[data-m]').forEach(b => b.setAttribute('aria-pressed', b === m)); draw(); }
    if (q) { state.equip = q.dataset.e; root.querySelectorAll('[data-e]').forEach(b => b.setAttribute('aria-pressed', b === q)); draw(); }
    if (ex) openExercise(ex.dataset.ex);
  });
  root.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-ex]')) openExercise(e.target.dataset.ex); });
}

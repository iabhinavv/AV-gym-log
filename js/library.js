// Exercise library: browse and filter everything.
import { EXERCISES } from '../data/exercises.js';
import { MUSCLES } from './muscles.js';
import { equipKind, EQUIP_KINDS, muscleName, esc, $ } from './lib.js';

const state = { q: '', muscle: '', equip: '' };

export function libraryPage(root, openExercise) {
  root.innerHTML = `<div class="page-inner">
    <h1>Exercise Library</h1>
    <p class="lede">${EXERCISES.length} exercises. Tap one for its guide and to log it.</p>
    <input class="search" id="lib-q" type="search" placeholder="Search" value="${esc(state.q)}" autocomplete="off">
    <div class="chips-row" id="lib-m">
      <button class="chip" data-m="" aria-pressed="${!state.muscle}">All muscles</button>
      ${MUSCLES.map(m => `<button class="chip" data-m="${m.id}" aria-pressed="${state.muscle === m.id}">${esc(m.name)}</button>`).join('')}
    </div>
    <div class="chips-row" id="lib-e">
      <button class="chip" data-e="" aria-pressed="${!state.equip}">Any equipment</button>
      ${EQUIP_KINDS.map(k => `<button class="chip" data-e="${k}" aria-pressed="${state.equip === k}">${k}</button>`).join('')}
    </div>
    <div id="lib-list"></div>
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
    $('#lib-list', root).innerHTML = list.length
      ? `<ul class="plain-list">${list.map(e => `<li data-ex="${e.id}" tabindex="0"><span>${esc(e.name)}
          <div class="sub">${e.p.map(muscleName).join(', ')}${e.s.length ? ' · also ' + e.s.map(muscleName).join(', ') : ''}</div></span>
          <span class="right">${esc(equipKind(e))}<div class="sub">${e.type}</div></span></li>`).join('')}</ul>`
      : '<p class="empty">No exercises match those filters.</p>';
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

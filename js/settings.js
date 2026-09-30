// Settings and Backup, and About and Credits.
import * as store from './store.js';
import { EXERCISES } from '../data/exercises.js';
import { MUSCLES } from './muscles.js';
import { toast, esc, $ } from './lib.js';

export function settingsPage(root, rerender) {
  const units = store.get('units'), lb = store.get('lastBackup'), n = store.allSets().length;
  const ago = lb ? Math.floor((Date.now() - lb) / 864e5) : null;
  const backupLine = !n ? 'Nothing to back up yet.'
    : lb == null ? 'You have not exported a backup yet.'
    : ago === 0 ? 'Last backup today.' : `Last backup ${ago} ${ago === 1 ? 'day' : 'days'} ago.`;
  root.innerHTML = `<div class="page-inner">
    <h1>Settings and Backup</h1>
    <p class="lede">Your journal lives only in this browser on this device.${store.isPersistent() ? '' : ' <b>Storage is unavailable here, so nothing will be saved after you close the page.</b>'}</p>
    <div class="setting"><div><div class="t">Units</div><div class="d">Weights are stored in kg and shown in your choice.</div></div>
      <div class="seg inline" role="tablist">${['kg', 'lb'].map(u => `<button data-units="${u}" aria-selected="${u === units}">${u}</button>`).join('')}</div></div>
    <div class="setting"><div><div class="t">Export backup</div><div class="d">${esc(backupLine)} ${n} sets in total.</div></div>
      <button class="btn" id="export"${n ? '' : ' disabled'}>Export</button></div>
    <div class="setting"><div><div class="t">Import backup</div><div class="d">Load a <code>workout-log-*.json</code> file exported from this app.</div></div>
      <label class="btn">Choose file<input type="file" id="import" accept="application/json,.json" hidden></label></div>
    <div class="setting"><div><div class="t">Clear all data</div><div class="d">Deletes every logged set from this browser. Export first.</div></div>
      <button class="btn danger" id="clear"${n ? '' : ' disabled'}>Clear</button></div>
  </div>`;
  root.querySelectorAll('[data-units]').forEach(b => b.onclick = () => { store.setPref('units', b.dataset.units); rerender(); });
  $('#export', root).onclick = () => { store.exportData(); toast('Backup downloaded'); rerender(); };
  $('#import', root).onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const parsed = store.parseImport(await f.text());
      const replace = store.allSets().length && confirm(
        `The file has ${parsed.sets.length} sets.\n\nOK: replace everything in this browser with the file.\nCancel: merge the file into what is here (duplicates are skipped).`);
      store.importData(parsed, replace ? 'replace' : 'merge');
      toast(replace ? 'Journal replaced from backup' : 'Backup merged');
      rerender();
    } catch (err) {
      alert(err.message + '\n\nYour existing data was not changed.');
    }
    e.target.value = '';
  };
  $('#clear', root).onclick = () => {
    if (!confirm('Delete every logged set from this browser?')) return;
    if (prompt('Type DELETE to confirm.') !== 'DELETE') { toast('Nothing was deleted'); return; }
    store.clearAll();
    toast('All data cleared');
    rerender();
  };
}

export function aboutPage(root) {
  root.innerHTML = `<div class="page-inner about">
    <h1>About and Credits</h1>
    <p class="lede">A workout log book built around a 3D model of the human muscular system.</p>
    <h2>How to use it</h2>
    <ul>
      <li>Drag to turn the body, pinch or scroll to zoom. Double-tap empty space to reset the view.</li>
      <li>Tap a muscle to see its exercises, ranked best first. Each shows its equipment and the other muscles it works.</li>
      <li>Tap an exercise for its guide, and to log weight and reps. On the body, primary muscles glow red, secondary ones amber, stabilisers grey.</li>
      <li>The plus button logs any exercise directly. Sets from the same day form one session in the Journal.</li>
      <li>Recovery view (in the menu) tints muscles by how recently and how hard you trained them: each primary set counts fully, each secondary set half, fading over 72 hours.</li>
    </ul>
    <h2>About the rankings</h2>
    <p>The ${EXERCISES.length} exercises across ${MUSCLES.length} muscle groups are ranked editorially: movements that load the target muscle hardest through a full range of motion, and that are practical in a normal gym, come first. They are a sensible starting point, not a rule; the best exercise is often the one you can do consistently without pain. This app is not medical advice.</p>
    <h2>Credits</h2>
    <p>Anatomy model derived from <b>BodyParts3D</b>, &copy; The Database Center for Life Science, licensed under
      <a href="https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en" target="_blank" rel="noopener">CC BY-SA 2.1 Japan</a>,
      via the per-part mirror by Kevin Moerman. The processed model (<code>assets/body.glb</code>) is shared under the same licence.</p>
    <p>3D rendering by <a href="https://threejs.org" target="_blank" rel="noopener">three.js</a> (MIT licence).</p>
  </div>`;
}

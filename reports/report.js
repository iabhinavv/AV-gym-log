// Strength report renderer. Plain script (no modules), so the page opens from a double-click.
// Inputs: data/index.js (report ids), data/library.js (muscles, exercises, photos), palette.js
// (status colours), then data/<id>.stats.js + data/<id>.coach.js and the previous report's stats.
(function () {
  'use strict';
  var LIB = window.GYM_LIBRARY || { muscles: [], exercises: {}, images: {} };
  var STATUS = window.GYM_STATUS, ORDER = window.GYM_STATUS_ORDER;
  var MUSCLES = LIB.muscles, EX = LIB.exercises, IMAGES = LIB.images;
  var MUSCLE = {};
  MUSCLES.forEach(function (m) { MUSCLE[m.id] = m; });
  var REGIONS = ['Chest', 'Shoulders', 'Back', 'Arms', 'Core', 'Hips', 'Legs', 'Head'];

  // Status colours become CSS variables so the stylesheet and the baked images always agree.
  ORDER.forEach(function (k) { document.documentElement.style.setProperty('--' + k, STATUS[k].color); });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(s, r) { return (r || document).querySelector(s); }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(iso) { var p = iso.split('-').map(Number); return p[2] + ' ' + MON[p[1] - 1] + ' ' + p[0]; }
  function fmtRange(a, b) {
    var x = a.split('-').map(Number), y = b.split('-').map(Number);
    if (x[0] === y[0] && x[1] === y[1]) return x[2] + ' to ' + y[2] + ' ' + MON[y[1] - 1] + ' ' + y[0];
    return fmtDate(a) + ' to ' + fmtDate(b);
  }
  // Blank lines separate paragraphs; single line breaks are just wrapping.
  function paras(t, cls) {
    return String(t || '').trim().split(/\n\s*\n/).map(function (p) {
      return '<p class="' + (cls || 'summary') + '">' + esc(p.replace(/\s*\n\s*/g, ' ')) + '</p>';
    }).join('');
  }
  function mName(id) { return MUSCLE[id] ? MUSCLE[id].name : id; }
  function loadScript(src) {
    return new Promise(function (res) {
      var s = document.createElement('script');
      s.src = src; s.onload = function () { res(true); }; s.onerror = function () { res(false); };
      document.head.appendChild(s);
    });
  }
  function autoStatus(m) {
    if (!m || m.setsPerWeek === 0) return 'untrained';
    if (m.setsPerWeek < 3) return 'weak';
    if (m.setsPerWeek < 6) return 'developing';
    return 'solid';
  }
  function dot(st) { return '<i class="dot" style="background:var(--' + st + ')"></i>'; }
  function delta(d, unit) {
    if (!d) return '';
    return '<span class="delta ' + (d > 0 ? 'up' : 'down') + '">' + (d > 0 ? '+' : '') + d + (unit || '') + '</span>';
  }

  function main() {
    var ids = window.GYM_REPORT_INDEX || [];
    var pick = $('#report-pick');
    var want = new URLSearchParams(location.search).get('r');
    var id = ids.indexOf(want) >= 0 ? want : ids[ids.length - 1];
    if (!id) { $('#report').innerHTML = '<div class="wrap"><p class="banner">No reports yet. See README.md, "Strength reports".</p></div>'; return; }
    if (!window.GYM_LIBRARY) { $('#report').innerHTML = '<div class="wrap"><p class="banner">reports/data/library.js is missing. Run tools/analyze.py.</p></div>'; return; }
    pick.innerHTML = ids.slice().reverse().map(function (r) {
      return '<option value="' + r + '"' + (r === id ? ' selected' : '') + '>Report ' + fmtDate(r) + '</option>';
    }).join('');
    pick.hidden = ids.length < 2;
    pick.onchange = function () { location.search = '?r=' + pick.value; };
    var prevId = ids[ids.indexOf(id) - 1];
    Promise.all([loadScript('data/' + id + '.stats.js'), loadScript('data/' + id + '.coach.js'),
      prevId ? loadScript('data/' + prevId + '.stats.js') : null]).then(function () {
      var rep = (window.GYM_REPORTS || {})[id] || {};
      if (!rep.stats) { $('#report').innerHTML = '<div class="wrap"><p class="banner">data/' + esc(id) + '.stats.js is missing. Run tools/analyze.py.</p></div>'; return; }
      var prev = prevId && window.GYM_REPORTS[prevId] ? window.GYM_REPORTS[prevId].stats : null;
      render(rep.stats, rep.coach || null, prev);
    });
  }

  function render(S, C, P) {
    var T = S.totals, B = S.body, prof = (C && C.profile) || {};
    var mStats = {};
    S.muscles.forEach(function (m) { mStats[m.id] = m; });
    function status(id) { return (C && C.muscles && C.muscles[id] && C.muscles[id].status) || autoStatus(mStats[id]); }
    var additions = (C && C.additions) || [];
    // Which additions train a muscle (primary or secondary).
    function addsFor(mid) {
      return additions.filter(function (a) { var e = EX[a.id]; return e && (e.p.indexOf(mid) >= 0 || e.s.indexOf(mid) >= 0); });
    }
    document.title = 'Strength Report ' + fmtDate(S.id) + " · AV's Gym Log";
    function chip(t) { return t ? '<span class="chip">' + esc(t) + '</span>' : ''; }
    var h = [];

    // ---------------- hero
    var kpis = [[T.sessions, '', 'Sessions'], [T.sessionsPerWeek, '/wk', 'Frequency'], [T.hardSetsPerWeek, '/wk', 'Hard sets'],
      [T.avgMinutes, 'min', 'Avg session'], [Math.round(T.failurePct), '%', 'Sets to failure']];
    if (B.ffmi) kpis.push([B.ffmi, '', 'FFMI'], [B.leanKg, 'kg', 'Lean mass']);
    h.push('<section class="hero"><div class="wrap">' +
      '<div class="label">Strength report · ' + esc(fmtRange(T.from, T.to)) + ' · ' + T.sessions + ' sessions</div>' +
      '<h1>' + esc(fmtDate(S.id)) + '</h1>' +
      '<div class="chips">' + chip(prof.heightCm && prof.heightCm + ' cm') + chip(B.weightKg + ' kg') +
      chip(B.bodyfatPct && 'about ' + B.bodyfatPct + '% body fat') + chip(prof.training) + chip(prof.sport) + chip(prof.injuries) + '</div>' +
      (C ? '<p class="headline">' + esc(C.headline) + '</p>' + paras(C.summary)
         : '<p class="banner">Coaching notes for this report have not been written yet (data/' + esc(S.id) + '.coach.js). The numbers below are complete.</p>') +
      '<div class="tiles">' + kpis.map(function (k) {
        return '<div class="tile"><div class="v">' + esc(k[0]) + '<small>' + esc(k[1]) + '</small></div><div class="k">' + esc(k[2]) + '</div></div>';
      }).join('') + '</div></div></section>');

    // ---------------- summary: strengths and weaknesses as text
    function sw(list, tone) {
      return '<ul class="sw ' + tone + '">' + list.map(function (it) {
        return '<li><h3>' + esc(it.title) + '</h3><p>' + esc(it.text) + '</p>' +
          (it.evidence ? '<div class="ev">' + esc(it.evidence) + '</div>' : '') +
          ((it.muscles || []).length ? '<div class="mchips">' + it.muscles.map(function (m) {
            return '<a class="mchip" href="#m-' + m + '">' + dot(status(m)) + esc(mName(m)) + '</a>';
          }).join('') + '</div>' : '') + '</li>';
      }).join('') + '</ul>';
    }
    if (C && (C.strengths || C.weaknesses)) {
      h.push('<section class="block" id="summary"><div class="wrap"><div class="two">' +
        '<div><div class="label">Strengths</div><h2>What you are doing well</h2>' + sw(C.strengths || [], 'good') + '</div>' +
        '<div><div class="label">Weaknesses</div><h2>What is holding you back</h2>' + sw(C.weaknesses || [], 'bad') + '</div>' +
        '</div></div></section>');
    }

    // ---------------- part by part
    var legend = '<div class="legend">' + ORDER.map(function (k) {
      return '<span>' + dot(k) + '<b>' + STATUS[k].label + '</b> ' + esc(STATUS[k].text) + '</span>';
    }).join('') + '</div>';
    var regions = REGIONS.map(function (reg) {
      var ms = MUSCLES.filter(function (m) { return m.region === reg; });
      if (!ms.length) return '';
      return '<h3 class="region">' + esc(reg) + '</h3><div class="parts">' + ms.map(function (m) {
        var st = status(m.id), ms_ = mStats[m.id] || {}, note = C && C.muscles && C.muscles[m.id] && C.muscles[m.id].note;
        var adds = addsFor(m.id);
        var pv = P && P.muscles ? P.muscles.filter(function (x) { return x.id === m.id; })[0] : null;
        var d = pv ? Math.round((ms_.setsPerWeek - pv.setsPerWeek) * 10) / 10 : 0;
        return '<article class="part s-' + st + '" id="m-' + m.id + '">' +
          '<div class="pimg"><img src="../assets/muscles/' + m.id + '-' + st + '.webp" alt="' + esc(m.name) + ' highlighted on the body" loading="lazy">' +
          '<span class="pstat" style="background:var(--' + st + ')">' + STATUS[st].label + '</span></div>' +
          '<div class="pbody"><h4>' + esc(m.name) + '</h4><div class="anat">' + esc(m.anat) + '</div>' +
          '<div class="pnums"><span><b>' + (ms_.setsPerWeek || 0) + '</b> sets/wk' + delta(d) + '</span><span><b>' + (ms_.daysPerWeek || 0) + '</b> days/wk</span>' +
          (ms_.lastTrained ? '<span>last ' + esc(fmtDate(ms_.lastTrained)) + '</span>' : '') + '</div>' +
          '<p>' + esc(note || m.job) + '</p>' +
          (adds.length ? '<div class="padd">Added: ' + adds.map(function (a) { return '<b>' + esc(EX[a.id].name) + '</b> on ' + esc(a.day) + ' day'; }).join(', ') + '</div>' : '') +
          '</div></article>';
      }).join('') + '</div>';
    }).join('');
    h.push('<section class="block" id="parts"><div class="wrap"><div class="label">Body parts</div><h2>Part by part</h2>' +
      '<p class="lede">Each muscle group, rated from your weekly sets and your lifts. Hotter colours mean better trained; dark grey-blue means no work at all.</p>' +
      legend + regions + '</div></section>');

    // ---------------- key lifts
    function prevLift(key) { return P && P.keyLifts ? P.keyLifts.filter(function (k) { return k.key === key; })[0] : null; }
    var rows = S.keyLifts.map(function (k) {
      var note = (C && C.keyLifts && C.keyLifts[k.key]) || {}, pv = prevLift(k.key);
      var best, ratio = '', level = k.level || 'Not trained', dd = '';
      if ('reps' in k) {
        best = k.logged ? k.reps + ' reps' : 'Not logged';
        if (pv && pv.reps != null && k.logged) dd = delta(k.reps - pv.reps);
      } else if (k.estimate) {
        best = k.estimate + ' kg<div class="sub">' + esc(k.converted ? 'from ' + k.fromName + ' (' + k.e1rm + ' kg)' : k.fromName) + '</div>';
        ratio = k.ratioBW.toFixed(2) + 'x';
        if (pv && pv.estimate) dd = delta(Math.round((k.estimate - pv.estimate) * 10) / 10, ' kg');
      } else best = 'Not trained';
      if (note.untested) { level = 'Untested'; ratio = ''; dd = ''; best = 'Not tested' + (k.fromName ? '<div class="sub">only ' + esc(k.fromName) + ', ' + k.e1rm + ' kg est.</div>' : ''); }
      var lvlSt = { Advanced: 'strong', Intermediate: 'solid', Novice: 'developing', Beginner: 'weak' }[level] || 'untrained';
      return '<tr><td><b>' + esc(k.label) + '</b></td><td>' + best + dd + '</td><td>' + ratio + '</td><td><span class="lvl">' + dot(lvlSt) + esc(level) + '</span></td>' +
        '<td>' + esc(note.target || '') + '</td><td class="note">' + esc(note.note || '') + '</td></tr>';
    }).join('');
    h.push('<section class="block" id="lifts"><div class="wrap"><div class="label">Key lifts</div><h2>Where your strength stands</h2>' +
      '<p class="lede">Estimated one-rep max (Epley) from your best set, compared with bodyweight (' + B.weightKg + ' kg). Levels are rough guides for adult men' +
      (P ? '; changes are against the ' + esc(fmtDate(P.id)) + ' report' : '') + '.</p>' +
      '<div class="scroll-x"><table class="table"><thead><tr><th>Lift</th><th>Best (e1RM)</th><th>x BW</th><th>Level</th><th>Next target</th><th>Note</th></tr></thead><tbody>' +
      rows + '</tbody></table></div></div></section>');

    // ---------------- volume bars
    var band = S.volumeBand, max = Math.max.apply(null, [22].concat(S.muscles.map(function (m) { return m.setsPerWeek; })));
    function pct(v) { return (v / max) * 100 + '%'; }
    var bars = S.muscles.map(function (m) {
      var st = status(m.id);
      return '<a class="bar-row" href="#m-' + m.id + '" title="' + esc(m.name) + ': ' + m.setsPerWeek + ' hard sets a week">' +
        '<span class="nm">' + dot(st) + esc(m.name) + '</span>' +
        '<span class="bar-track"><span class="band" style="left:' + pct(band.target) + ';width:calc(' + pct(band.high) + ' - ' + pct(band.target) + ')"></span>' +
        '<span class="fill" style="width:' + pct(m.setsPerWeek) + ';background:var(--' + st + ')"></span></span>' +
        '<span class="n">' + m.setsPerWeek + '</span></a>';
    }).join('');
    h.push('<section class="block" id="volume"><div class="wrap"><div class="label">Training volume</div><h2>Hard sets per muscle, per week</h2>' +
      '<p class="lede">A set counts fully for its main muscles and half for secondary ones. The shaded band (' + band.target + ' to ' + band.high +
      ') is a productive range for most muscles; under ' + band.low + ' is too little to grow or get stronger.</p>' +
      '<div class="bars">' + bars + '</div><p class="bars-key">' + T.hardSets + ' hard sets over ' + T.weeks + ' weeks. Sessions: ' +
      Object.keys(T.splits).map(function (k) { return esc(k) + ' ' + T.splits[k]; }).join(', ') + '.</p></div></section>');

    // ---------------- your week, plus one
    if (additions.length) {
      var days = additions.map(function (a) {
        var ex = EX[a.id] || { name: a.id, p: [], s: [], equipment: '' };
        var sess = S.sessions.filter(function (s) { return s.split === a.day; });
        var current = [];
        sess.forEach(function (s) { s.exercises.forEach(function (e) { if (current.indexOf(e) < 0) current.push(e); }); });
        var img = IMAGES[a.id] ? '<img src="../assets/exercises/' + a.id + '-0.jpg" alt="' + esc(ex.name) + '" loading="lazy">'
          : (ex.p[0] ? '<img src="../assets/muscles/' + ex.p[0] + '-strong.webp" alt="" loading="lazy">' : '');
        return '<article class="dayc"><div class="dayh"><span class="label">' + esc(a.day) + ' day</span>' +
          '<span class="sub">' + sess.length + ' logged · ' + current.length + ' exercises now</span></div>' +
          '<ol class="cur">' + current.map(function (e) { return '<li>' + esc(EX[e] ? EX[e].name : e) + '</li>'; }).join('') + '</ol>' +
          '<div class="newx"><div class="newimg">' + img + '<span class="newtag">Add</span></div>' +
          '<div class="newb"><h4>' + esc(ex.name) + '</h4>' +
          '<div class="dose"><span class="pill acc">' + esc(a.dose) + '</span><span class="pill">' + esc(a.position) + '</span>' + (a.time ? '<span class="pill">' + esc(a.time) + '</span>' : '') + '</div>' +
          '<div class="roles">' + ex.p.map(function (m) { return '<span class="role p">' + esc(mName(m)) + '</span>'; }).join('') +
          ex.s.map(function (m) { return '<span class="role s">' + esc(mName(m)) + '</span>'; }).join('') + '</div>' +
          '<p>' + esc(a.why) + '</p></div></div></article>';
      }).join('');
      h.push('<section class="block" id="week"><div class="wrap"><div class="label">Your week</div><h2>Keep your routine, add one exercise a day</h2>' +
        '<p class="lede">Your current days stay as they are. Each gets one addition: a compound lift, or an isolation exercise for a muscle that gets no work. ' +
        '<span class="key"><span class="role p">Main muscles</span><span class="role s">Also works</span></span></p>' +
        '<div class="week">' + days + '</div></div></section>');
    }

    // ---------------- improvements, MMA, nutrition
    if (C && C.improvements && C.improvements.length) {
      h.push('<section class="block" id="improve"><div class="wrap"><div class="label">Habits</div><h2>How to train the same exercises better</h2>' +
        '<ol class="steps">' + C.improvements.map(function (it) { return '<li><div><h3>' + esc(it.title) + '</h3><p>' + esc(it.text) + '</p></div></li>'; }).join('') + '</ol>' +
        ((C.mma && C.mma.length) || (C.nutrition && C.nutrition.length) ? '<div class="two" style="margin-top:40px">' +
          (C.mma && C.mma.length ? '<div><div class="label" style="margin-bottom:14px">MMA</div><div class="timeline">' + C.mma.map(function (p) {
            return '<div class="ph"><h3>' + esc(p.phase) + '</h3><p>' + esc(p.text) + '</p></div>'; }).join('') + '</div></div>' : '') +
          (C.nutrition && C.nutrition.length ? '<div><div class="label" style="margin-bottom:14px">Body composition and recovery</div>' +
            (B.ffmi ? '<p class="plainp">' + B.weightKg + ' kg = about ' + B.leanKg + ' kg lean and ' + B.fatKg + ' kg fat. BMI ' + B.bmi + '; FFMI ' + B.ffmi + ' (normalised ' + B.ffmiNormalised + ').</p>' : '') +
            '<ul class="plain">' + C.nutrition.map(function (n) { return '<li><b>' + esc(n.title) + '.</b> ' + esc(n.text) + '</li>'; }).join('') + '</ul></div>' : '') +
          '</div>' : '') + '</div></section>');
    }

    // ---------------- targets, sessions, notes
    var tgt = '';
    if (C && C.targets) {
      tgt = '<div class="scroll-x"><table class="table"><thead><tr><th>Measure</th><th>Now</th><th>Target</th></tr></thead><tbody>' +
        C.targets.map(function (t) { return '<tr><td><b>' + esc(t.label) + '</b></td><td>' + esc(t.now) + '</td><td>' + esc(t.target) + '</td></tr>'; }).join('') +
        S.keyLifts.filter(function (k) { return C.keyLifts && C.keyLifts[k.key] && C.keyLifts[k.key].target; }).map(function (k) {
          return '<tr><td><b>' + esc(k.label) + '</b></td><td>' + ('reps' in k ? k.reps + ' reps' : C.keyLifts[k.key].untested ? 'Not tested' : k.estimate ? k.estimate + ' kg' : '-') +
            '</td><td>' + esc(C.keyLifts[k.key].target) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    h.push('<section class="block" id="targets"><div class="wrap"><div class="label">Targets</div><h2>For the next report</h2>' + tgt +
      '<h3 class="label" style="margin:34px 0 10px">Sessions in this report</h3>' +
      '<div class="scroll-x"><table class="table"><thead><tr><th>Date</th><th>Type</th><th>Sets</th><th>Time</th><th>Exercises</th></tr></thead><tbody>' +
      S.sessions.map(function (s) {
        return '<tr><td>' + esc(s.weekday) + ' ' + esc(fmtDate(s.date)) + '</td><td>' + esc(s.split) + '</td><td>' + s.sets + '</td><td>' + s.minutes + ' min</td>' +
          '<td class="note">' + s.exercises.map(function (e) { return esc(EX[e] ? EX[e].name : e); }).join(', ') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="two" style="margin-top:34px">' +
      (C && C.logging && C.logging.length ? '<div><div class="label" style="margin-bottom:10px">Logging notes</div><ul class="plain">' + C.logging.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul></div>' : '') +
      '<div><div class="label" style="margin-bottom:10px">How this was worked out</div><ul class="plain">' +
      ((C && C.caveats) || []).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') +
      '<li>Generated from ' + esc(S.export) + ' with tools/analyze.py on ' + esc(fmtDate(S.generated)) + '. A hard set counts fully for primary muscles and half for secondary; warm-ups and rest-pause clusters are handled as described in README.md.</li>' +
      '</ul></div></div></div></section>');
    h.push("<footer><div class=\"wrap\">AV's Gym Log strength report · " + esc(fmtDate(S.id)) + '. Muscle images from BodyParts3D, (c) The Database Center for Life Science, CC BY-SA 2.1 JP. Exercise photos: free-exercise-db (public domain).</div></footer>');
    $('#report').innerHTML = h.join('');
  }

  main();
})();

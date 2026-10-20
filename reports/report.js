// Strength report renderer. Plain script (no modules), so the page opens from a double-click.
// Inputs: data/index.js (report ids), data/library.js (muscles, exercises, photos), palette.js
// (status colours), then data/<id>.stats.js + data/<id>.coach.js and the previous report's stats.
//
// Two views on one page, switched by the URL hash (works on file://):
//   (default)         the summary: short text, long passages folded into "More"
//   #muscle/<id>      the detail page for one muscle, opened from the weekly-sets chart
(function () {
  'use strict';
  var LIB = window.GYM_LIBRARY || { muscles: [], exercises: {}, images: {} };
  var STATUS = window.GYM_STATUS, ORDER = window.GYM_STATUS_ORDER;
  var MUSCLES = LIB.muscles, EX = LIB.exercises, IMAGES = LIB.images;
  var MUSCLE = {};
  MUSCLES.forEach(function (m) { MUSCLE[m.id] = m; });
  var IG = 'https://www.instagram.com/fitfoundrs';

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
  function flat(t) { return String(t || '').trim().replace(/\s*\n\s*/g, ' '); }
  // Long text: the first two sentences stay visible, the rest folds into "Read more".
  function brief(t, cls) {
    // A sentence ends at . ! or ? followed by a space and a capital, so "3.3 a week" stays whole.
    var text = flat(t), parts = text.split(/(?<=[.!?])\s+(?=[A-Z("])/);
    var head = parts.slice(0, 2).join(' ').trim(), rest = parts.slice(2).join(' ').trim();
    return '<p class="' + (cls || 'summary') + '">' + esc(head) + '</p>' +
      (rest ? '<details class="more"><summary>Read more</summary><p class="' + (cls || 'summary') + '">' + esc(rest) + '</p></details>' : '');
  }
  function mName(id) { return MUSCLE[id] ? MUSCLE[id].name : id; }
  function exName(id) { return EX[id] ? EX[id].name : id; }
  var STAR = '<svg class="star on" viewBox="0 0 24 24" aria-label="Favourite"><path d="M12 3.4l2.65 5.37 5.93.86-4.29 4.18 1.01 5.9L12 16.93l-5.3 2.78 1.01-5.9-4.29-4.18 5.93-.86z"/></svg>';
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
  function fmtBest(set, measure) {
    if (!set) return '';
    if (measure === 'sec') return set[1] + ' s' + (set[0] ? ' with ' + set[0] + ' kg' : '');
    if (measure === 'm') return set[1] + ' m' + (set[0] ? ' with ' + set[0] + ' kg' : '');
    return (set[0] ? set[0] + ' kg' : 'Bodyweight') + ' x ' + set[1];
  }
  function fold(title, body, cls) { return '<details class="fold ' + (cls || '') + '"><summary>' + title + '</summary><div class="fold-body">' + body + '</div></details>'; }

  var R = null;   // the loaded report: { S, C, P, status(), mStats }

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
    pick.onchange = function () { location.href = '?r=' + pick.value; };
    var prevId = ids[ids.indexOf(id) - 1];
    Promise.all([loadScript('data/' + id + '.stats.js'), loadScript('data/' + id + '.coach.js'),
      prevId ? loadScript('data/' + prevId + '.stats.js') : null]).then(function () {
      var rep = (window.GYM_REPORTS || {})[id] || {};
      if (!rep.stats) { $('#report').innerHTML = '<div class="wrap"><p class="banner">data/' + esc(id) + '.stats.js is missing. Run tools/analyze.py.</p></div>'; return; }
      var S = rep.stats, C = rep.coach || null;
      var mStats = {};
      S.muscles.forEach(function (m) { mStats[m.id] = m; });
      R = {
        S: S, C: C, mStats: mStats,
        P: prevId && window.GYM_REPORTS[prevId] ? window.GYM_REPORTS[prevId].stats : null,
        status: function (mid) { return (C && C.muscles && C.muscles[mid] && C.muscles[mid].status) || autoStatus(mStats[mid]); },
      };
      document.title = 'Strength Report ' + fmtDate(S.id) + " · AV's Gym Log";
      window.addEventListener('hashchange', route);
      route();
    });
  }

  var lastSummaryScroll = 0;
  function route() {
    var m = /^#muscle\/([a-z-]+)$/.exec(location.hash);
    if (m && MUSCLE[m[1]]) {
      if (!$('#muscle-page')) lastSummaryScroll = window.scrollY;
      $('#report').innerHTML = musclePage(m[1]);
      document.body.classList.add('on-detail');
      window.scrollTo(0, 0);
      return;
    }
    var fromDetail = document.body.classList.contains('on-detail') || !$('#summary-page');
    document.body.classList.remove('on-detail');
    if (fromDetail) $('#report').innerHTML = summaryPage();
    var target = location.hash && location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null;
    if (target) target.scrollIntoView();
    else if (fromDetail && lastSummaryScroll) window.scrollTo(0, lastSummaryScroll);
  }

  // ------------------------------------------------------------ summary page
  function summaryPage() {
    var S = R.S, C = R.C, P = R.P, T = S.totals, B = S.body, prof = (C && C.profile) || {}, status = R.status;
    var additions = (C && C.additions) || [];
    var h = ['<div id="summary-page">'];
    function chip(t) { return t ? '<span class="chip">' + esc(t) + '</span>' : ''; }

    // ---------------- hero
    var kpis = [[T.sessions, '', 'Sessions'], [T.sessionsPerWeek, '/wk', 'Frequency'], [T.hardSetsPerWeek, '/wk', 'Hard sets'],
      [T.avgMinutes, 'min', 'Avg session'], [Math.round(T.failurePct), '%', 'Sets to failure']];
    if (B.ffmi) kpis.push([B.ffmi, '', 'FFMI'], [B.leanKg, 'kg', 'Lean mass']);
    h.push('<section class="hero" id="top"><div class="wrap">' +
      '<div class="label">Strength report · ' + esc(fmtRange(T.from, T.to)) + ' · ' + T.sessions + ' sessions</div>' +
      '<h1>' + esc(fmtDate(S.id)) + '</h1>' +
      '<div class="chips">' + chip(prof.heightCm && prof.heightCm + ' cm') + chip(B.weightKg + ' kg') +
      chip(B.bodyfatPct && 'about ' + B.bodyfatPct + '% body fat') + chip(prof.training) + chip(prof.sport) + chip(prof.injuries) + '</div>' +
      (C ? '<p class="headline">' + esc(C.headline) + '</p>' + brief(C.summary)
         : '<p class="banner">Coaching notes for this report have not been written yet (data/' + esc(S.id) + '.coach.js). The numbers below are complete.</p>') +
      '<div class="tiles">' + kpis.map(function (k) {
        return '<div class="tile"><div class="v">' + esc(k[0]) + '<small>' + esc(k[1]) + '</small></div><div class="k">' + esc(k[2]) + '</div></div>';
      }).join('') + '</div></div></section>');

    // ---------------- most frequent exercises
    var top = S.topExercises || [];
    if (top.length) {
      var maxS = Math.max.apply(null, top.map(function (t) { return t.sets; }));
      h.push('<section class="block" id="frequent"><div class="wrap"><div class="label">Most frequent</div><h2>The exercises you do most</h2>' +
        '<p class="lede">Ranked by how many sessions include them, then by sets. A star marks your favourites in the app.</p>' +
        '<ol class="freq">' + top.map(function (t, i) {
          var img = IMAGES[t.id] ? '<img src="../assets/exercises/' + t.id + '-0.jpg" alt="" loading="lazy">' : '<span class="noimg"></span>';
          return '<li><span class="fr">' + (i + 1) + '</span>' + img +
            '<span class="fb"><b>' + esc(t.name) + (t.fav ? STAR : '') + '</b>' +
            '<span class="sub">' + t.sessions + ' of ' + T.sessions + ' sessions · ' + t.sets + ' sets · best ' + esc(fmtBest(t.bestSet, t.measure)) + '</span>' +
            '<span class="fbar"><span style="width:' + (t.sets / maxS * 100) + '%"></span></span></span></li>';
        }).join('') + '</ol></div></section>');
    }

    // ---------------- hard sets per week: each muscle opens its own page
    var band = S.volumeBand, max = Math.max.apply(null, [22].concat(S.muscles.map(function (m) { return m.setsPerWeek; })));
    function pct(v) { return (v / max) * 100 + '%'; }
    var prevSets = {};
    if (P && P.muscles) P.muscles.forEach(function (m) { prevSets[m.id] = m.setsPerWeek; });
    var bars = S.muscles.map(function (m) {
      var st = status(m.id), d = prevSets[m.id] != null ? Math.round((m.setsPerWeek - prevSets[m.id]) * 10) / 10 : 0;
      return '<a class="bar-row" href="#muscle/' + m.id + '" title="Open ' + esc(m.name) + '">' +
        '<span class="nm">' + dot(st) + esc(m.name) + '</span>' +
        '<span class="bar-track"><span class="band" style="left:' + pct(band.target) + ';width:calc(' + pct(band.high) + ' - ' + pct(band.target) + ')"></span>' +
        '<span class="fill" style="width:' + pct(m.setsPerWeek) + ';background:var(--' + st + ')"></span></span>' +
        '<span class="n">' + m.setsPerWeek + delta(d) + '</span><span class="go" aria-hidden="true"></span></a>';
    }).join('');
    h.push('<section class="block" id="volume"><div class="wrap"><div class="label">Every muscle</div><h2>Hard sets per week</h2>' +
      '<p class="lede">Tap a muscle for its own page: rating, picture, what trains it and what was added. The shaded band (' + band.target + ' to ' + band.high +
      ') is a productive range; under ' + band.low + ' is too little.</p>' +
      '<div class="legend">' + ORDER.map(function (k) { return '<span>' + dot(k) + '<b>' + STATUS[k].label + '</b></span>'; }).join('') + '</div>' +
      '<div class="bars">' + bars + '</div></div></section>');

    // ---------------- your week, plus one
    if (additions.length) {
      h.push('<section class="block" id="week"><div class="wrap"><div class="label">Your week</div><h2>Keep your routine, add one exercise a day</h2>' +
        '<div class="week">' + additions.map(function (a) {
          var ex = EX[a.id] || { name: a.id, p: [], s: [] };
          var current = [];
          S.sessions.filter(function (s) { return s.split === a.day; }).forEach(function (s) {
            s.exercises.forEach(function (e) { if (current.indexOf(e) < 0) current.push(e); });
          });
          var img = IMAGES[a.id] ? '<img src="../assets/exercises/' + a.id + '-0.jpg" alt="" loading="lazy">'
            : (ex.p[0] ? '<img src="../assets/muscles/' + ex.p[0] + '-strong.webp" alt="" loading="lazy">' : '');
          return '<article class="dayc"><div class="label">' + esc(a.day) + ' day</div>' +
            '<div class="newx"><div class="newimg">' + img + '<span class="newtag">Add</span></div>' +
            '<div class="newb"><h4>' + esc(ex.name) + '</h4>' +
            '<div class="dose"><span class="pill acc">' + esc(a.dose) + '</span><span class="pill">' + esc(a.position) + '</span>' + (a.time ? '<span class="pill">' + esc(a.time) + '</span>' : '') + '</div>' +
            '<div class="roles">' + ex.p.map(function (m) { return '<a class="role p" href="#muscle/' + m + '">' + esc(mName(m)) + '</a>'; }).join('') +
            ex.s.map(function (m) { return '<a class="role s" href="#muscle/' + m + '">' + esc(mName(m)) + '</a>'; }).join('') + '</div></div></div>' +
            fold('Why this one', '<p>' + esc(a.why) + '</p>') +
            fold('Your current ' + a.day.toLowerCase() + ' exercises (' + current.length + ')', '<ol class="cur">' + current.map(function (e) { return '<li>' + esc(exName(e)) + '</li>'; }).join('') + '</ol>') +
            '</article>';
        }).join('') + '</div></div></section>');
    }

    // ---------------- key lifts (notes folded)
    var notes = [];
    var rows = S.keyLifts.map(function (k) {
      var note = (C && C.keyLifts && C.keyLifts[k.key]) || {};
      var pv = P && P.keyLifts ? P.keyLifts.filter(function (x) { return x.key === k.key; })[0] : null;
      var best, ratio = '', level = k.level || 'Not trained', dd = '';
      if ('reps' in k) {
        best = k.logged ? k.reps + ' reps' : 'Not logged';
        if (pv && pv.reps != null && k.logged) dd = delta(k.reps - pv.reps);
      } else if (k.estimate) {
        best = k.estimate + ' kg'; ratio = k.ratioBW.toFixed(2) + 'x';
        if (pv && pv.estimate) dd = delta(Math.round((k.estimate - pv.estimate) * 10) / 10, ' kg');
      } else best = 'Not trained';
      if (note.untested) { level = 'Untested'; ratio = ''; dd = ''; best = 'Not tested'; }
      if (note.note) notes.push('<li><b>' + esc(k.label) + '.</b> ' + esc(note.note) + (k.converted && !note.untested ? ' (Estimated from ' + esc(k.fromName) + '.)' : '') + '</li>');
      var lvlSt = { Advanced: 'strong', Intermediate: 'solid', Novice: 'developing', Beginner: 'weak' }[level] || 'untrained';
      return '<tr><td><b>' + esc(k.label) + '</b></td><td>' + best + dd + '</td><td>' + ratio + '</td><td><span class="lvl">' + dot(lvlSt) + esc(level) + '</span></td><td>' + esc(note.target || '') + '</td></tr>';
    }).join('');
    h.push('<section class="block" id="lifts"><div class="wrap"><div class="label">Key lifts</div><h2>Where your strength stands</h2>' +
      '<p class="lede">Estimated one-rep max from your best set, against bodyweight (' + B.weightKg + ' kg).' + (P ? ' Changes are against the ' + esc(fmtDate(P.id)) + ' report.' : '') + '</p>' +
      '<div class="scroll-x"><table class="table"><thead><tr><th>Lift</th><th>Best (e1RM)</th><th>x BW</th><th>Level</th><th>Next target</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      (notes.length ? fold('Notes on each lift', '<ul class="plain">' + notes.join('') + '</ul>') : '') + '</div></section>');

    // ---------------- targets
    if (C && C.targets) {
      h.push('<section class="block" id="targets"><div class="wrap"><div class="label">Targets</div><h2>For the next report</h2>' +
        '<div class="scroll-x"><table class="table"><thead><tr><th>Measure</th><th>Now</th><th>Target</th></tr></thead><tbody>' +
        C.targets.map(function (t) { return '<tr><td><b>' + esc(t.label) + '</b></td><td>' + esc(t.now) + '</td><td>' + esc(t.target) + '</td></tr>'; }).join('') +
        '</tbody></table></div></div></section>');
    }

    // ---------------- habits, sport, nutrition (titles shown, text folded)
    if (C && C.improvements && C.improvements.length) {
      h.push('<section class="block" id="improve"><div class="wrap"><div class="label">Habits</div><h2>How to train the same exercises better</h2>' +
        '<div class="folds">' + C.improvements.map(function (it, i) { return fold('<span class="num">' + (i + 1) + '</span>' + esc(it.title), '<p>' + esc(it.text) + '</p>'); }).join('') + '</div>' +
        (C.mma && C.mma.length ? '<h3 class="sublabel">MMA</h3><div class="folds">' + C.mma.map(function (p) { return fold(esc(p.phase), '<p>' + esc(p.text) + '</p>'); }).join('') + '</div>' : '') +
        (C.nutrition && C.nutrition.length ? '<h3 class="sublabel">Body composition and recovery</h3>' +
          (B.ffmi ? '<p class="plainp">' + B.weightKg + ' kg = about ' + B.leanKg + ' kg lean and ' + B.fatKg + ' kg fat (FFMI ' + B.ffmi + ').</p>' : '') +
          '<div class="folds">' + C.nutrition.map(function (n) { return fold(esc(n.title), '<p>' + esc(n.text) + '</p>'); }).join('') + '</div>' : '') +
        '</div></section>');
    }

    // ---------------- doing well / holding back, at the end
    function sw(list, tone) {
      return '<div class="folds">' + list.map(function (it) {
        return fold('<span class="tone ' + tone + '"></span>' + esc(it.title),
          '<p>' + esc(it.text) + '</p>' + (it.evidence ? '<div class="ev">' + esc(it.evidence) + '</div>' : '') +
          ((it.muscles || []).length ? '<div class="mchips">' + it.muscles.map(function (m) {
            return '<a class="mchip" href="#muscle/' + m + '">' + dot(status(m)) + esc(mName(m)) + '</a>';
          }).join('') + '</div>' : ''));
      }).join('') + '</div>';
    }
    if (C && (C.strengths || C.weaknesses)) {
      h.push('<section class="block" id="strengths"><div class="wrap"><div class="two">' +
        '<div><div class="label">Strengths</div><h2>What you are doing well</h2>' + sw(C.strengths || [], 'good') + '</div>' +
        '<div><div class="label">Weaknesses</div><h2>What is holding you back</h2>' + sw(C.weaknesses || [], 'bad') + '</div>' +
        '</div></div></section>');
    }

    // ---------------- sessions and notes, folded
    h.push('<section class="block" id="notes"><div class="wrap"><div class="label">Details</div><h2>Sessions and notes</h2><div class="folds">' +
      fold('Sessions in this report (' + S.sessions.length + ')', '<div class="scroll-x"><table class="table"><thead><tr><th>Date</th><th>Type</th><th>Sets</th><th>Time</th><th>Exercises</th></tr></thead><tbody>' +
        S.sessions.map(function (s) {
          return '<tr><td>' + esc(s.weekday) + ' ' + esc(fmtDate(s.date)) + '</td><td>' + esc(s.split) + '</td><td>' + s.sets + '</td><td>' + s.minutes + ' min</td>' +
            '<td class="note">' + s.exercises.map(function (e) { return esc(exName(e)); }).join(', ') + '</td></tr>';
        }).join('') + '</tbody></table></div>') +
      (C && C.logging && C.logging.length ? fold('Logging notes', '<ul class="plain">' + C.logging.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>') : '') +
      fold('How this was worked out', '<ul class="plain">' + ((C && C.caveats) || []).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') +
        '<li>Generated from ' + esc(S.export) + ' with tools/analyze.py on ' + esc(fmtDate(S.generated)) + '. A hard set counts fully for primary muscles and half for secondary; warm-ups and rest-pause clusters are handled as described in README.md.</li></ul>') +
      '</div></div></section>');
    h.push(footer());
    h.push('</div>');
    return h.join('');
  }

  // ------------------------------------------------------------ one muscle
  function musclePage(mid) {
    var S = R.S, C = R.C, P = R.P, status = R.status;
    var m = MUSCLE[mid], st = status(mid), ms = R.mStats[mid] || {};
    var note = C && C.muscles && C.muscles[mid] && C.muscles[mid].note;
    var pv = P && P.muscles ? P.muscles.filter(function (x) { return x.id === mid; })[0] : null;
    var d = pv ? Math.round((ms.setsPerWeek - pv.setsPerWeek) * 10) / 10 : 0;
    var used = S.exercises.filter(function (e) { var x = EX[e.id]; return x && (x.p.indexOf(mid) >= 0 || x.s.indexOf(mid) >= 0); })
      .map(function (e) { return { e: e, role: EX[e.id].p.indexOf(mid) >= 0 ? 'p' : 's' }; })
      .sort(function (a, b) { return (a.role === b.role ? 0 : a.role === 'p' ? -1 : 1) || b.e.sets - a.e.sets; });
    var adds = ((C && C.additions) || []).filter(function (a) { var x = EX[a.id]; return x && (x.p.indexOf(mid) >= 0 || x.s.indexOf(mid) >= 0); });
    var order = S.muscles.map(function (x) { return x.id; }), i = order.indexOf(mid);
    var prev = order[(i - 1 + order.length) % order.length], next = order[(i + 1) % order.length];
    return '<div id="muscle-page"><div class="wrap">' +
      '<nav class="crumbs"><a href="#volume">Back to summary</a><span>' +
      '<a href="#muscle/' + prev + '">Previous: ' + esc(mName(prev)) + '</a><a href="#muscle/' + next + '">Next: ' + esc(mName(next)) + '</a></span></nav>' +
      '<div class="mhero">' +
        '<div class="mimg s-' + st + '"><img src="../assets/muscles/' + mid + '-' + st + '.webp" alt="' + esc(m.name) + ' highlighted on the body">' +
        '<span class="pstat" style="background:var(--' + st + ')">' + STATUS[st].label + '</span></div>' +
        '<div class="mtext"><div class="label">' + esc(m.region) + '</div><h1>' + esc(m.name) + '</h1>' +
        '<div class="anat">' + esc(m.anat) + '</div>' +
        '<div class="tiles">' +
          '<div class="tile"><div class="v">' + (ms.setsPerWeek || 0) + delta(d) + '</div><div class="k">Hard sets a week</div></div>' +
          '<div class="tile"><div class="v">' + (ms.daysPerWeek || 0) + '</div><div class="k">Days a week</div></div>' +
          '<div class="tile"><div class="v sm">' + (ms.lastTrained ? esc(fmtDate(ms.lastTrained)) : 'Never') + '</div><div class="k">Last trained</div></div>' +
        '</div>' +
        '<p class="mnote">' + esc(note || '') + '</p>' +
        '<p class="mjob"><b>What it does.</b> ' + esc(m.job) + '</p></div>' +
      '</div>' +
      (adds.length ? '<h2 class="sec">Added this round</h2><div class="madds">' + adds.map(function (a) {
        return '<div class="madd"><b>' + esc(exName(a.id)) + '</b> on ' + esc(a.day) + ' day · <span class="pill acc">' + esc(a.dose) + '</span><p>' + esc(a.why) + '</p></div>';
      }).join('') + '</div>' : '') +
      '<h2 class="sec">What trains it in your log</h2>' +
      (used.length ? '<ul class="mused">' + used.map(function (u) {
        var e = u.e;
        return '<li><span class="role ' + u.role + '">' + (u.role === 'p' ? 'Main' : 'Also') + '</span><b>' + esc(e.name) + '</b>' +
          '<span class="sub">' + e.sets + ' sets in ' + e.sessions + ' sessions · best ' + esc(fmtBest(e.bestSet, e.measure)) + (e.bestE1rm ? ' · e1RM ' + e.bestE1rm + ' kg' : '') + '</span></li>';
      }).join('') + '</ul>' : '<p class="empty">Nothing in this period trained it.</p>') +
      '</div>' + footer() + '</div>';
  }

  function footer() {
    return '<footer><div class="wrap"><a class="ff" href="' + IG + '" target="_blank" rel="noopener"><img src="../assets/icon-64.png" alt="" width="36" height="36">' +
      '<span><b>A free FitFounders app</b><small>Follow the campaign on Instagram</small></span></a>' +
      "<p>AV's Gym Log strength report · " + esc(fmtDate(R.S.id)) + '. Muscle images from BodyParts3D, (c) The Database Center for Life Science, CC BY-SA 2.1 JP. Exercise photos: free-exercise-db (public domain).</p></div></footer>';
  }

  main();
})();

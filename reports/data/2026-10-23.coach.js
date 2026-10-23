// Coaching notes for the 2026-10-23 report: the week of 17 to 23 October, the routine AV says he
// can keep up. Numbers live in 2026-10-23.stats.js (tools/analyze.py ... --since 2026-10-17).
window.GYM_REPORTS = window.GYM_REPORTS || {};
(window.GYM_REPORTS['2026-10-23'] = window.GYM_REPORTS['2026-10-23'] || {}).coach = {
  profile: {
    heightCm: 173, weightKg: 92, bodyfatPct: 25,
    training: 'Legs Mon, Arms Tue, Pull Thu, Push Fri; swimming Wed and weekends',
    sport: 'MMA 4 to 5 times a week from December 2026',
    injuries: 'No current injuries',
    goal: 'Get stronger and arrive at MMA in December ready for the extra load',
  },

  headline: 'You did what the last report asked: squats, deadlifts and core work are in, and 15 of 25 muscle groups now get enough work. The next risk is total volume once MMA starts.',
  summary: `This is the week you said you can keep up: four gym days (legs, arms, pull, push) and swimming on the other days.
You added the back squat, the deadlift and the woodchop, and on your own you added lying leg curls, the hip abduction machine,
face pulls and lateral raises. Hamstrings went from 2.3 to 7 hard sets a week, glutes from 3.7 to 8.5, lower back from 0.7 to
5.5, abs and obliques from under 1 to 6.5, and side delts from 2.1 to 5.

Two things now matter most. First, the big lifts come late in the session: the squat was the sixth exercise on leg day and
the deadlift came after carries and shrugs, so you are lifting them tired. Second, the week adds up to 82 hard sets in about
4.5 hours, and 40% of compound sets still end in failure. That is fine on its own, but with MMA 4 to 5 times a week from
December it will be more than you can recover from. Keep the same days and exercises; plan to trim sets, not exercises.`,

  muscles: {
    'traps':        { status: 'strong',     note: '14 hard sets a week from shrugs, carries and rows. Farmer\'s carry up from 40 to 45 kg (both hands).' },
    'triceps':      { status: 'strong',     note: '15 sets a week: arms day plus pressing. Pushdowns hold 30 kg for 10 to 12 reps; overhead extension 20 kg x 11.5.' },
    'biceps':       { status: 'strong',     note: '11 sets a week. Bayesian curl went from 10 to 15 kg, and EZ-bar curl reached 30 kg x 8.5.' },
    'forearms':     { status: 'strong',     note: '11.5 sets a week; heavy carries and deadlifts give your grip plenty of work.' },
    'chest':        { status: 'solid',      note: '11 sets a week. Machine chest press was 45 kg x 7.5 this week, down from 55 to 60 kg earlier, possibly a different machine; decline bench 55 x 7.5.' },
    'upper-back':   { status: 'solid',      note: '12 sets a week from machine rows, face pulls and shrugs; machine row 40 kg x 9.5, but 3 of 4 sets to failure.' },
    'lats':         { status: 'solid',      note: '8 sets a week. Lat pulldown 60 x 8.5, a little under your best of 65 x 8.5, with 3 of 4 sets to failure.' },
    'delts-front':  { status: 'solid',      note: '9.5 sets a week from pressing; seated dumbbell press 15 kg x 8.5 per hand.' },
    'delts-rear':   { status: 'solid',      note: '8 sets a week, up from 4. Face pulls climbed from 15 to 30 kg within one session.' },
    'glutes':       { status: 'solid',      note: '8.5 sets a week, up from 3.7, now that squats and deadlifts are in.' },
    'quads':        { status: 'solid',      note: '8 sets a week. Back squat 80 kg x 10 twice (estimated 1RM about 107 kg, 1.16x bodyweight), even though it came last.' },
    'hamstrings':   { status: 'solid',      note: '7 sets a week, up from 2.3: lying leg curl 40 kg x 12, plus deadlifts.' },
    'adductors':    { status: 'solid',      note: '6.5 sets a week; adduction machine 45 kg x 11.5.' },
    'chest-upper':  { status: 'developing', note: '5 sets a week; incline dumbbell press only got 2 sets at the end of push day.' },
    'delts-side':   { status: 'developing', note: '5 sets a week, up from 2.1. Cable lateral raise 10 kg x 9.5 per arm.' },
    'lower-back':   { status: 'developing', note: '5.5 sets a week, up from 0.7, almost all from the new deadlift.' },
    'abs':          { status: 'developing', note: '6.5 sets a week, up from under 1, from bodyweight crunches and the woodchop. The hanging leg raise from last time was not done.' },
    'obliques':     { status: 'developing', note: '6.5 sets a week, up from under 1. Woodchop 15 kg x 15 for 3 sets with no failures, so add weight.' },
    'calves':       { status: 'developing', note: '5.5 sets a week, holding at 70 kg x 15. Steady, but only one day a week.' },
    'abductors':    { status: 'developing', note: '3 sets a week, up from 0, from the new hip abduction machine (50 kg x 12).' },
    'rotator-cuff': { status: 'weak',       note: '2 sets a week, from face pulls only. Swimming and MMA will load the shoulders more from December.' },
    'serratus':     { status: 'untrained',  note: 'No direct work. It drives the reach at the end of a punch.' },
    'hip-flexors':  { status: 'untrained',  note: 'No direct work; knees, kicks and guard work need them.' },
    'shins':        { status: 'untrained',  note: 'No direct work. Tibialis strength helps knees and footwork.' },
    'neck':         { status: 'untrained',  note: 'No neck work yet; important before sparring starts in December.' },
  },

  // One per training day, as before: an isolation exercise for a muscle that gets no work at all
  // (the compound gaps were closed last round). Each is a few minutes.
  additions: [
    { day: 'Push', id: 'push-up-plus', position: 'Instead of your warm-up push-ups', dose: '2 x 10, slow push at the top', time: 'no extra time',
      why: 'Serratus gets no work. Turning the warm-up push-ups you already do into push-up plus trains it at no extra cost.' },
    { day: 'Pull', id: 'hanging-leg-raise', position: 'Last', dose: '3 x 8-12', time: 'about 5 min',
      why: 'Hip flexors get no work and abs only get bodyweight crunches. You are already at the pull-up bar on pull day, and it trains grip too. It moves here from arms day, where it was not done.' },
    { day: 'Arms', id: 'neck-curl', position: 'Last', dose: '2 x 15-20 with a light plate', time: 'about 4 min',
      why: 'Neck strength protects you in sparring and in the clinch. Arms day is your shortest session (45 minutes), so it fits. Start very light and add weight slowly over weeks.' },
    { day: 'Legs', id: 'tibialis-raise', position: 'Last, against a wall', dose: '2 x 15-20', time: 'about 3 min',
      why: 'Shins get no work. Tibialis raises help knee health and footwork, and need no equipment.' },
  ],

  improvements: [
    { title: 'Do the heavy lift first',
      text: 'On leg day the squat came after calf raises, leg extensions, two hip machines and leg curls. On pull day the deadlift came after farmer\'s carries and shrugs, which tire your grip and traps. Same exercises, new order: squat first on legs, deadlift first on pull. Your 80 x 10 squat should go up straight away.' },
    { title: 'Stop going to failure on compound lifts',
      text: '40% of compound sets this week ended on a failed half rep: lat pulldown and machine row 3 of 4, seated dumbbell press 2 of 2, deadlift 1 of 4. Leave 1 to 2 reps in reserve on these. Keep going to failure on the last set of curls, extensions and raises.' },
    { title: 'Add weight where it is easy',
      text: 'Woodchop 15 kg x 15 for 3 sets, hip abduction 50 x 12 and lying leg curl 40 x 12 had no failed sets. Add a step of weight next week.' },
    { title: 'Keep the warm-up notes going',
      text: 'You marked warm-up push-ups and squats this week, and the analysis leaves those out correctly. Do the same for ramp-up sets before squats and deadlifts.' },
  ],

  mma: [
    { phase: 'Now to 22 Nov', text: 'Keep this week as it is, with the four small additions. Push the squat and deadlift up steadily now they come first. Swimming on rest days is good recovery and conditioning; keep it easy enough that you can hold a conversation.' },
    { phase: '23 to 30 Nov', text: 'One easier week: same days and exercises, about a third fewer sets, nothing to failure.' },
    { phase: 'From December', text: 'Keep the same four gym days and exercises, but do 2 to 3 hard sets per exercise instead of 3 to 4 (roughly 55 to 60 sets a week instead of 82). No failure on compounds. Keep hard sparring at least a day away from leg day and pull day (squat and deadlift). Swimming becomes easy recovery; if you feel run down, it is the first thing to shorten.' },
  ],

  nutrition: [
    { title: 'Protein', text: 'Around 150 to 180 g a day, spread over 3 to 4 meals, more important than ever once MMA adds training.' },
    { title: 'Energy', text: 'Keep the deficit small (about 300 kcal a day). With gym, swimming and then MMA your energy needs are high; losing more than 0.5 kg a week will cost strength and recovery.' },
    { title: 'Recovery', text: '7 to 9 hours of sleep. Creatine monohydrate (3 to 5 g a day) is well supported if it suits you; check with a doctor if you have any medical conditions.' },
  ],

  keyLifts: {
    bench:    { target: '90 kg e1RM', note: 'Best is still 70 x 3 from 1 Oct. Your other push day (16 Oct) had barbell bench at 60 x 8; do it first on that day.' },
    squat:    { target: '120 kg e1RM', note: '80 x 10 twice, done last in the session. Done first, it should climb fast.' },
    deadlift: { target: '130 kg e1RM', note: 'First real deadlift: 90 x 7.5, done after carries and shrugs, with the last set to failure.' },
    ohp:      { target: 'Seated dumbbell press 17.5 kg x 8 per hand', note: 'Estimate from the machine shoulder press on 9 Oct. This week: seated dumbbell press 15 x 8.5 per hand.' },
    row:      { target: 'Machine row 45 kg x 10, no failed sets', note: 'Best barbell row 50 x 8.5 on 8 Oct. This week machine row 40 x 9.5, 3 of 4 sets to failure.' },
    pulldown: { target: '70 kg x 8', note: '60 x 8.5 this week, 3 of 4 sets to failure.' },
    pullups:  { target: '6 bodyweight reps', note: 'None logged this week; best is 3.5 from 15 Oct. The hanging leg raise on pull day builds the grip and core for it.' },
  },

  targets: [
    { label: 'Hard sets a week', now: '82', target: '55 to 60 from December' },
    { label: 'Compound sets taken to failure', now: '40%', target: 'under 10%' },
    { label: 'Muscle groups with no work', now: '4 (neck, hip flexors, serratus, shins)', target: '0' },
    { label: 'Bodyweight', now: '92 kg, ~25% fat', target: '88 to 89 kg by December' },
  ],

  strengths: [
    { title: 'You acted on the last report', muscles: ['quads', 'hamstrings', 'lower-back'],
      text: 'Back squat, deadlift and woodchop all went in, plus your own additions: lying leg curl, hip abduction, face pulls and lateral raises.',
      evidence: 'Muscle groups at 6 or more hard sets a week: 7 on 15 Oct, 15 now.' },
    { title: 'A strong first squat', muscles: ['quads', 'glutes'],
      text: '80 kg for two sets of 10 as the last exercise of leg day is a good base. Estimated 1RM about 107 kg, 1.16x bodyweight.',
      evidence: 'Back squat 80 x 10, 80 x 10 on 19 Oct.' },
    { title: 'The back of the body is no longer neglected', muscles: ['hamstrings', 'glutes', 'lower-back'],
      text: 'Hamstrings, glutes and lower back together went from about 7 to 21 hard sets a week.',
      evidence: 'Hamstrings 2.3 to 7, glutes 3.7 to 8.5, lower back 0.7 to 5.5 sets a week.' },
    { title: 'Better shoulder balance', muscles: ['delts-side', 'delts-rear'],
      text: 'Side and rear delts doubled their work. Face pulls went from 15 to 30 kg in one session.',
      evidence: 'Side delts 2.1 to 5, rear delts 4 to 8 sets a week.' },
    { title: 'Arms and grip keep climbing', muscles: ['biceps', 'forearms', 'traps'],
      text: 'Bayesian curl from 10 to 15 kg, farmer\'s carry from 40 to 45 kg, and dumbbell shrugs at 22.5 kg x 16.',
      evidence: 'Arms day 20 Oct; pull day 22 Oct.' },
  ],

  weaknesses: [
    { title: 'Volume will be too high once MMA starts', muscles: [],
      text: '82 hard sets in four sessions (66 minutes on average; push day 29 sets in 77 minutes). Fine for now, but with MMA 4 to 5 times a week you will need to trim sets, not exercises.',
      evidence: 'Hard sets a week: 46 on 15 Oct, 82 now.' },
    { title: 'Big lifts done tired', muscles: ['quads', 'lower-back'],
      text: 'The squat was sixth on leg day and the deadlift came after carries and shrugs. You lift less and form slips when you are tired.',
      evidence: 'Leg day 19 Oct and pull day 22 Oct exercise order.' },
    { title: 'Still training to failure on compound lifts', muscles: ['lats', 'upper-back'],
      text: '40% of compound sets end on a failed half rep. That is the main reason sessions feel long and recovery will get harder.',
      evidence: 'Lat pulldown 3 of 4, machine row 3 of 4, seated dumbbell press 2 of 2.' },
    { title: 'Four groups still get no work', muscles: ['neck', 'hip-flexors', 'serratus', 'shins'],
      text: 'All four matter for MMA. This round adds one small exercise for each, a few minutes a day.',
      evidence: '0 sets logged for each.' },
    { title: 'Upper chest and pressing strength flat', muscles: ['chest-upper', 'chest'],
      text: 'Incline work got only 2 sets, and machine chest press was lighter than earlier in the month.',
      evidence: 'Incline dumbbell press 17.5 x 7.5; machine chest press 45 x 7.5 (55 to 60 kg earlier).' },
  ],

  logging: [
    'Dumbbell and single-arm weights are logged per hand ("Each hand", "Each arm"). Keep doing that for every dumbbell and single-arm exercise; the analysis assumes it.',
    'Weighted jump squats were logged as Barbell Back Squat (15 kg x 10). Mark them "Warmup" or log them separately; otherwise they count as a squat set.',
    'Swimming is not in the log, so it is not counted in these numbers. That is fine; just remember it adds to your weekly load.',
    'Next time, tell me your current bodyweight so the strength-to-bodyweight figures stay accurate.',
  ],

  caveats: [
    'One week of data (17 to 23 Oct). Weekly sets are that week; key lifts are your best sets from the whole log since 1 Oct.',
    'Estimated 1RMs use the Epley formula; machine numbers vary between gyms and are converted roughly where they stand in for a barbell lift.',
    'Strength levels are rough standards for adult men relative to bodyweight; with 25% body fat your strength relative to lean mass is higher.',
    'General training guidance, not medical advice.',
  ],
};

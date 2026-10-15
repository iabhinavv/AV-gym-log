// Status colours shared by the report and tools/bake-muscles.html. A heat scale taken from the
// 3D model: well-trained muscles glow red, partly trained ones yellow, untrained ones stay dark
// grey-blue. If you change a colour, re-bake the muscle images (README, "Muscle images").
window.GYM_STATUS = {
  strong:     { label: 'Strong',     color: '#E8483A', text: 'Well trained and strong for you' },
  solid:      { label: 'Solid',      color: '#EF8240', text: 'Trained enough, progressing' },
  developing: { label: 'Developing', color: '#E3A857', text: 'Some work, needs more' },
  weak:       { label: 'Weak',       color: '#A8924F', text: 'Barely trained' },
  untrained:  { label: 'Untrained',  color: '#6A7890', text: 'Not trained at all' },
};
window.GYM_STATUS_ORDER = ['strong', 'solid', 'developing', 'weak', 'untrained'];

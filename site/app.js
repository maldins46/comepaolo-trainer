import * as Overview from './views/overview.js';
import * as Weight from './views/weight.js';
import * as Running from './views/running.js';
import * as ExercisesList from './views/exercises.js';
import * as ExerciseDetail from './views/exerciseDetail.js';
import * as Week from './views/week.js';
import * as Decisions from './views/decisions.js';

const NAV = [
  { hash: '#/', label: 'Overview' },
  { hash: '#/exercises', label: 'Exercises' },
  { hash: '#/weight', label: 'Weight' },
  { hash: '#/running', label: 'Running' },
  { hash: '#/decisions', label: 'Decisions' },
];

const ROUTES = [
  { re: /^#\/$/, view: Overview },
  { re: /^#\/weight$/, view: Weight },
  { re: /^#\/running$/, view: Running },
  { re: /^#\/exercises$/, view: ExercisesList },
  { re: /^#\/exercises\/([\w:-]+)$/, view: ExerciseDetail, keys: ['key'] },
  { re: /^#\/week\/(\d+)$/, view: Week, keys: ['n'] },
  { re: /^#\/decisions$/, view: Decisions },
];

let DATA = null;
let workoutsById = null;
let currentCleanup = null;

const SHELL_HTML = `
  <div class="topbar">
    <div>
      <h1 id="week-title"></h1>
      <p class="muted" id="updated" style="margin:0"></p>
    </div>
    <button type="button" class="ghost" id="lock-btn">Lock</button>
  </div>
  <nav class="tabs" id="nav"></nav>
  <div id="view"></div>
`;

export function mountApp(data) {
  DATA = data;
  workoutsById = new Map(data.workouts.map((w) => [w.id, w]));

  document.getElementById('gate').hidden = true;
  const app = document.getElementById('app');
  app.hidden = false;
  app.innerHTML = SHELL_HTML;

  const cw = Math.min(Math.max(data.cycle.currentWeek, 0), 12);
  document.getElementById('week-title').textContent = `Week ${cw} of 12`;
  document.getElementById('updated').textContent = `Updated ${new Date(data.generatedAt).toLocaleString('en-GB')}`;
  document.getElementById('lock-btn').addEventListener('click', () => window.lock());

  const nav = document.getElementById('nav');
  nav.innerHTML = NAV.map((n) => `<a href="${n.hash}">${n.label}</a>`).join('');

  window.addEventListener('hashchange', renderRoute);
  if (!location.hash) location.hash = '#/';
  renderRoute();
}

function renderRoute() {
  currentCleanup?.();
  currentCleanup = null;

  const hash = location.hash || '#/';
  const match = ROUTES.map((r) => ({ r, m: r.re.exec(hash) })).find((x) => x.m);
  if (!match) { location.hash = '#/'; return; }

  updateNavActive(hash);
  const params = Object.fromEntries((match.r.keys ?? []).map((k, i) => [k, match.m[i + 1]]));
  const view = document.getElementById('view');
  const ctx = { data: DATA, workoutsById, navigate: (h) => { location.hash = h; } };
  currentCleanup = match.r.view.render(view, ctx, params) ?? null;
}

function updateNavActive(hash) {
  for (const a of document.querySelectorAll('#nav a')) {
    const href = a.getAttribute('href');
    const active = href === '#/' ? hash === '#/' : hash.startsWith(href);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

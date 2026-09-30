import * as Overview from './views/overview.js';
import * as Weight from './views/weight.js';
import * as Running from './views/running.js';
import * as ExercisesList from './views/exercises.js';
import * as ExerciseDetail from './views/exerciseDetail.js';
import * as Week from './views/week.js';
import * as Decisions from './views/decisions.js';
import * as Workouts from './views/workouts.js';
import * as WorkoutDetail from './views/workoutDetail.js';
import { icon } from './lib/icons.js';

const NAV = [
  { hash: '#/', label: 'Overview' },
  { hash: '#/workouts', label: 'Workouts' },
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
  { re: /^#\/workouts$/, view: Workouts },
  { re: /^#\/workouts\/([\w-]+)$/, view: WorkoutDetail, keys: ['id'] },
  { re: /^#\/week\/(\d+)$/, view: Week, keys: ['n'] },
  { re: /^#\/decisions$/, view: Decisions },
];

const THEME_KEY = 'comepaolo-training-theme';

let DATA = null;
let workoutsById = null;
let currentCleanup = null;

const SHELL_HTML = `
  <div class="top-strip">
    <span class="brand">Comepaolo Training</span>
    <div class="top-actions">
      <div class="theme-toggle" role="group" aria-label="Theme">
        <button type="button" class="small" data-theme-btn="">Auto</button>
        <button type="button" class="small" data-theme-btn="light">Light</button>
        <button type="button" class="small" data-theme-btn="dark">Dark</button>
      </div>
      <button type="button" class="ghost small" id="lock-btn">${icon('lock')} Lock</button>
    </div>
  </div>
  <div class="tabs-wrap">
    <button type="button" class="tab-arrow" id="tabs-prev" aria-label="Scroll tabs left" hidden>${icon('chevronLeft')}</button>
    <nav class="tabs" id="nav"></nav>
    <button type="button" class="tab-arrow" id="tabs-next" aria-label="Scroll tabs right" hidden>${icon('chevronRight')}</button>
  </div>
  <div id="view"></div>
`;

function applyTheme(value) {
  if (value) document.documentElement.setAttribute('data-theme', value);
  else document.documentElement.removeAttribute('data-theme');
  for (const btn of document.querySelectorAll('[data-theme-btn]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.themeBtn === value));
  }
  const dark = value === 'dark' || (value !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.getElementById('theme-color-meta')?.setAttribute('content', dark ? '#10151c' : '#eef2f6');
}

function wireTabScroll() {
  const nav = document.getElementById('nav');
  const prev = document.getElementById('tabs-prev');
  const next = document.getElementById('tabs-next');
  const update = () => {
    const overflow = nav.scrollWidth > nav.clientWidth + 1;
    prev.hidden = !overflow || nav.scrollLeft <= 0;
    next.hidden = !overflow || nav.scrollLeft >= nav.scrollWidth - nav.clientWidth - 1;
  };
  prev.addEventListener('click', () => nav.scrollBy({ left: -140, behavior: 'smooth' }));
  next.addEventListener('click', () => nav.scrollBy({ left: 140, behavior: 'smooth' }));
  nav.addEventListener('scroll', update);
  window.addEventListener('resize', update);
  update();
}

function wireThemeToggle() {
  const saved = (() => { try { return localStorage.getItem(THEME_KEY) ?? ''; } catch { return ''; } })();
  applyTheme(saved);
  for (const btn of document.querySelectorAll('[data-theme-btn]')) {
    btn.addEventListener('click', () => {
      const value = btn.dataset.themeBtn;
      applyTheme(value);
      try { value ? localStorage.setItem(THEME_KEY, value) : localStorage.removeItem(THEME_KEY); } catch {}
    });
  }
}

export function mountApp(data) {
  DATA = data;
  workoutsById = new Map(data.workouts.map((w) => [w.id, w]));

  document.getElementById('gate').hidden = true;
  const app = document.getElementById('app');
  app.hidden = false;
  app.innerHTML = SHELL_HTML;

  wireThemeToggle();
  document.getElementById('lock-btn').addEventListener('click', () => window.lock());

  const nav = document.getElementById('nav');
  nav.innerHTML = NAV.map((n) => `<a href="${n.hash}">${n.label}</a>`).join('');
  wireTabScroll();

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

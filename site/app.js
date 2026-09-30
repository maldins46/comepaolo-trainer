import * as Overview from './views/overview.js';
import * as Weight from './views/weight.js';
import * as Running from './views/running.js';
import * as ExercisesList from './views/exercises.js';
import * as ExerciseDetail from './views/exerciseDetail.js';
import * as Week from './views/week.js';
import * as Decisions from './views/decisions.js';
import * as Workouts from './views/workouts.js';
import * as WorkoutDetail from './views/workoutDetail.js';
import * as PlannedSession from './views/plannedSession.js';
import { icon } from './lib/icons.js';

const NAV = [
  { hash: '#/', label: 'Overview' },
  { hash: '#/workouts', label: 'Workouts' },
  { hash: '#/running', label: 'Running' },
  { hash: '#/exercises', label: 'Exercises' },
  { hash: '#/weight', label: 'Weight' },
  { hash: '#/decisions', label: 'Decisions' },
];

const ROUTES = [
  { re: /^#\/$/, view: Overview },
  { re: /^#\/workouts$/, view: Workouts },
  {
    re: /^#\/workouts\/([\w-]+)$/, view: WorkoutDetail, keys: ['id'],
    header: (ctx, p) => {
      const w = ctx.workoutsById.get(p.id);
      return {
        title: w?.kind === 'run' ? 'Run' : 'Workout',
        fallback: '#/workouts',
        action: w?.week ? { label: `Week ${w.week}`, href: `#/week/${w.week}` } : null,
      };
    },
  },
  {
    re: /^#\/plan\/(\d+)\/(A|B|C|run)$/, view: PlannedSession, keys: ['n', 's'],
    header: (ctx, p) => {
      const valid = !!ctx.data.weeks[+p.n - 1];
      return {
        title: p.s === 'run' ? 'Planned run' : 'Planned session',
        fallback: '#/',
        action: valid ? { label: `Week ${p.n}`, href: `#/week/${p.n}` } : null,
      };
    },
  },
  { re: /^#\/running$/, view: Running },
  { re: /^#\/exercises$/, view: ExercisesList },
  { re: /^#\/exercises\/([\w:-]+)$/, view: ExerciseDetail, keys: ['key'], header: () => ({ title: 'Exercise', fallback: '#/exercises' }) },
  { re: /^#\/weight$/, view: Weight },
  { re: /^#\/week\/(\d+)$/, view: Week, keys: ['n'], header: () => ({ title: 'Week', fixedBack: '#/' }) },
  { re: /^#\/decisions$/, view: Decisions },
];

const THEME_KEY = 'comepaolo-training-theme';

let DATA = null;
let workoutsById = null;
let currentCleanup = null;
let updateTabArrows = () => {};
let curIdx = 0;      // position of the current history entry within this app session
let backTarget = null;

const SHELL_HTML = `
  <div class="top-strip">
    <span class="brand"><img class="brand-icon" src="icons/badge-64.png" alt="" width="28" height="28">Comepaolo Trainer</span>
    <div class="top-actions">
      <div class="theme-toggle" role="group" aria-label="Theme">
        <button type="button" class="small" data-theme-btn="" aria-label="Auto theme" title="Auto">${icon('monitor', 'ico')}<span class="lbl">Auto</span></button>
        <button type="button" class="small" data-theme-btn="light" aria-label="Light theme" title="Light">${icon('sun', 'ico')}<span class="lbl">Light</span></button>
        <button type="button" class="small" data-theme-btn="dark" aria-label="Dark theme" title="Dark">${icon('moon', 'ico')}<span class="lbl">Dark</span></button>
      </div>
      <button type="button" class="ghost small" id="lock-btn" aria-label="Lock" title="Lock">${icon('lock')}<span class="lbl">Lock</span></button>
    </div>
  </div>
  <div class="tabs-wrap" id="tabs-wrap">
    <button type="button" class="tab-arrow" id="tabs-prev" aria-label="Scroll tabs left" hidden>${icon('chevronLeft')}</button>
    <nav class="tabs" id="nav"></nav>
    <button type="button" class="tab-arrow" id="tabs-next" aria-label="Scroll tabs right" hidden>${icon('chevronRight')}</button>
  </div>
  <div class="detail-head" id="detail-head" hidden>
    <button type="button" class="ghost small icon-btn" id="back-btn" aria-label="Back" title="Back">${icon('arrowLeft')}</button>
    <span class="detail-title" id="detail-title"></span>
    <a class="btn-ghost" id="detail-action" hidden></a>
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
  return update;
}

function wireThemeToggle() {
  const saved = (() => { try { return localStorage.getItem(THEME_KEY) ?? ''; } catch { return ''; } })();
  applyTheme(saved);
  for (const btn of document.querySelectorAll('[data-theme-btn]')) {
    btn.addEventListener('click', () => {
      // Phone layout shows only the active mode's button: tapping it cycles auto -> light -> dark.
      const order = ['', 'light', 'dark'];
      const value = matchMedia('(max-width: 600px)').matches
        ? order[(order.indexOf(btn.dataset.themeBtn) + 1) % order.length]
        : btn.dataset.themeBtn;
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
  updateTabArrows = wireTabScroll();

  history.replaceState({ idx: 0 }, '');
  document.getElementById('back-btn').addEventListener('click', () => {
    if (backTarget?.fixedBack) location.hash = backTarget.fixedBack;
    else if (curIdx > 0) history.back();
    else location.hash = backTarget?.fallback ?? '#/';
  });

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

  if (history.state?.idx == null) {
    curIdx += 1;
    history.replaceState({ idx: curIdx }, '');
  } else {
    curIdx = history.state.idx;
  }

  updateNavActive(hash);
  const params = Object.fromEntries((match.r.keys ?? []).map((k, i) => [k, match.m[i + 1]]));
  const view = document.getElementById('view');
  const ctx = { data: DATA, workoutsById, navigate: (h) => { location.hash = h; } };
  renderHeader(match.r.header?.(ctx, params) ?? null);
  currentCleanup = match.r.view.render(view, ctx, params) ?? null;
}

// Top-level pages show the tab bar; nested pages swap it for a back header.
function renderHeader(head) {
  backTarget = head;
  document.getElementById('tabs-wrap').hidden = !!head;
  document.getElementById('detail-head').hidden = !head;
  if (!head) { updateTabArrows(); return; }
  document.getElementById('detail-title').textContent = head.title;
  const action = document.getElementById('detail-action');
  action.hidden = !head.action;
  if (head.action) {
    action.href = head.action.href;
    action.innerHTML = `${icon('calendar')}<span></span>`;
    action.lastChild.textContent = head.action.label;
  }
}

function updateNavActive(hash) {
  for (const a of document.querySelectorAll('#nav a')) {
    const href = a.getAttribute('href');
    const active = href === '#/' ? hash === '#/' : hash.startsWith(href);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

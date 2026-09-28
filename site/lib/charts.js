const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function theme() {
  const s = getComputedStyle(document.documentElement);
  const v = (name) => s.getPropertyValue(name).trim();
  return {
    ink: v('--ink'), muted: v('--muted'), accent: v('--accent'), line: v('--line'),
    done: v('--done'), warn: v('--warn'), bad: v('--bad'),
    accentBg: v('--accent-bg'), doneBg: v('--done-bg'), warnBg: v('--warn-bg'), badBg: v('--bad-bg'),
  };
}

export function axisTitle(text) {
  return { display: true, text, color: theme().muted, font: { size: 11, weight: '600' } };
}

export function chartTitle(text) {
  const t = theme();
  return { title: { display: true, text, color: t.ink, font: { size: 13, weight: '700' }, padding: { bottom: 8 } } };
}

export function unitTooltip(unit) {
  return { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y}${unit}` } } };
}

export function swatchDot(color) {
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>`;
}

export function swatchDash(color) {
  return `<span style="display:inline-block;width:14px;border-top:2px dashed ${color}"></span>`;
}

// Shared across every cycle-week chart: a linear (not categorical) 1..max axis, so fractional
// x-positions work for daily bodyweight dots and decision markers at week+0.5.
// Ticks are forced to exact integers via afterBuildTicks: Chart.js's own stepSize generator
// starts *at* min (0.5) and steps by 1, landing on 0.5, 1.5, 2.5... never an integer, so a
// plain integer-check label callback silently blanks every tick.
export function weekAxis(maxWeek, { title } = {}) {
  const t = theme();
  return {
    type: 'linear',
    min: 0.5, max: maxWeek + 0.5,
    grid: { color: t.line },
    afterBuildTicks: (scale) => {
      scale.ticks = Array.from({ length: maxWeek }, (_, i) => ({ value: i + 1 }));
    },
    ticks: {
      color: t.muted,
      callback: (v) => 'S' + v,
    },
    title: title ? axisTitle(title) : undefined,
  };
}

export function chartDefaults() {
  const t = theme();
  return {
    animation: reduceMotion() ? false : undefined,
    responsive: true,
    maintainAspectRatio: false,
    color: t.ink,
    scales: { y: { grid: { color: t.line }, ticks: { color: t.muted } } },
    plugins: { legend: { labels: { color: t.ink } } },
  };
}

export function makeChart(canvas, config) {
  return new Chart(canvas, config);
}

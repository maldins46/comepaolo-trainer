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

// Shared across every cycle-week chart: a linear (not categorical) 1..max axis, so fractional
// x-positions work for daily bodyweight dots and decision markers at week+0.5.
export function weekAxis(maxWeek) {
  const t = theme();
  return {
    type: 'linear',
    min: 0.5, max: maxWeek + 0.5,
    grid: { color: t.line },
    ticks: {
      stepSize: 1, color: t.muted,
      callback: (v) => (Number.isInteger(v) ? 'S' + v : ''),
    },
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

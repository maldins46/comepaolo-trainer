// Icons vendored from Lucide (lucide-static v1.48.0, ISC license: lucide.dev), fetched once
// and inlined here — a build-time asset, not a runtime dependency. All use stroke="currentColor"
// so they inherit text color and stay theme-aware for free. Each carries class="icon" itself
// (rather than relying on callers to wrap it) so the .icon CSS sizing always applies, regardless
// of where it's dropped into markup.

const ICON = {
  circleGauge: "<svg aria-hidden=\"true\" class=\"icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M15.6 2.7a10 10 0 1 0 5.7 5.7\" /> <circle cx=\"12\" cy=\"12\" r=\"2\" /> <path d=\"M13.4 10.6 19 5\" /></svg>",
  target: "<svg aria-hidden=\"true\" class=\"icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <circle cx=\"12\" cy=\"12\" r=\"10\" /> <circle cx=\"12\" cy=\"12\" r=\"6\" /> <circle cx=\"12\" cy=\"12\" r=\"2\" /></svg>",
  dumbbell: "<svg aria-hidden=\"true\" class=\"icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z\" /> <path d=\"m2.5 21.5 1.4-1.4\" /> <path d=\"m20.1 3.9 1.4-1.4\" /> <path d=\"M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z\" /> <path d=\"m9.6 14.4 4.8-4.8\" /></svg>",
  personStanding: "<svg aria-hidden=\"true\" class=\"icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <circle cx=\"12\" cy=\"5\" r=\"1\" /> <path d=\"m9 20 3-6 3 6\" /> <path d=\"m6 8 6 2 6-2\" /> <path d=\"M12 10v4\" /></svg>",
  lifeBuoy: "<svg aria-hidden=\"true\" class=\"icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <circle cx=\"12\" cy=\"12\" r=\"10\" /> <path d=\"m4.93 4.93 4.24 4.24\" /> <path d=\"m14.83 9.17 4.24-4.24\" /> <path d=\"m14.83 14.83 4.24 4.24\" /> <path d=\"m9.17 14.83-4.24 4.24\" /> <circle cx=\"12\" cy=\"12\" r=\"4\" /></svg>",
  timer: "<svg aria-hidden=\"true\" class=\"icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <line x1=\"10\" x2=\"14\" y1=\"2\" y2=\"2\" /> <line x1=\"12\" x2=\"15\" y1=\"14\" y2=\"11\" /> <circle cx=\"12\" cy=\"14\" r=\"8\" /></svg>",
  footprints: "<svg aria-hidden=\"true\" class=\"icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z\" /> <path d=\"M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z\" /> <path d=\"M16 17h4\" /> <path d=\"M4 13h4\" /></svg>",
  checkCircle2: "<svg aria-hidden=\"true\" class=\"icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <circle cx=\"12\" cy=\"12\" r=\"10\" /> <path d=\"m16 9-5.5 5.5L8 12\" /></svg>",
  circleDashed: "<svg aria-hidden=\"true\" class=\"icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M10.1 2.182a10 10 0 0 1 3.8 0\" /> <path d=\"M13.9 21.818a10 10 0 0 1-3.8 0\" /> <path d=\"M17.609 3.721a10 10 0 0 1 2.69 2.7\" /> <path d=\"M2.182 13.9a10 10 0 0 1 0-3.8\" /> <path d=\"M20.279 17.609a10 10 0 0 1-2.7 2.69\" /> <path d=\"M21.818 10.1a10 10 0 0 1 0 3.8\" /> <path d=\"M3.721 6.391a10 10 0 0 1 2.7-2.69\" /> <path d=\"M6.391 20.279a10 10 0 0 1-2.69-2.7\" /></svg>",
  route: "<svg aria-hidden=\"true\" class=\"icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <circle cx=\"6\" cy=\"19\" r=\"3\" /> <path d=\"M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15\" /> <circle cx=\"18\" cy=\"5\" r=\"3\" /></svg>",
  lock: "<svg aria-hidden=\"true\" class=\"icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <rect width=\"18\" height=\"11\" x=\"3\" y=\"11\" rx=\"2\" ry=\"2\" /> <path d=\"M7 11V7a5 5 0 0 1 10 0v4\" /></svg>",
  chevronLeft: "<svg aria-hidden=\"true\" class=\"icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"m15 18-6-6 6-6\" /></svg>",
  chevronRight: "<svg aria-hidden=\"true\" class=\"icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"m9 18 6-6-6-6\" /></svg>",
  trendingUp: "<svg aria-hidden=\"true\" class=\"icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <polyline points=\"22 7 13.5 15.5 8.5 10.5 2 17\" /> <polyline points=\"16 7 22 7 22 13\" /></svg>",
  trendingDown: "<svg aria-hidden=\"true\" class=\"icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <polyline points=\"22 17 13.5 8.5 8.5 13.5 2 7\" /> <polyline points=\"16 17 22 17 22 11\" /></svg>",
  minus: "<svg aria-hidden=\"true\" class=\"icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M5 12h14\" /></svg>",
  sun: "<svg aria-hidden=\"true\" class=\"icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <circle cx=\"12\" cy=\"12\" r=\"4\" /> <path d=\"M12 2v2\" /> <path d=\"M12 20v2\" /> <path d=\"m4.93 4.93 1.41 1.41\" /> <path d=\"m17.66 17.66 1.41 1.41\" /> <path d=\"M2 12h2\" /> <path d=\"M20 12h2\" /> <path d=\"m6.34 17.66-1.41 1.41\" /> <path d=\"m19.07 4.93-1.41 1.41\" /></svg>",
  moon: "<svg aria-hidden=\"true\" class=\"icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z\" /></svg>",
  monitor: "<svg aria-hidden=\"true\" class=\"icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <rect width=\"20\" height=\"14\" x=\"2\" y=\"3\" rx=\"2\" /> <line x1=\"8\" x2=\"16\" y1=\"21\" y2=\"21\" /> <line x1=\"12\" x2=\"12\" y1=\"17\" y2=\"21\" /></svg>",
};

const KIND_ICON = {
  machine: 'circleGauge', isolation: 'target', press: 'dumbbell', bodyweight: 'personStanding',
  assisted: 'lifeBuoy', duration: 'timer', run: 'footprints',
};

export function icon(name, extra = '') {
  const svg = ICON[name] ?? '';
  return extra ? svg.replace('class="icon"', `class="icon ${extra}"`) : svg;
}

export function kindIcon(kind, extra = '') {
  return icon(KIND_ICON[kind], extra);
}

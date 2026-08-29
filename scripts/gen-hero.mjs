// Builds assets/hero-{dark,light}.svg
// Time-of-day aware, and pulls live numbers from Sujeet's own deployed systems.
// If an endpoint is down the fallback string is used — the profile never breaks.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { THEMES, FONT_MONO } from './lib/theme.mjs';
import { svg, write, esc, safeFetch, pick, nf, seeded } from './lib/svg.mjs';

const cfg = JSON.parse(readFileSync(new URL('./config.json', import.meta.url)));
const W = 840, H = 250;

// ---------- local time in IST ----------
const now = new Date();
const ist = new Intl.DateTimeFormat('en-GB', {
  timeZone: cfg.identity.timezone, hour: '2-digit', minute: '2-digit', hour12: false,
}).format(now);
const hour = Number(ist.slice(0, 2));

// what the sky looks like, and what he's probably doing
const PHASES = [
  { until: 5,  sky: ['#050912', '#0d1117'], mood: 'PROBABLY STILL SHIPPING', stars: 6 },
  { until: 8,  sky: ['#12111f', '#0d1117'], mood: 'EARLY',                   stars: 3 },
  { until: 12, sky: ['#0f1620', '#0d1117'], mood: 'ON THE CLOCK',                  stars: 0 },
  { until: 18, sky: ['#101822', '#0d1117'], mood: 'ON THE CLOCK',                  stars: 0 },
  { until: 22, sky: ['#141020', '#0d1117'], mood: 'CLIENT WORK',             stars: 2 },
  { until: 24, sky: ['#0a0d1a', '#0d1117'], mood: 'PROBABLY STILL SHIPPING', stars: 5 },
];
const phase = PHASES.find((p) => hour < p.until) ?? PHASES.at(-1);

// ---------- live data ----------
async function buildTicker() {
  const parts = [];
  for (const src of cfg.ticker) {
    const json = await safeFetch(src.url, { timeout: 6000 });
    const raw = json ? pick(json, src.path) : null;
    parts.push({
      label: src.label,
      value: raw == null ? src.fallback : `${nf(raw)}${src.suffix ?? ''}`,
      live: raw != null,
    });
  }
  const live = parts.filter((p) => p.live).length;
  parts.push({ label: 'LAST SYNC', value: `${ist} IST`, live: true });
  return { parts, live };
}

// ---------- rendering ----------
const tickerLine = (parts, t, xStart) => {
  let x = xStart;
  const out = [];
  for (const [i, p] of parts.entries()) {
    if (i > 0) { out.push(`<tspan x="${x}" fill="${t.border}">│</tspan>`); x += 16; }
    out.push(`<tspan x="${x}" fill="${p.live ? t.green : t.fgFaint}">●</tspan>`);
    x += 14;
    out.push(`<tspan x="${x}" fill="${t.fgMute}">${esc(p.label)}</tspan>`);
    x += p.label.length * 6.9 + 8;
    out.push(`<tspan x="${x}" fill="${t.fg}">${esc(p.value)}</tspan>`);
    x += p.value.length * 6.9 + 20;
  }
  return { markup: out.join(''), width: x - xStart };
};

function render(t, { parts, live }) {
  const rnd = seeded('hero-stars');
  const isDark = t.name === 'dark';
  const [skyTop, skyBottom] = isDark ? phase.sky : ['#ffffff', '#ffffff'];

  const stars = isDark
    ? Array.from({ length: phase.stars }, (_, i) => {
        const x = 90 + rnd() * 660, y = 24 + rnd() * 34, r = 0.9 + rnd() * 0.6;
        const dur = (3 + rnd() * 2.4).toFixed(1);
        return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="${t.star}" opacity=".45">
      <animate attributeName="opacity" values=".2;.85;.2" dur="${dur}s" begin="${(i * 0.4).toFixed(1)}s" repeatCount="indefinite"/></circle>`;
      }).join('')
    : '';

  const flags = cfg.flags.map((f, i) => {
    const text = f.dynamic === 'liveCount' ? `${f.text} · ${live} live` : f.text;
    return { text, colour: t[f.colour] ?? t.fgMute, i };
  });

  let fx = 34;
  const flagMarkup = flags.map((f) => {
    const w = f.text.length * 6.1 + 26;
    const g = `<g>
      <circle cx="${fx + 9}" cy="216" r="3.2" fill="${f.colour}"/>
      <circle cx="${fx + 9}" cy="216" r="3.2" fill="${f.colour}" opacity=".55">
        <animate attributeName="r" values="3.2;9" dur="2.2s" begin="${(f.i * 0.45).toFixed(2)}s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values=".55;0" dur="2.2s" begin="${(f.i * 0.45).toFixed(2)}s" repeatCount="indefinite"/>
      </circle>
      <text x="${fx + 19}" y="220" font-family="${FONT_MONO}" font-size="10.5" fill="${t.fgMute}" letter-spacing="1.1">${esc(f.text)}</text>
    </g>`;
    fx += w + 18;
    return g;
  }).join('');

  const a = tickerLine(parts, t, 42);
  const b = tickerLine(parts, t, 42 + a.width + 60);
  const scroll = Math.max(a.width + 60, 900);
  const dur = Math.round(scroll / 42);

  const body = `
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${skyTop}"/><stop offset="100%" stop-color="${skyBottom}"/>
  </linearGradient>
  <linearGradient id="nm" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="${t.cyan}">
      <animate attributeName="stop-color" values="${t.cyan};${t.violet};${t.magenta};${t.cyan}" dur="11s" repeatCount="indefinite"/></stop>
    <stop offset="100%" stop-color="${t.violet}">
      <animate attributeName="stop-color" values="${t.violet};${t.magenta};${t.cyan};${t.violet}" dur="11s" repeatCount="indefinite"/></stop>
  </linearGradient>
  <pattern id="grid" width="26" height="26" patternUnits="userSpaceOnUse">
    <path d="M26 0H0V26" fill="none" stroke="${t.grid}" stroke-width="1"/></pattern>
  <radialGradient id="sweep">
    <stop offset="0%" stop-color="${t.cyan}" stop-opacity=".45"/>
    <stop offset="100%" stop-color="${t.cyan}" stop-opacity="0"/></radialGradient>
  <clipPath id="tickclip"><rect x="30" y="160" width="${W - 60}" height="26" rx="4"/></clipPath>
</defs>

<rect width="${W}" height="${H}" fill="url(#sky)"/>
<rect width="${W}" height="${H}" fill="url(#grid)"/>
${stars}

<g stroke="${t.borderSoft}" stroke-width="1.3" fill="none" opacity="0">
  <animate attributeName="opacity" from="0" to=".8" dur="1s" begin="2.2s" fill="freeze"/>
  <path d="M22 46V22h20M${W - 22} 46V22h-20M22 214v18h20M${W - 22} 214v18h-20"/>
</g>

<g transform="translate(${W - 118},104)">
  <circle r="56" fill="none" stroke="${t.border}" stroke-width="1"/>
  <circle r="37" fill="none" stroke="${t.border}" stroke-width="1"/>
  <circle r="18" fill="none" stroke="${t.border}" stroke-width="1"/>
  <path d="M0 0 L56 0 A56 56 0 0 1 28 48 Z" fill="url(#sweep)">
    <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="4.5s" repeatCount="indefinite"/>
  </path>
  <circle r="3" fill="${t.cyan}"><animate attributeName="r" values="3;6.5;3" dur="2.2s" repeatCount="indefinite"/></circle>
  <circle cx="33" cy="-16" r="2" fill="${t.violet}">
    <animate attributeName="opacity" values="0;1;0" dur="4.5s" repeatCount="indefinite"/></circle>
  <circle cx="-21" cy="29" r="2" fill="${t.magenta}">
    <animate attributeName="opacity" values="0;1;0" dur="4.5s" begin="1.5s" repeatCount="indefinite"/></circle>
</g>

<g fill="${t.cyan}" opacity=".4">
  <circle cx="70" cy="44" r="2"><animate attributeName="cy" values="44;31;44" dur="4s" repeatCount="indefinite"/></circle>
  <circle cx="152" cy="176" r="1.6"><animate attributeName="cy" values="176;163;176" dur="5.5s" repeatCount="indefinite"/></circle>
  <circle cx="352" cy="36" r="1.8"><animate attributeName="cy" values="36;23;36" dur="4.8s" repeatCount="indefinite"/></circle>
  <circle cx="492" cy="182" r="2.2"><animate attributeName="cy" values="182;169;182" dur="6s" repeatCount="indefinite"/></circle>
  <circle cx="258" cy="188" r="1.4"><animate attributeName="cy" values="188;177;188" dur="4.4s" repeatCount="indefinite"/></circle>
</g>

<text x="34" y="60" font-family="${FONT_MONO}" font-size="10" fill="${t.fgFaint}" letter-spacing="3" opacity="0">
  ${esc(ist)} IST · ${esc(cfg.identity.city)} · ${esc(phase.mood)}
  <animate attributeName="opacity" from="0" to="1" dur=".9s" begin="2.4s" fill="freeze"/>
</text>

<text x="32" y="118" font-family="${FONT_MONO}" font-size="44" font-weight="700" letter-spacing="1"
      fill="none" stroke="url(#nm)" stroke-width="1.3"
      stroke-dasharray="1600" stroke-dashoffset="1600">${esc(cfg.identity.name)}
  <animate attributeName="stroke-dashoffset" from="1600" to="0" dur="2.8s" fill="freeze"/>
</text>
<text x="32" y="118" font-family="${FONT_MONO}" font-size="44" font-weight="700" letter-spacing="1"
      fill="url(#nm)" opacity="0">${esc(cfg.identity.name)}
  <animate attributeName="opacity" from="0" to="1" dur="1.1s" begin="2.1s" fill="freeze"/>
</text>
<text x="34" y="142" font-family="${FONT_MONO}" font-size="12.5" fill="${t.fgDim}" opacity="0">
  ${esc(cfg.identity.tagline)}
  <animate attributeName="opacity" from="0" to="1" dur=".9s" begin="2.5s" fill="freeze"/>
</text>

<rect x="30" y="160" width="${W - 60}" height="26" rx="4" fill="${t.panel}" stroke="${t.border}" opacity="0">
  <animate attributeName="opacity" from="0" to="1" dur=".7s" begin="2.7s" fill="freeze"/></rect>
<g clip-path="url(#tickclip)" opacity="0">
  <animate attributeName="opacity" from="0" to="1" dur=".7s" begin="2.9s" fill="freeze"/>
  <g font-family="${FONT_MONO}" font-size="11.5">
    <animateTransform attributeName="transform" type="translate" from="0,0" to="-${scroll},0"
      dur="${dur}s" repeatCount="indefinite"/>
    <text y="177">${a.markup}</text>
    <text y="177">${b.markup}</text>
  </g>
</g>

<g opacity="0"><animate attributeName="opacity" from="0" to="1" dur=".8s" begin="3.1s" fill="freeze"/>${flagMarkup}</g>
`;

  return svg(W, H, body, {
    title: `${cfg.identity.name} — ${cfg.identity.tagline}. ${live} systems reporting live at ${ist} IST.`,
  });
}

const data = await buildTicker();
console.log(`hero: ${data.live}/${cfg.ticker.length} endpoints live at ${ist} IST`);
for (const t of Object.values(THEMES)) {
  write(fileURLToPath(new URL(`../assets/hero-${t.name}.svg`, import.meta.url)), render(t, data));
}

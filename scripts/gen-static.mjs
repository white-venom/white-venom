// Builds the SVGs that don't need live data:
//   assets/cards/<slug>-{dark,light}.svg   — project cards (SVG, because GitHub strips CSS)
//   assets/architecture-{dark,light}.svg   — portfolio as a system diagram
//   assets/divider-{dark,light}.svg        — animated section rule
// Run once, and again whenever config.json changes.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { THEMES, FONT_SANS, FONT_MONO } from './lib/theme.mjs';
import { svg, write, esc } from './lib/svg.mjs';

const cfg = JSON.parse(readFileSync(new URL('./config.json', import.meta.url)));
const out = (p) => fileURLToPath(new URL(`../assets/${p}`, import.meta.url));

/* ------------------------------------------------------------------ *
 * 1. PROJECT CARDS                                                     *
 * ------------------------------------------------------------------ */
const CARD_W = 400, CARD_H = 150;

/** Naive word-wrap for SVG, which has no text flow of its own. */
function wrap(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars) { lines.push(line.trim()); line = w; }
    else line += ' ' + w;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

function card(p, t) {
  const accent = p.status === 'live' ? t.green : t.orange;
  const lines = wrap(p.blurb, 46).slice(0, 3);
  const badge = p.status === 'live' ? 'LIVE' : 'IN BUILD';
  const badgeW = badge.length * 6.2 + 16;
  const nameW = p.name.length * 8.7;

  const body = `
<defs>
  <linearGradient id="glow" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${t.violet}" stop-opacity="${t.name === 'dark' ? '.14' : '.09'}"/>
    <stop offset="60%" stop-color="${t.violet}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="corner" x1="1" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${t.magenta}" stop-opacity="${t.name === 'dark' ? '.20' : '.12'}"/>
    <stop offset="70%" stop-color="${t.magenta}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="${t.magenta}"/><stop offset="100%" stop-color="${t.cyan}"/>
  </linearGradient>
</defs>

<rect width="${CARD_W}" height="${CARD_H}" fill="${t.canvas}"/>
<rect x="1" y="1" width="${CARD_W - 2}" height="${CARD_H - 2}" rx="10" fill="${t.panel}" stroke="${t.borderSoft}"/>
<rect x="1" y="1" width="${CARD_W - 2}" height="${CARD_H - 2}" rx="10" fill="url(#glow)"/>
<rect x="${CARD_W - 110}" y="1" width="109" height="80" fill="url(#corner)"/>

<rect x="1" y="${CARD_H - 4}" width="0" height="3" rx="1.5" fill="url(#edge)">
  <animate attributeName="width" values="0;${CARD_W - 2};0" dur="6s" repeatCount="indefinite"
    keyTimes="0;0.5;1" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1"/>
</rect>

<text x="22" y="32" font-family="${FONT_MONO}" font-size="10.5" fill="${t.magenta}" letter-spacing="2.4">${esc(p.kicker)}</text>

<text x="22" y="58" font-family="${FONT_SANS}" font-size="18" font-weight="600" fill="${t.fg}">${esc(p.name)}</text>
<rect x="${22 + nameW + 10}" y="45" width="${badgeW}" height="16" rx="8" fill="${accent}" fill-opacity=".14" stroke="${accent}" stroke-opacity=".45"/>
<text x="${22 + nameW + 10 + badgeW / 2}" y="56.5" font-family="${FONT_MONO}" font-size="9" fill="${accent}"
      text-anchor="middle" letter-spacing="1">${badge}</text>

${lines.map((l, i) =>
  `<text x="22" y="${80 + i * 15}" font-family="${FONT_SANS}" font-size="12.5" fill="${t.fgMute}">${esc(l)}</text>`
).join('\n')}

<text x="22" y="${CARD_H - 20}" font-family="${FONT_MONO}" font-size="11" fill="${t.cyan}">${esc(p.stack)}</text>
`;
  return svg(CARD_W, CARD_H, body, { title: `${p.name} — ${p.blurb} Built with ${p.stack}.` });
}

/* ------------------------------------------------------------------ *
 * 2. ARCHITECTURE MAP                                                  *
 * ------------------------------------------------------------------ */
const A_W = 840, A_H = 300;

function architecture(t) {
  const { nodes, edges } = cfg.architecture;
  const COL_X = [40, 210, 400, 620];
  const COL_W = [110, 120, 130, 180];
  const ROW_Y = [56, 110, 164, 218];
  const NH = 40;

  const pos = {};
  for (const n of nodes) {
    pos[n.id] = {
      x: COL_X[n.col], y: ROW_Y[n.row], w: COL_W[n.col], h: NH,
      colour: t[n.colour] ?? t.fgMute, ...n,
    };
  }

  let edgeMarkup = '', pktMarkup = '';
  edges.forEach(([a, b], i) => {
    const A = pos[a], B = pos[b];
    const ax = A.x + A.w + 4, ay = A.y + NH / 2;
    const bx = B.x - 9, by = B.y + NH / 2;
    const mx = (ax + bx) / 2;
    const d = `M${ax},${ay} C${mx},${ay} ${mx},${by} ${bx},${by}`;
    edgeMarkup += `<path d="${d}" marker-end="url(#ah)"/>`;
    const dur = (2.6 + i * 0.32).toFixed(2);
    pktMarkup += `<circle r="2.7" fill="${t.cyan}">
      <animateMotion dur="${dur}s" repeatCount="indefinite" path="${d}"/>
      <animate attributeName="opacity" values="0;1;1;0" dur="${dur}s" repeatCount="indefinite"/></circle>`;
  });

  const nodeMarkup = nodes.map((n, i) => {
    const p = pos[n.id];
    return `<g opacity="0">
  <animate attributeName="opacity" from="0" to="1" dur=".6s" begin="${(i * 0.13).toFixed(2)}s" fill="freeze"/>
  <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${NH}" rx="7" fill="${t.panel}" stroke="${p.colour}" stroke-opacity=".5"/>
  <rect x="${p.x}" y="${p.y + 7}" width="3" height="${NH - 14}" rx="1.5" fill="${p.colour}"/>
  <text x="${p.x + 15}" y="${p.y + 19}" font-family="${FONT_SANS}" font-size="12.5" font-weight="600" fill="${t.fg}">${esc(n.title)}</text>
  <text x="${p.x + 15}" y="${p.y + 33}" font-family="${FONT_MONO}" font-size="9.5" fill="${t.fgDim}">${esc(n.sub)}</text>
</g>`;
  }).join('\n');

  const body = `
<defs>
  <marker id="ah" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
    <path d="M0 0 L7 3.5 L0 7 z" fill="${t.borderSoft}"/></marker>
</defs>
<rect width="${A_W}" height="${A_H}" fill="${t.canvas}"/>
<text x="40" y="30" font-family="${FONT_MONO}" font-size="10" fill="${t.fgFaint}" letter-spacing="2.5">HOW THE WORK ACTUALLY FLOWS</text>
<g stroke="${t.borderSoft}" stroke-width="1.4" fill="none" opacity="0">
  <animate attributeName="opacity" from="0" to="1" dur=".8s" begin=".9s" fill="freeze"/>${edgeMarkup}</g>
<g opacity="0"><animate attributeName="opacity" from="0" to="1" dur=".6s" begin="1.6s" fill="freeze"/>${pktMarkup}</g>
${nodeMarkup}
`;
  return svg(A_W, A_H, body, {
    title: 'System diagram: client referrals flow into Tomoe, through the shared BizFlow platform, out to four client deployments.',
  });
}

/* ------------------------------------------------------------------ *
 * 3. DIVIDER                                                           *
 * ------------------------------------------------------------------ */
function divider(t) {
  const W = 840;
  const body = `
<rect width="${W}" height="3" fill="${t.canvas}"/>
<rect y="1" width="${W}" height="2" rx="1" fill="${t.border}"/>
<defs><linearGradient id="sw" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0%" stop-color="${t.cyan}" stop-opacity="0"/>
  <stop offset="50%" stop-color="${t.violet}"/>
  <stop offset="100%" stop-color="${t.cyan}" stop-opacity="0"/></linearGradient></defs>
<rect y="1" width="170" height="2" rx="1" fill="url(#sw)">
  <animate attributeName="x" from="-170" to="${W}" dur="5s" repeatCount="indefinite"/></rect>
`;
  return svg(W, 3, body);
}

/* ------------------------------------------------------------------ */
for (const t of Object.values(THEMES)) {
  for (const p of cfg.projects) write(out(`cards/${p.slug}-${t.name}.svg`), card(p, t));
  write(out(`architecture-${t.name}.svg`), architecture(t));
  write(out(`divider-${t.name}.svg`), divider(t));
}
console.log('static assets built');

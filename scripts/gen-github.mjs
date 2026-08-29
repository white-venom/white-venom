// Builds assets/skyline-{dark,light}.svg  and  assets/activity-{dark,light}.svg
// Skyline: one building per project. Height = commits, colour = language.
// Activity: weekly commit volume from the contributions graph.
// Needs GITHUB_TOKEN in env (the Action supplies it automatically).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { THEMES, FONT_MONO } from './lib/theme.mjs';
import { svg, write, esc, safeFetch, seeded, nf } from './lib/svg.mjs';

const cfg = JSON.parse(readFileSync(new URL('./config.json', import.meta.url)));
const USER = cfg.github.primary;
const TOKEN = process.env.GITHUB_TOKEN;
const out = (p) => fileURLToPath(new URL(`../assets/${p}`, import.meta.url));
const GH = { Accept: 'application/vnd.github+json', 'User-Agent': USER, ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }) };

const LANG_COLOUR = {
  PHP: '#4F5D95', Blade: '#f7523f', Python: '#3572A5', JavaScript: '#f1e05a',
  TypeScript: '#3178c6', HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051',
  Java: '#b07219', 'C++': '#f34b7d', Dart: '#00B4AB', Vue: '#41b883', Go: '#00ADD8',
};
const colourFor = (lang, t) => LANG_COLOUR[lang] ?? t.fgDim;

/* ---------------- data ---------------- */
async function repoCommitCount(full) {
  const r = await safeFetch(`https://api.github.com/repos/${full}/commits?per_page=1`, { headers: GH });
  if (r === null) return 0;
  // The commit count lives in the Link header's last page, so re-request for headers.
  try {
    const res = await fetch(`https://api.github.com/repos/${full}/commits?per_page=1`, { headers: GH });
    const link = res.headers.get('link') ?? '';
    const m = link.match(/[?&]page=(\d+)>; rel="last"/);
    return m ? Number(m[1]) : Array.isArray(r) ? r.length : 0;
  } catch { return 0; }
}

async function collectRepos() {
  const owned = (await safeFetch(
    `https://api.github.com/users/${USER}/repos?per_page=100&sort=pushed`, { headers: GH })) ?? [];
  // An allow-list beats "top 12 by commits": scaffold and sample repos out-commit
  // the real projects, and the skyline is a portfolio, not a leaderboard.
  const allow = cfg.github.skylineRepos ?? [];
  const names = new Set(
    allow.length ? allow : owned.filter((r) => !r.fork).map((r) => r.full_name),
  );
  for (const extra of cfg.github.extraRepos ?? []) names.add(extra);

  const repos = [];
  for (const full of names) {
    const meta = owned.find((r) => r.full_name === full)
      ?? (await safeFetch(`https://api.github.com/repos/${full}`, { headers: GH }));
    if (!meta) continue;
    repos.push({
      name: meta.name,
      lang: meta.language ?? 'Other',
      commits: await repoCommitCount(full),
      stars: meta.stargazers_count ?? 0,
    });
  }
  return repos.filter((r) => r.commits > 0).sort((a, b) => b.commits - a.commits).slice(0, 12);
}

async function contributionWeeks() {
  if (!TOKEN) return null;
  const q = `query($u:String!){user(login:$u){contributionsCollection{contributionCalendar{
    weeks{contributionDays{contributionCount date}}}}}}`;
  try {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST', headers: { ...GH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, variables: { u: USER } }),
    });
    const j = await res.json();
    const weeks = j?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
    if (!weeks) return null;
    return weeks.slice(-20).map((w) => w.contributionDays.reduce((s, d) => s + d.contributionCount, 0));
  } catch { return null; }
}

/* ---------------- skyline ---------------- */
const S_W = 840, S_H = 270;

function skyline(repos, t) {
  const rnd = seeded('skyline');
  const base = 216, bw = 46, gap = 14, x0 = 44;
  const maxC = Math.max(...repos.map((r) => r.commits), 1);
  const scale = (c) => 30 + (c / maxC) * 122;
  let g = `<rect width="${S_W}" height="${S_H}" fill="${t.canvas}"/>`;
  g += `<text x="44" y="34" font-family="${FONT_MONO}" font-size="10" fill="${t.fgFaint}" letter-spacing="2.5">PROJECT SKYLINE · HEIGHT = COMMITS · COLOUR = LANGUAGE</text>`;
  g += `<line x1="24" y1="${base}" x2="${S_W - 24}" y2="${base}" stroke="${t.border}" stroke-width="1.5"/>`;

  repos.forEach((r, i) => {
    const x = x0 + i * (bw + gap);
    if (x + bw > S_W - 30) return;
    const h = scale(r.commits), y = base - h, d = 3, c = colourFor(r.lang, t);
    const begin = (i * 0.07).toFixed(2);

    g += `<polygon points="${x + bw},${y} ${x + bw + d * 2},${y - d * 2} ${x + bw + d * 2},${base - d * 2} ${x + bw},${base}" fill="${c}" opacity=".22"/>`;
    g += `<polygon points="${x},${y} ${x + d * 2},${y - d * 2} ${x + bw + d * 2},${y - d * 2} ${x + bw},${y}" fill="${c}" opacity=".45"/>`;
    g += `<rect x="${x}" y="${base}" width="${bw}" height="0" fill="${t.panel}" stroke="${c}" stroke-opacity=".5">
      <animate attributeName="height" from="0" to="${h.toFixed(0)}" dur=".9s" begin="${begin}s" fill="freeze"/>
      <animate attributeName="y" from="${base}" to="${y.toFixed(0)}" dur=".9s" begin="${begin}s" fill="freeze"/></rect>`;

    const rows = Math.floor(h / 16);
    for (let rw = 0; rw < rows; rw++) {
      for (let cl = 0; cl < 3; cl++) {
        if (rnd() < 0.42) continue;
        const wx = x + 8 + cl * 12, wy = y + 10 + rw * 16;
        g += `<rect x="${wx}" y="${wy.toFixed(0)}" width="6" height="7" rx="1" fill="${c}" opacity="0">
          <animate attributeName="opacity" values="0;.85;.5;.9" dur="${(3 + rnd() * 4).toFixed(1)}s"
            begin="${(1 + rnd() * 3).toFixed(1)}s" repeatCount="indefinite"/></rect>`;
      }
    }
    const label = r.name.length > 12 ? r.name.slice(0, 11) + '…' : r.name;
    g += `<text x="${x + bw / 2}" y="${base + 15}" font-family="${FONT_MONO}" font-size="8" fill="${t.fgDim}"
      text-anchor="end" transform="rotate(-42 ${x + bw / 2} ${base + 15})" opacity="0">${esc(label)}
      <animate attributeName="opacity" from="0" to="1" dur=".6s" begin="${(1 + i * 0.07).toFixed(2)}s" fill="freeze"/></text>`;
  });

  // key sits on the title row: the rotated repo labels own the bottom band
  const langs = [...new Set(repos.map((r) => r.lang))].slice(0, 5);
  const keyWidth = langs.reduce((w, l) => w + 18 + l.length * 5.8, 0);
  let lx = S_W - 44 - keyWidth;
  g += `<g opacity="0"><animate attributeName="opacity" from="0" to="1" dur=".6s" begin="2s" fill="freeze"/>`;
  for (const l of langs) {
    g += `<circle cx="${lx + 3.5}" cy="30" r="3.5" fill="${colourFor(l, t)}"/>`;
    g += `<text x="${lx + 12}" y="${34}" font-family="${FONT_MONO}" font-size="9" fill="${t.fgDim}">${esc(l)}</text>`;
    lx += 18 + l.length * 5.8;
  }
  g += `</g>`;

  const total = repos.reduce((s, r) => s + r.commits, 0);
  return svg(S_W, S_H, g, {
    title: `Project skyline: ${repos.length} projects, ${nf(total)} commits. Tallest is ${repos[0]?.name ?? '—'}.`,
  });
}

/* ---------------- activity ---------------- */
const A_W = 840, A_H = 150;

function activity(weeks, t) {
  const max = Math.max(...weeks, 1);
  const padL = 40, padR = 30, floor = A_H - 30;
  const span = A_W - padL - padR;
  const step = span / (weeks.length - 1);
  const yOf = (v) => floor - (v / max) * (floor - 42);
  const pts = weeks.map((v, i) => [padL + i * step, yOf(v)]);
  const line = 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L');

  const bw = span / weeks.length - 6;
  const bars = weeks.map((v, i) => {
    const x = padL + i * step - bw / 2, h = (v / max) * (floor - 42);
    return `<rect x="${x.toFixed(1)}" y="${floor}" width="${bw.toFixed(1)}" height="0" rx="2" fill="${t.panelAlt}" stroke="${t.border}" stroke-opacity=".6">
      <animate attributeName="height" from="0" to="${h.toFixed(1)}" dur=".9s" begin="${(i * 0.035).toFixed(2)}s" fill="freeze"/>
      <animate attributeName="y" from="${floor}" to="${(floor - h).toFixed(1)}" dur=".9s" begin="${(i * 0.035).toFixed(2)}s" fill="freeze"/></rect>`;
  }).join('');

  const [lx, ly] = pts.at(-1);
  const body = `
<defs>
  <linearGradient id="af" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${t.cyan}" stop-opacity=".28"/>
    <stop offset="100%" stop-color="${t.cyan}" stop-opacity="0"/></linearGradient>
  <linearGradient id="al" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="${t.cyan}"/><stop offset="100%" stop-color="${t.violet}"/></linearGradient>
</defs>
<rect width="${A_W}" height="${A_H}" fill="${t.canvas}"/>
<text x="${padL}" y="26" font-family="${FONT_MONO}" font-size="10" fill="${t.fgFaint}" letter-spacing="2.5">COMMIT ACTIVITY · LAST ${weeks.length} WEEKS · PEAK ${max}</text>
${bars}
<line x1="${padL - 12}" y1="${floor}" x2="${A_W - padR + 12}" y2="${floor}" stroke="${t.border}"/>
<path d="${line} L${(A_W - padR).toFixed(1)},${floor} L${padL},${floor} Z" fill="url(#af)" opacity="0">
  <animate attributeName="opacity" from="0" to="1" dur="1s" begin="1s" fill="freeze"/></path>
<path d="${line}" fill="none" stroke="url(#al)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"
  stroke-dasharray="2000" stroke-dashoffset="2000">
  <animate attributeName="stroke-dashoffset" from="2000" to="0" dur="2s" begin=".3s" fill="freeze"/></path>
<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="0" fill="${t.violet}">
  <animate attributeName="r" from="0" to="4.5" dur=".4s" begin="2.2s" fill="freeze"/>
  <animate attributeName="opacity" values="1;.35;1" dur="2s" begin="2.6s" repeatCount="indefinite"/></circle>
`;
  return svg(A_W, A_H, body, {
    title: `Commit activity over the last ${weeks.length} weeks, peaking at ${max} in a week.`,
  });
}

/* ---------------- run ---------------- */
if (!TOKEN) console.warn('! GITHUB_TOKEN not set — using sample data so you can preview locally');

const repos = TOKEN ? await collectRepos() : [
  { name: 'vantix', lang: 'Python', commits: 312 }, { name: 'crediiflow', lang: 'JavaScript', commits: 268 },
  { name: 'gayatri-erp', lang: 'PHP', commits: 241 }, { name: 'workin', lang: 'PHP', commits: 198 },
  { name: 'slotmedix', lang: 'PHP', commits: 176 }, { name: 'bizflow', lang: 'PHP', commits: 154 },
  { name: 'ai-exam-portal', lang: 'Python', commits: 131 }, { name: 'naukrikhoj', lang: 'TypeScript', commits: 108 },
  { name: 'loopmark', lang: 'TypeScript', commits: 92 }, { name: 'agarwal-co', lang: 'JavaScript', commits: 74 },
  { name: 'red-paradise', lang: 'Python', commits: 61 }, { name: 'teleprompter', lang: 'JavaScript', commits: 43 },
];
const weeks = (await contributionWeeks())
  ?? [14, 21, 11, 27, 34, 18, 31, 46, 38, 24, 41, 52, 32, 44, 57, 39, 48, 63, 54, 68];

for (const t of Object.values(THEMES)) {
  write(out(`skyline-${t.name}.svg`), skyline(repos, t));
  write(out(`activity-${t.name}.svg`), activity(weeks, t));
}
console.log(`skyline: ${repos.length} projects · activity: ${weeks.length} weeks`);

// Builds assets/security-{dark,light}.svg
// Pulls recent CVEs from the NVD 2.0 API, filtered to the stack in config.json.
// NVD_API_KEY as a repo secret raises the rate limit, but is optional.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { THEMES, FONT_MONO } from './lib/theme.mjs';
import { svg, write, esc, safeFetch } from './lib/svg.mjs';

const cfg = JSON.parse(readFileSync(new URL('./config.json', import.meta.url)));
const out = (p) => fileURLToPath(new URL(`../assets/${p}`, import.meta.url));
const KEY = process.env.NVD_API_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SEV_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const sevColour = (s, t) =>
  ({ CRITICAL: t.red, HIGH: t.red, MEDIUM: t.orange, LOW: t.fgMute }[s] ?? t.fgMute);
const sevShort = (s) => ({ CRITICAL: 'CRIT', HIGH: 'HIGH', MEDIUM: 'MED', LOW: 'LOW' }[s] ?? s);

function severityOf(cve) {
  const m = cve.metrics ?? {};
  const entry = m.cvssMetricV31?.[0] ?? m.cvssMetricV30?.[0] ?? m.cvssMetricV2?.[0];
  return entry?.cvssData?.baseSeverity ?? entry?.baseSeverity ?? 'LOW';
}

async function fetchCVEs() {
  const since = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 23);
  const until = new Date().toISOString().slice(0, 23);
  const rows = [];

  for (const kw of cfg.security.keywords) {
    const url = 'https://services.nvd.nist.gov/rest/json/cves/2.0'
      + `?keywordSearch=${encodeURIComponent(kw)}`
      + `&pubStartDate=${since}&pubEndDate=${until}&resultsPerPage=8`;
    const json = await safeFetch(url, { timeout: 15000, headers: KEY ? { apiKey: KEY } : {} });
    for (const v of json?.vulnerabilities ?? []) {
      const c = v.cve;
      rows.push({
        id: c.id,
        sev: severityOf(c),
        component: kw,
        published: (c.published ?? '').slice(0, 10),
      });
    }
    await sleep(KEY ? 700 : 6500); // respect NVD's rate limit
  }

  const seen = new Set();
  return rows
    .filter((r) => (seen.has(r.id) ? false : seen.add(r.id)))
    .sort((a, b) => (SEV_ORDER[a.sev] - SEV_ORDER[b.sev]) || b.published.localeCompare(a.published))
    .slice(0, cfg.security.maxRows);
}

const W = 840;

function render(rows, t) {
  const H = 66 + rows.length * 26 + 22;
  const body = `
<rect width="${W}" height="${H}" fill="${t.canvas}"/>
<rect x="18" y="14" width="${W - 36}" height="${H - 28}" rx="7" fill="${t.panelAlt}" stroke="${t.border}"/>
<text x="38" y="42" font-family="${FONT_MONO}" font-size="10" fill="${t.fgFaint}" letter-spacing="2.5">CVE FEED · MATCHED TO MY STACK · NVD</text>
<circle cx="${W - 40}" cy="38" r="3.5" fill="${t.green}">
  <animate attributeName="opacity" values="1;.25;1" dur="2s" repeatCount="indefinite"/></circle>
<line x1="38" y1="54" x2="${W - 38}" y2="54" stroke="${t.border}"/>
${rows.map((r, i) => {
  const y = 76 + i * 26;
  const c = sevColour(r.sev, t);
  const s = sevShort(r.sev);
  return `<g opacity="0">
  <animate attributeName="opacity" from="0" to="1" dur=".5s" begin="${(0.3 + i * 0.2).toFixed(2)}s" fill="freeze"/>
  <text x="38" y="${y}" font-family="${FONT_MONO}" font-size="11.5" fill="${t.fgMute}">${esc(r.id)}</text>
  <rect x="176" y="${y - 11}" width="46" height="15" rx="3" fill="${c}" fill-opacity=".16"/>
  <text x="199" y="${y}" font-family="${FONT_MONO}" font-size="9.5" fill="${c}" text-anchor="middle">${s}</text>
  <text x="240" y="${y}" font-family="${FONT_MONO}" font-size="11.5" fill="${t.fg}">${esc(r.component)}</text>
  <text x="${W - 38}" y="${y}" font-family="${FONT_MONO}" font-size="11" fill="${t.fgDim}" text-anchor="end">${esc(r.published)}</text>
  <line x1="38" y1="${y + 9}" x2="${W - 38}" y2="${y + 9}" stroke="${t.border}" stroke-opacity=".55"/>
</g>`;
}).join('\n')}
`;
  const worst = rows[0]?.sev ?? 'none';
  return svg(W, H, body, {
    title: `Live CVE feed filtered to my stack: ${rows.length} recent advisories, highest severity ${worst}.`,
  });
}

let rows = process.env.SAMPLE ? [] : await fetchCVEs();
if (!rows.length && process.env.SAMPLE) {
  // Local preview only — never used in the Action.
  rows = [
    { id: 'CVE-2026-31847', sev: 'HIGH', component: 'laravel', published: '2026-08-21' },
    { id: 'CVE-2026-30982', sev: 'HIGH', component: 'fastapi', published: '2026-08-14' },
    { id: 'CVE-2026-30119', sev: 'MEDIUM', component: 'react', published: '2026-08-06' },
    { id: 'CVE-2026-29903', sev: 'MEDIUM', component: 'postgresql', published: '2026-07-29' },
    { id: 'CVE-2026-28455', sev: 'LOW', component: 'redis', published: '2026-07-18' },
  ];
}
if (!rows.length) {
  // Production path: if the feed is genuinely down, say so. Never invent advisories.
  console.warn('! NVD returned nothing — writing a placeholder row so the profile still renders');
  rows = [{ id: 'feed unavailable', sev: 'LOW', component: 'retrying next run', published: '' }];
}
for (const t of Object.values(THEMES)) write(out(`security-${t.name}.svg`), render(rows, t));
console.log(`security: ${rows.length} advisories`);

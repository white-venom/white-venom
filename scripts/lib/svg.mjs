import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** XML-escape any text that goes inside an SVG node. */
export const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** Wrap body in an <svg> root. width/height are intrinsic; README scales them. */
export const svg = (w, h, body, { title = '' } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img"` +
  (title ? ` aria-label="${esc(title)}"` : '') +
  `>\n${title ? `<title>${esc(title)}</title>\n` : ''}${body}\n</svg>\n`;

export const write = (path, content) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
  console.log(`  wrote ${path}  (${(content.length / 1024).toFixed(1)} kB)`);
};

/** Deterministic pseudo-random from a string seed — keeps regenerated art stable. */
export const seeded = (seed) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** fetch with a timeout, returning null instead of throwing. */
export async function safeFetch(url, { timeout = 8000, headers = {} } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ac.signal, headers });
    if (!res.ok) {
      console.warn(`  ! ${res.status} from ${url}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`  ! fetch failed for ${url}: ${err.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Read a dotted path out of a JSON object: pick(obj, "data.count") */
export const pick = (obj, path) =>
  path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);

export const nf = (n) => Number(n).toLocaleString('en-IN');

// Shared design tokens. Every generator emits a -dark and a -light variant
// using these, so all images stay consistent and seam into GitHub's canvas.

export const THEMES = {
  dark: {
    name: 'dark',
    canvas: '#0d1117',   // exactly GitHub's dark canvas — no visible image box
    panel: '#111722',
    panelAlt: '#0a0f16',
    grid: '#161d29',
    border: '#1e2836',
    borderSoft: '#243040',
    fg: '#e6edf3',
    fgMute: '#8b949e',
    fgDim: '#5a6675',
    fgFaint: '#3d4756',
    cyan: '#39d0d8',
    violet: '#a371f7',
    magenta: '#d63aa8',
    green: '#3fb950',
    orange: '#e3903a',
    red: '#f85149',
    star: '#ffffff',
    cal: ['#1a2029', '#0e4429', '#006d32', '#26a641', '#39d353'],
  },
  light: {
    name: 'light',
    canvas: '#ffffff',   // exactly GitHub's light canvas
    panel: '#f6f8fa',
    panelAlt: '#f0f3f6',
    grid: '#eceff3',
    border: '#d1d9e0',
    borderSoft: '#c2cbd6',
    fg: '#1f2328',
    fgMute: '#59636e',
    fgDim: '#818b98',
    fgFaint: '#afb8c1',
    cyan: '#0f8b93',
    violet: '#8250df',
    magenta: '#bf3989',
    green: '#1a7f37',
    orange: '#bc4c00',
    red: '#cf222e',
    star: '#8250df',
    cal: ['#ebedf0', '#aceebb', '#4ac26b', '#2da44e', '#116329'],
  },
};

export const FONT_SANS = '-apple-system,BlinkMacSystemFont,Segoe UI,Noto Sans,Helvetica,Arial,sans-serif';
export const FONT_MONO = 'ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,Liberation Mono,monospace';

export const eachTheme = (fn) => Object.values(THEMES).map(fn);

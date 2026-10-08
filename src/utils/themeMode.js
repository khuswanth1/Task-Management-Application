const STORAGE_KEY = 'todo_theme_config';

// Text & background extras (stored in the local theme config)
export const extraDefaults = {
  lineHeight: '1.5',
  letterSpacing: '0em',
  fontWeight: '400',
  bgFit: 'cover',        // cover | contain | auto (tile)
  bgPosition: 'center',
  bgDim: 0,              // 0–80 (% dark overlay so text stays readable)
};

export const THEME_PRESETS = [
  { name: 'Midnight',  primary: '#6366f1', bg: '#0f172a', card: '#1e293b', sidebar: '#111827' },
  { name: 'Ocean',     primary: '#0ea5e9', bg: '#0c1a2e', card: '#132237', sidebar: '#0f1e30' },
  { name: 'Forest',    primary: '#10b981', bg: '#064e3b', card: '#065f46', sidebar: '#064e3b' },
  { name: 'Sunset',    primary: '#f97316', bg: '#fff7ed', card: '#ffffff', sidebar: '#fef3c7' },
  { name: 'Rose',      primary: '#f43f5e', bg: '#fff1f2', card: '#ffffff', sidebar: '#ffe4e6' },
  { name: 'Violet',    primary: '#8b5cf6', bg: '#1e1b4b', card: '#2e2b5b', sidebar: '#1a1840' },
  { name: 'Minimal',   primary: '#1f2937', bg: '#ffffff', card: '#f9fafb', sidebar: '#f3f4f6' },
  { name: 'Dracula',   primary: '#bd93f9', bg: '#282a36', card: '#383a59', sidebar: '#21222c' },
];

// Perceived brightness of a #rrggbb colour (true = dark background → dark mode)
export const isDarkHex = (hex) => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!m) return false;
  const [r, g, b] = m.slice(1).map(h => parseInt(h, 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
};

export const presetToConfig = (preset) => {
  const dark = isDarkHex(preset.bg);
  return {
    primaryColor: preset.primary,
    bgColor: preset.bg,
    sidebarColor: preset.sidebar,
    cardColor: preset.card,
    buttonBgColor: preset.primary,
    buttonTextColor: '#ffffff',
    headingColor: dark ? '#ffffff' : '#111827',
    textColor: dark ? '#cbd5e1' : '#4b5563',
    enableColors: true,
  };
};

/**
 * Applies a full look (saved custom theme or preset) from anywhere in the app — e.g. the
 * header theme menu. Persists it, lets App.jsx apply the CSS (via the 'storage' event),
 * and syncs the backend (without the background image, which the server then keeps).
 */
export function applySavedTheme(themeConfig) {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch (err) {
    saved = {};
  }
  const nextConfig = { ...modeDefaults(false), ...saved, ...themeConfig, enableColors: themeConfig.enableColors ?? true };
  delete nextConfig.logoImage;
  const mode = isDarkHex(nextConfig.bgColor) ? 'dark' : 'light';

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextConfig));
    localStorage.setItem('custom_theme_active', 'true');
    localStorage.setItem('theme', mode);
  } catch (err) {}
  window.dispatchEvent(new Event('storage'));

  const token = localStorage.getItem('token');
  if (token) {
    fetch('/api/settings/theme', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(nextConfig)
    }).catch(() => {});
  }
  return { config: nextConfig, mode };
}

/** Applies the text/background extras as CSS variables (used by index.css and Dashboard). */
export function applyTextAndBackgroundVars(cfg = {}) {
  const c = { ...extraDefaults, ...cfg };
  const root = document.documentElement;
  root.style.setProperty('--line-height', c.lineHeight);
  root.style.setProperty('--letter-spacing', c.letterSpacing);
  root.style.setProperty('--body-font-weight', c.fontWeight);
  root.style.setProperty('--bg-size', c.bgFit === 'auto' ? 'auto' : c.bgFit);
  root.style.setProperty('--bg-repeat', c.bgFit === 'auto' ? 'repeat' : 'no-repeat');
  root.style.setProperty('--bg-position', c.bgPosition);
  root.style.setProperty('--bg-dim', String(Math.min(80, Math.max(0, Number(c.bgDim) || 0)) / 100));
}

// Mode-appropriate defaults — kept in sync with defaults() in ThemeSettings.jsx
export const modeDefaults = (isDark) => ({
  primaryColor: '#4f46e5',
  bgColor: isDark ? '#0f172a' : '#f8fafc',
  sidebarColor: isDark ? '#1e293b' : '#ffffff',
  cardColor: isDark ? '#1e293b' : '#ffffff',
  headingColor: isDark ? '#ffffff' : '#0f172a',
  textColor: isDark ? '#cbd5e1' : '#475569',
  buttonBgColor: '#4f46e5',
  buttonTextColor: '#ffffff',
  fontSize: '16px',
  fontFamily: 'Inter',
  borderRadius: '1rem',
  logoImage: null
});

/**
 * Switch light/dark/system mode the same way the Theme Studio mode buttons do:
 * resync the custom surface colors to the new mode, disable custom color
 * overrides, update the CSS variables immediately, notify the rest of the app,
 * and persist to the backend so a reload doesn't revert the switch.
 */
export function applyThemeModeSwitch(newTheme, isSystemDark) {
  localStorage.setItem('theme', newTheme);
  const isDark = newTheme === 'dark' || (newTheme === 'system' && isSystemDark);
  const d = modeDefaults(isDark);

  let saved = null;
  try {
    const savedStr = localStorage.getItem(STORAGE_KEY);
    saved = savedStr ? JSON.parse(savedStr) : null;
  } catch (err) {
    saved = null;
  }

  const nextConfig = {
    ...d,
    ...(saved || {}),
    bgColor: d.bgColor,
    sidebarColor: d.sidebarColor,
    cardColor: d.cardColor,
    headingColor: d.headingColor,
    textColor: d.textColor,
    enableFontFamily: saved?.enableFontFamily ?? true,
    enableBorderRadius: saved?.enableBorderRadius ?? true,
    enableColors: false
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextConfig));
  } catch (err) {}

  // Update the CSS variables so pages driven by the custom theme switch immediately
  const root = document.documentElement;
  root.style.setProperty('--bg-color', nextConfig.bgColor);
  root.style.setProperty('--sidebar-color', nextConfig.sidebarColor);
  root.style.setProperty('--card-color', nextConfig.cardColor);
  root.style.setProperty('--heading-color', nextConfig.headingColor);
  root.style.setProperty('--text-color', nextConfig.textColor);
  root.classList.remove('theme-colors');

  // Notify App.jsx / ThemeSettings so every mounted page re-applies the theme
  window.dispatchEvent(new Event('storage'));

  // Persist to backend so fetchProfile doesn't revert the switch on reload
  const token = localStorage.getItem('token');
  if (token) {
    fetch('/api/settings/theme', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify(nextConfig)
    }).catch(() => {});
  }

  return nextConfig;
}

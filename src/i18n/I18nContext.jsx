import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { TRANSLATIONS } from './translations';
import { UI_LANGUAGES, findUiLanguage, findTypingLanguage } from './languages';

const KEY = 'todo_language_settings';

function initialSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved?.ui) return { typing: 'auto', transliterate: true, ...saved };
  } catch { /* fall through */ }
  // First visit: follow the browser language when we have it
  const browser = (navigator.language || 'en').slice(0, 2).toLowerCase();
  const ui = UI_LANGUAGES.some(l => l.code === browser) ? browser : 'en';
  return { ui, typing: 'auto', transliterate: true };
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [settings, setSettings] = useState(initialSettings);

  const update = useCallback((patch) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const uiLang = findUiLanguage(settings.ui);
  // "auto" = type in the app language
  const typingLang = findTypingLanguage(settings.typing === 'auto' ? settings.ui : settings.typing);

  // <html lang/dir> so screen readers, fonts and right-to-left layout follow the language
  useEffect(() => {
    document.documentElement.lang = uiLang.code;
    document.documentElement.dir = uiLang.dir;
  }, [uiLang]);

  const t = useCallback((key, vars) => {
    const dict = TRANSLATIONS[uiLang.code] || TRANSLATIONS.en;
    let s = dict[key] ?? TRANSLATIONS.en[key] ?? key;
    if (vars && typeof s === 'string') {
      s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
    }
    return s;
  }, [uiLang.code]);

  // Task ideas in the typing language (falls back to the app language, then English)
  const taskTemplates = useMemo(
    () => (TRANSLATIONS[typingLang.code] || TRANSLATIONS[uiLang.code] || TRANSLATIONS.en).tpl || TRANSLATIONS.en.tpl,
    [typingLang.code, uiLang.code]
  );

  const value = useMemo(() => ({
    t,
    uiLang,
    typingLang,
    typingSetting: settings.typing,
    transliterate: settings.transliterate,
    taskTemplates,
    setUiLanguage: (code) => update({ ui: code }),
    setTypingLanguage: (code) => update({ typing: code }),
    setTransliterate: (on) => update({ transliterate: on }),
  }), [t, uiLang, typingLang, settings.typing, settings.transliterate, taskTemplates, update]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

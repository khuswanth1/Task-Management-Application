import React, { useState } from 'react';
import TranslateIcon from '@mui/icons-material/Translate';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import CheckIcon from '@mui/icons-material/Check';
import { useI18n } from '../../i18n/I18nContext';
import { UI_LANGUAGES, TYPING_LANGUAGES } from '../../i18n/languages';
import MultilingualInput from '../MultilingualInput';

export default function LanguageSettings({ theme, isSystemDark }) {
  const isDark = theme === 'dark' || (theme === 'system' && isSystemDark);
  const { t, uiLang, typingLang, typingSetting, transliterate, setUiLanguage, setTypingLanguage, setTransliterate } = useI18n();
  const [query, setQuery] = useState('');
  const [tryText, setTryText] = useState('');

  const card = `p-5 rounded-2xl border space-y-4 ${isDark ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-200'}`;
  const heading = `text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`;
  const optionCls = (active) => `relative flex flex-col items-start px-3 py-2.5 rounded-xl border text-left transition-all hover:scale-[1.02]
    ${active ? 'border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/30'
      : isDark ? 'border-slate-700 bg-slate-800/60 hover:border-slate-500' : 'border-slate-200 bg-white hover:border-indigo-300'}`;

  const q = query.trim().toLowerCase();
  const typingMatches = TYPING_LANGUAGES.filter(l => !q || l.name.toLowerCase().includes(q) || l.english.toLowerCase().includes(q));

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h3 className={`text-2xl font-black tracking-tight mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('lang.title')}</h3>
        <p className="text-slate-500 text-sm font-medium">{t('lang.subtitle')}</p>
      </div>

      {/* App (interface) language */}
      <div className={card}>
        <h4 className={heading}><TranslateIcon sx={{ fontSize: 16 }} /> {t('lang.ui')}</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {UI_LANGUAGES.map(l => (
            <button type="button" key={l.code} onClick={() => setUiLanguage(l.code)} className={optionCls(uiLang.code === l.code)} lang={l.code} dir={l.dir}>
              <span className={`text-sm font-black ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{l.name}</span>
              <span className="text-[10px] font-bold text-slate-500">{l.english}</span>
              {uiLang.code === l.code && <CheckIcon sx={{ fontSize: 14 }} className="absolute top-2 right-2 text-indigo-500" />}
            </button>
          ))}
        </div>
      </div>

      {/* Typing language */}
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className={heading}><KeyboardIcon sx={{ fontSize: 16 }} /> {t('lang.typing')}</h4>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('lang.transliteration')}</span>
            <span className="relative inline-flex items-center">
              <input type="checkbox" className="sr-only peer" checked={transliterate} onChange={(e) => setTransliterate(e.target.checked)} />
              <span className="w-9 h-5 bg-slate-300 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></span>
            </span>
          </label>
        </div>
        <p className="text-xs text-slate-500">{t('lang.typingHint')}</p>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('lang.search')}
          className={`w-full px-3 py-2.5 rounded-xl border text-xs font-bold outline-none ${isDark ? 'bg-slate-800 text-slate-200 border-slate-600 placeholder:text-slate-500' : 'bg-white text-slate-700 border-slate-200'}`}
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-80 overflow-y-auto pr-1">
          {!q && (
            <button type="button" onClick={() => setTypingLanguage('auto')} className={optionCls(typingSetting === 'auto')}>
              <span className={`text-sm font-black ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{t('lang.sameAsUi')}</span>
              <span className="text-[10px] font-bold text-slate-500">{uiLang.name}</span>
              {typingSetting === 'auto' && <CheckIcon sx={{ fontSize: 14 }} className="absolute top-2 right-2 text-indigo-500" />}
            </button>
          )}
          {typingMatches.map(l => {
            const active = typingSetting === l.code;
            return (
              <button type="button" key={l.code} onClick={() => setTypingLanguage(l.code)} className={optionCls(active)} title={l.sample}>
                <span className={`text-sm font-black ${isDark ? 'text-slate-100' : 'text-slate-800'}`} lang={l.code} dir={l.dir || 'ltr'}>{l.name}</span>
                <span className="text-[10px] font-bold text-slate-500 truncate w-full">{l.english}{l.itc ? ` · ${l.sample}` : ''}</span>
                {active && <CheckIcon sx={{ fontSize: 14 }} className="absolute top-2 right-2 text-indigo-500" />}
              </button>
            );
          })}
        </div>

        {/* Try it */}
        <div className="pt-2 space-y-1.5">
          <MultilingualInput
            value={tryText}
            onValueChange={setTryText}
            ideas={{ recent: [] }}
            placeholder={`${t('lang.tryIt')} ${typingLang.itc ? typingLang.sample.split('→')[0].trim() : ''}`}
            className={`w-full px-4 py-3 rounded-xl border text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 ${isDark ? 'bg-slate-800 text-white border-slate-600 placeholder:text-slate-500' : 'bg-white text-slate-800 border-slate-200'}`}
          />
          {typingLang.itc && <p className="text-[10px] text-slate-500">{t('lang.privacy')}</p>}
        </div>
      </div>
    </div>
  );
}

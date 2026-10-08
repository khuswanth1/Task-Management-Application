import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';

// Google Input Tools: Latin phonetic typing -> native script candidates ("namaste" -> "नमस्ते").
// Called directly from the browser (it allows CORS). Results are cached per language+word.
const cache = new Map();
async function transliterate(word, itc, signal) {
  const key = `${itc}|${word}`;
  if (cache.has(key)) return cache.get(key);
  const url = `https://inputtools.google.com/request?text=${encodeURIComponent(word)}&itc=${itc}&num=6&cp=0&cs=1&ie=utf-8&oe=utf-8&app=todo`;
  const res = await fetch(url, { signal });
  const data = await res.json();
  const candidates = data?.[0] === 'SUCCESS' ? (data[1]?.[0]?.[1] || []) : [];
  cache.set(key, candidates);
  return candidates;
}

const LATIN_WORD_BEFORE_CARET = /[A-Za-z]+$/;

/**
 * Text input / textarea that lets people type tasks in their own language:
 *  - Typing language with a non-Latin script: Latin phonetic words are converted to the native
 *    script; candidates appear in a list (Space/Enter = first, ↑↓ to choose, Esc to keep Latin).
 *  - `ideas` (title fields): suggestions from recent tasks and common task templates.
 * The small script button in the corner switches conversion on/off (e.g. to type English words).
 */
export default function MultilingualInput({
  as = 'input', value, onValueChange, ideas = null, className = '', dropUp = false, ...rest
}) {
  const { t, typingLang, transliterate: convertOn, setTransliterate, taskTemplates } = useI18n();
  const ref = useRef(null);
  const [focused, setFocused] = useState(false);
  const [candidates, setCandidates] = useState([]); // native-script candidates for the current word
  const [word, setWord] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const pendingCaret = useRef(null);

  const converting = convertOn && !!typingLang.itc;
  const Tag = as;

  // Title ideas: recent task titles + templates, matched against what's typed so far
  const ideaItems = useMemo(() => {
    if (!ideas) return [];
    const q = (value || '').trim().toLowerCase();
    const recent = [...new Set(ideas.recent || [])];
    const pool = [
      ...recent.map(label => ({ label, group: 'recent' })),
      ...taskTemplates.filter(tp => !recent.includes(tp)).map(label => ({ label, group: 'ideas' })),
    ];
    const matches = q
      ? pool.filter(i => i.label.toLowerCase().includes(q) && i.label.toLowerCase() !== q)
      : pool;
    return matches.slice(0, 7);
  }, [ideas, value, taskTemplates]);

  // Fetch candidates for the Latin word just before the caret
  useEffect(() => {
    if (!converting || !word) { setCandidates([]); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      transliterate(word, typingLang.itc, ctrl.signal)
        .then(c => { setCandidates(c); setHighlight(0); })
        .catch(() => {}); // offline / blocked: keep the Latin text
    }, 120);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [word, converting, typingLang.itc]);

  // Restore the caret after we replace text programmatically
  useEffect(() => {
    if (pendingCaret.current !== null && ref.current) {
      ref.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [value]);

  const detectWord = (text, caret) => {
    const m = converting ? LATIN_WORD_BEFORE_CARET.exec(text.slice(0, caret)) : null;
    setWord(m ? m[0] : '');
  };

  const handleChange = (e) => {
    setDismissed(false);
    onValueChange(e.target.value);
    detectWord(e.target.value, e.target.selectionStart ?? e.target.value.length);
  };

  const replaceWord = (replacement, trailing = '') => {
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const start = caret - word.length;
    const next = value.slice(0, start) + replacement + trailing + value.slice(caret);
    pendingCaret.current = start + replacement.length + trailing.length;
    onValueChange(next);
    setWord('');
    setCandidates([]);
  };

  const pickIdea = (label) => {
    pendingCaret.current = label.length;
    onValueChange(label);
    setDismissed(true);
  };

  // What the dropdown shows right now
  const showCandidates = converting && word && candidates.length > 0;
  const items = showCandidates
    ? candidates.map(label => ({ label, group: 'convert' }))
    : (!dismissed && focused && !word ? ideaItems : []);
  const open = focused && items.length > 0;

  const choose = (item, trailing = '') => {
    if (item.group === 'convert') replaceWord(item.label, trailing);
    else pickIdea(item.label);
  };

  const handleKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return; // a device IME is active — let it work
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => (h + 1) % items.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => (h - 1 + items.length) % items.length); }
    else if (e.key === 'Escape') { e.preventDefault(); setWord(''); setCandidates([]); setDismissed(true); }
    else if ((e.key === 'Enter' && !(as === 'textarea' && e.shiftKey)) || e.key === 'Tab') {
      if (e.key === 'Tab' && !showCandidates) return; // Tab moves focus unless converting
      e.preventDefault();
      choose(items[highlight] || items[0]);
    } else if (e.key === ' ' && showCandidates) {
      e.preventDefault();
      choose(items[highlight] || items[0], ' ');
    }
  };

  const groupLabel = { convert: t('suggest.convert'), recent: t('suggest.recent'), ideas: t('suggest.ideas') };
  const scriptBadge = typingLang.name.charAt(0);

  return (
    <div className="relative w-full min-w-0 flex-1">
      <Tag
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onClick={(e) => detectWord(value, e.target.selectionStart ?? value.length)}
        dir={converting ? (typingLang.dir || 'auto') : 'auto'}
        lang={converting ? typingLang.code : undefined}
        autoComplete="off"
        className={`${className} ${typingLang.itc ? (as === 'textarea' ? 'pr-12' : '!pr-12') : ''}`}
        {...rest}
      />

      {typingLang.itc && (
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setTransliterate(!convertOn)}
          title={convertOn ? t('typing.on', { name: typingLang.name }) : t('typing.off', { name: typingLang.name })}
          aria-label={convertOn ? t('typing.on', { name: typingLang.name }) : t('typing.off', { name: typingLang.name })}
          aria-pressed={convertOn}
          className={`absolute right-2 ${as === 'textarea' ? 'top-2' : 'top-1/2 -translate-y-1/2'} w-8 h-8 rounded-lg text-sm font-black flex items-center justify-center border transition-colors
            ${convertOn ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-transparent text-slate-400 border-slate-300 dark:border-slate-600'}`}
        >
          {convertOn ? scriptBadge : 'A'}
        </button>
      )}

      {open && (
        <ul
          role="listbox"
          className={`absolute left-0 right-0 ${dropUp ? 'bottom-full mb-1' : 'top-full mt-1'} z-[300] max-h-64 overflow-y-auto rounded-xl border shadow-2xl py-1
            bg-white border-slate-200 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100`}
        >
          {items.map((item, i) => (
            <React.Fragment key={`${item.group}-${item.label}`}>
              {(i === 0 || items[i - 1].group !== item.group) && (
                <li className="px-3 pt-1.5 pb-0.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                  {groupLabel[item.group]}{item.group === 'convert' ? ` · ${word}` : ''}
                </li>
              )}
              <li
                role="option"
                aria-selected={i === highlight}
                onMouseDown={(e) => { e.preventDefault(); choose(item, item.group === 'convert' ? ' ' : ''); }}
                onMouseEnter={() => setHighlight(i)}
                className={`px-3 py-2 text-sm font-bold cursor-pointer flex items-center gap-2
                  ${i === highlight ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}
              >
                {item.group === 'convert' && <span className="text-[10px] opacity-60 w-3">{i + 1}</span>}
                <span className="truncate" dir="auto">{item.label}</span>
              </li>
            </React.Fragment>
          ))}
        </ul>
      )}
    </div>
  );
}

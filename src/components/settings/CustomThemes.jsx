import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { loadFontPreview } from '../../utils/googleFonts';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SyncIcon from '@mui/icons-material/Sync';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import CheckIcon from '@mui/icons-material/Check';

const CUSTOM_THEMES_KEY = 'todo_custom_themes';
const MAX_THEMES = 30;

// Everything that makes up a theme's look (the background image is left out: it is
// large and lives in your profile — a saved theme keeps whatever image is set)
export const THEME_KEYS = [
  'primaryColor', 'bgColor', 'sidebarColor', 'cardColor', 'headingColor', 'textColor',
  'buttonBgColor', 'buttonTextColor', 'fontSize', 'fontFamily', 'borderRadius',
  'enableFontFamily', 'enableBorderRadius', 'enableColors',
  'lineHeight', 'letterSpacing', 'fontWeight', 'bgFit', 'bgPosition', 'bgDim',
];

export const pickTheme = (cfg) => Object.fromEntries(THEME_KEYS.filter(k => cfg[k] !== undefined).map(k => [k, cfg[k]]));

const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

export function loadThemes() {
  try {
    const list = JSON.parse(localStorage.getItem(CUSTOM_THEMES_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function storeThemes(list) {
  try {
    localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event('custom-themes-changed')); // e.g. the "Custom" mode picker
    return true;
  } catch {
    toast.error('Could not save themes (browser storage is full).');
    return false;
  }
}

export default function CustomThemes({ config, onApply, isDark }) {
  const [themes, setThemes] = useState(loadThemes);
  const [name, setName] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const importRef = useRef(null);

  // Load each saved theme's font (just the glyphs of its name) for the mini previews
  useEffect(() => {
    themes.forEach(t => loadFontPreview(t.config.fontFamily));
  }, [themes]);

  const persist = (list) => {
    if (storeThemes(list)) setThemes(list);
  };

  const current = JSON.stringify(pickTheme(config));
  const activeId = themes.find(t => JSON.stringify(pickTheme(t.config)) === current)?.id;

  const saveNew = (e) => {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return toast.error('Give your theme a name.');
    if (themes.length >= MAX_THEMES) return toast.error(`You can keep up to ${MAX_THEMES} themes.`);
    if (themes.some(t => t.name.toLowerCase() === trimmed.toLowerCase())) {
      return toast.error(`A theme named "${trimmed}" already exists — use ⟳ on it to update it.`);
    }
    persist([...themes, { id: crypto.randomUUID(), name: trimmed, config: pickTheme(config), createdAt: Date.now() }]);
    setName('');
    toast.success(`Theme "${trimmed}" saved`);
  };

  const overwrite = (theme) => {
    if (!window.confirm(`Replace "${theme.name}" with your current settings?`)) return;
    persist(themes.map(t => (t.id === theme.id ? { ...t, config: pickTheme(config), updatedAt: Date.now() } : t)));
    toast.success(`Theme "${theme.name}" updated`);
  };

  const remove = (theme) => {
    if (!window.confirm(`Delete theme "${theme.name}"?`)) return;
    persist(themes.filter(t => t.id !== theme.id));
  };

  const commitRename = (theme) => {
    const trimmed = renameValue.trim();
    setRenamingId(null);
    if (!trimmed || trimmed === theme.name) return;
    persist(themes.map(t => (t.id === theme.id ? { ...t, name: trimmed } : t)));
  };

  const exportThemes = () => {
    if (themes.length === 0) return toast.error('No themes to export yet.');
    const blob = new Blob([JSON.stringify({ app: 'Todo Pro', type: 'themes', version: 1, themes }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'todo-pro-themes.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importThemes = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const incoming = (Array.isArray(data) ? data : data.themes || [])
          .filter(t => t && typeof t.name === 'string' && t.config && isHex(t.config.primaryColor));
        if (incoming.length === 0) return toast.error('No valid themes found in that file.');
        const names = new Set(themes.map(t => t.name.toLowerCase()));
        const added = incoming
          .filter(t => !names.has(t.name.toLowerCase()))
          .map(t => ({ id: crypto.randomUUID(), name: t.name.slice(0, 40), config: pickTheme(t.config), createdAt: Date.now() }));
        const merged = [...themes, ...added].slice(0, MAX_THEMES);
        persist(merged);
        toast.success(`Imported ${merged.length - themes.length} theme(s)` + (added.length < incoming.length ? ' (skipped duplicates)' : ''));
      } catch {
        toast.error('That file is not a valid theme export.');
      }
    };
    reader.readAsText(file);
  };

  const card = isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200';
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const smallBtn = `p-1.5 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:bg-slate-700 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className={`text-xs font-black uppercase tracking-widest ${muted}`}>My Themes</h4>
        <div className="flex gap-2">
          <button type="button" onClick={() => importRef.current?.click()} className={`px-3 py-1.5 rounded-lg border text-[11px] font-black flex items-center gap-1 ${card} ${muted}`}>
            <FileUploadIcon sx={{ fontSize: 14 }} /> Import
          </button>
          <button type="button" onClick={exportThemes} className={`px-3 py-1.5 rounded-lg border text-[11px] font-black flex items-center gap-1 ${card} ${muted}`}>
            <FileDownloadIcon sx={{ fontSize: 14 }} /> Export
          </button>
          <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={importThemes} />
        </div>
      </div>

      {/* Save current look */}
      <form onSubmit={saveNew} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="Name your current look, e.g. “Focus Night”"
          className={`flex-1 px-3 py-2.5 rounded-xl border text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/30 ${isDark ? 'bg-slate-800 text-slate-200 border-slate-600 placeholder:text-slate-500' : 'bg-white text-slate-700 border-slate-200 placeholder:text-slate-400'}`}
        />
        <button type="submit" className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center gap-1 active:scale-95">
          <AddIcon sx={{ fontSize: 16 }} /> Save theme
        </button>
      </form>

      {themes.length === 0 ? (
        <p className={`text-xs ${muted} px-1`}>
          No saved themes yet. Adjust colours, font, text and background below, then save the look here to switch back to it anytime.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {themes.map(theme => {
            const c = theme.config;
            const active = theme.id === activeId;
            return (
              <div key={theme.id}
                className={`group relative rounded-2xl border overflow-hidden transition-all hover:shadow-md ${card} ${active ? 'ring-2 ring-indigo-500' : ''}`}>
                {/* Mini preview of the theme */}
                <button type="button" onClick={() => onApply(c)} className="block w-full text-left" title={`Apply "${theme.name}"`}>
                  <div className="h-20 p-2.5 flex gap-2" style={{ backgroundColor: c.bgColor }}>
                    <div className="w-8 rounded-md" style={{ backgroundColor: c.sidebarColor }} />
                    <div className="flex-1 rounded-md p-2 flex flex-col justify-between" style={{ backgroundColor: c.cardColor, borderRadius: c.borderRadius }}>
                      <span className="text-[11px] font-black truncate" style={{ color: c.headingColor, fontFamily: c.fontFamily ? `"${c.fontFamily}", sans-serif` : undefined }}>
                        {c.fontFamily || 'Inter'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 flex-1 rounded-full opacity-40" style={{ backgroundColor: c.textColor }} />
                        <span className="px-2 py-0.5 text-[8px] font-black" style={{ backgroundColor: c.buttonBgColor, color: c.buttonTextColor, borderRadius: c.borderRadius }}>OK</span>
                      </div>
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-1 px-3 py-2">
                  {active && <CheckIcon sx={{ fontSize: 14 }} className="text-indigo-500" />}
                  {renamingId === theme.id ? (
                    <input autoFocus value={renameValue} maxLength={40}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => commitRename(theme)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitRename(theme); if (e.key === 'Escape') setRenamingId(null); }}
                      className={`flex-1 min-w-0 px-1 py-0.5 rounded text-xs font-black outline-none border ${isDark ? 'bg-slate-900 text-white border-slate-600' : 'bg-white border-slate-300'}`} />
                  ) : (
                    <span className={`flex-1 min-w-0 truncate text-xs font-black ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{theme.name}</span>
                  )}
                  <button type="button" className={smallBtn} title="Rename" aria-label={`Rename ${theme.name}`}
                    onClick={() => { setRenamingId(theme.id); setRenameValue(theme.name); }}>
                    <EditIcon sx={{ fontSize: 14 }} />
                  </button>
                  <button type="button" className={smallBtn} title="Update with current settings" aria-label={`Update ${theme.name}`} onClick={() => overwrite(theme)}>
                    <SyncIcon sx={{ fontSize: 14 }} />
                  </button>
                  <button type="button" className={`${smallBtn} hover:!text-red-500`} title="Delete" aria-label={`Delete ${theme.name}`} onClick={() => remove(theme)}>
                    <DeleteIcon sx={{ fontSize: 14 }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

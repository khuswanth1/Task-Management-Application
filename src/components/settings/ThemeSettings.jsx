import React, { useState, useEffect } from 'react';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SaveIcon from '@mui/icons-material/Save';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import { ensureFontLoaded, cssFontStack, loadFontPreview, fetchGoogleFontFamilies } from '../../utils/googleFonts';

import { applyTextAndBackgroundVars, extraDefaults, THEME_PRESETS as presets, isDarkHex, presetToConfig } from '../../utils/themeMode';
import CustomThemes, { loadThemes, pickTheme } from './CustomThemes';
import PaletteIcon from '@mui/icons-material/Palette';
import toast from 'react-hot-toast';

const STORAGE_KEY = 'todo_theme_config';

// Removed CURATED_FONTS - now fetching directly from the backend API

const CATEGORY_LABELS = {
  'sans-serif': 'Sans Serif',
  serif: 'Serif',
  display: 'Display',
  handwriting: 'Handwriting',
  monospace: 'Monospace',
};

const ColorInput = ({ label, value, onChange, isDark }) => {
  const isValidHex = (val) => /^#[0-9a-fA-F]{6}$/.test(val);
  const safeColor = isValidHex(value) ? value.toLowerCase() : '#000000';

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <div className={`color-input-container flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-all hover:shadow-sm
        ${isDark ? 'bg-slate-800 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-indigo-300'}`}>
        <div className="relative w-7 h-7 rounded-lg overflow-hidden border border-black/10 shadow-sm flex-shrink-0">
          <input
            type="color"
            value={safeColor}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full cursor-pointer border-0 p-0 opacity-0"
          />
          <div className="w-full h-full" style={{ backgroundColor: isValidHex(value) ? value : '#000000' }} />
        </div>
        <input 
          type="text"
          value={value}
          onChange={(e) => {
            let val = e.target.value;
            // Automatically prepend '#' if not present and they are typing hex chars
            if (val && !val.startsWith('#') && /^[0-9a-fA-F]{1,6}$/.test(val)) {
              val = '#' + val;
            }
            onChange(val);
          }}
          className="font-mono text-[11px] font-bold tracking-wider bg-transparent border-0 outline-none w-16 p-0 focus:ring-0"
          style={{ color: isDark ? '#cbd5e1' : '#475569' }}
        />
      </div>
    </div>
  );
};

const defaults = (isSystemDark) => ({
  primaryColor: '#4f46e5',
  bgColor: isSystemDark ? '#0f172a' : '#f8fafc',
  sidebarColor: isSystemDark ? '#1e293b' : '#ffffff',
  cardColor: isSystemDark ? '#1e293b' : '#ffffff',
  headingColor: isSystemDark ? '#ffffff' : '#0f172a',
  textColor: isSystemDark ? '#cbd5e1' : '#475569',
  buttonBgColor: '#4f46e5',
  buttonTextColor: '#ffffff',
  fontSize: '16px',
  fontFamily: 'Inter',
  borderRadius: '1rem',
  logoImage: null,
  ...extraDefaults
});

// Text & background extras live only in the local config (the backend stores the core theme)
const localExtras = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return Object.fromEntries(Object.keys(extraDefaults).map(k => [k, saved[k] ?? extraDefaults[k]]));
  } catch {
    return { ...extraDefaults };
  }
};

const SearchableSelect = ({ value, onChange, options, disabled, isDark, placeholder, renderOption, limit = 1900, onOptionsShown }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = React.useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  ).slice(0, limit); // Search narrows the list; the limit keeps 1800+ fonts from freezing the browser

  useEffect(() => {
    if (isOpen && onOptionsShown) onOptionsShown(filteredOptions);
  }, [isOpen, search]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative" ref={dropdownRef}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between cursor-pointer transition-all ${isDark ? 'bg-slate-800 text-slate-300 border-slate-600' : 'bg-white text-slate-700 border-slate-200'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className="truncate">{options.find(o => o.value === value)?.label || placeholder}</span>
        <ExpandMoreIcon sx={{ fontSize: 16 }} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className={`absolute z-[200] mt-1 w-full rounded-xl border shadow-lg overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="p-2 border-b border-slate-200 dark:border-slate-700 relative flex items-center">
            <SearchIcon sx={{ fontSize: 16 }} className={`absolute left-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input 
              type="text" 
              placeholder="Search..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-8 pr-3 py-2 text-xs rounded-lg outline-none ${isDark ? 'bg-slate-900 text-white placeholder:text-slate-500 border border-slate-700/50' : 'bg-slate-100 text-slate-700 placeholder:text-slate-400 border border-slate-200'}`}
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500">No results found</div>
            ) : (
              filteredOptions.map((opt) => (
                <div 
                  key={opt.value} 
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={`px-3 py-2 text-xs cursor-pointer hover:bg-indigo-500 hover:text-white transition-colors ${value === opt.value ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' : isDark ? 'text-slate-300' : 'text-slate-700'}`}
                  style={renderOption ? renderOption(opt) : {}}
                >
                  {opt.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function ThemeSettings({ theme, setTheme, isSystemDark, user, token, onProfileUpdate }) {
  const [config, setConfig] = useState(() => {
    if (user?.primaryColor) {
      return {
        primaryColor: user.primaryColor,
        bgColor: user.bgColor,
        sidebarColor: user.sidebarColor,
        cardColor: user.cardColor,
        headingColor: user.headingColor,
        textColor: user.textColor,
        buttonBgColor: user.buttonBgColor,
        buttonTextColor: user.buttonTextColor,
        fontSize: user.fontSize || '16px',
        fontFamily: user.fontFamily || 'Inter',
        borderRadius: user.borderRadius || '1rem',
        logoImage: user.logoImage || null,
        enableFontFamily: user.enableFontFamily ?? true,
        enableBorderRadius: user.enableBorderRadius ?? true,
        enableColors: user.enableColors ?? false,
        ...localExtras()
      };
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : { ...defaults(isSystemDark), enableFontFamily: true, enableBorderRadius: true, enableColors: false };
    } catch {
      return { ...defaults(isSystemDark), enableFontFamily: true, enableBorderRadius: true, enableColors: false };
    }
  });

  const [saved, setSaved] = useState(false);
  const [logoPreview, setLogoPreview] = useState(user?.logoImage || config.logoImage || null);
  const [apiFonts, setApiFonts] = useState(null);

  // "Custom" mode picker: saved themes, kept in sync with the My Themes section
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [savedThemes, setSavedThemes] = useState(loadThemes);
  useEffect(() => {
    const sync = () => setSavedThemes(loadThemes());
    window.addEventListener('custom-themes-changed', sync);
    return () => window.removeEventListener('custom-themes-changed', sync);
  }, []);

  const isDark = theme === 'dark' || (theme === 'system' && isSystemDark);

  useEffect(() => {
    let cancelled = false;
    // Cached 7 days in localStorage (with weights + category, used to load fonts correctly)
    fetchGoogleFontFamilies().then((fonts) => {
      if (cancelled || !fonts) return;
      setApiFonts(fonts.map(f => ({
        family: f.family,
        category: f.category,
        label: `${f.family} · ${CATEGORY_LABELS[f.category] || f.category}`
      })));
    });
    return () => { cancelled = true; };
  }, []);

  const fontOptions = apiFonts && apiFonts.length > 0 ? apiFonts : [];

  const set = (key) => (value) => {
    if (key === 'fontFamily') ensureFontLoaded(value);
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  // Applies a complete look (preset or saved custom theme) and persists it locally + to the backend.
  // nextConfig is built up-front: reading it from inside a setState updater is not guaranteed
  // to have run before the fetch, which used to send an empty theme to the server.
  const applyFullConfig = (patch) => {
    const nextConfig = { ...config, ...patch };
    const dark = isDarkHex(nextConfig.bgColor);
    setConfig(nextConfig);
    if (nextConfig.fontFamily) ensureFontLoaded(nextConfig.fontFamily);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextConfig));
      localStorage.setItem('custom_theme_active', 'true');
    } catch (e) {}
    if (nextConfig.enableColors) {
      setTheme(dark ? 'dark' : 'light');
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    }

    // Silently sync to backend to prevent fetchProfile from reverting this on browser reload
    fetch("/api/settings/theme", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({ ...nextConfig, logoImage: logoPreview })
    }).then(res => { if (res.ok && onProfileUpdate) onProfileUpdate(); }).catch(() => {});
  };

  const applyPreset = (preset) => applyFullConfig(presetToConfig(preset));

  const applyCustomTheme = (themeConfig) => {
    applyFullConfig({ ...themeConfig, enableColors: themeConfig.enableColors ?? true });
    toast.success('Theme applied');
  };

  // Live preview: every change shows across the app immediately ("Apply" saves it)
  useEffect(() => {
    applyToDOM(config);
    const root = document.documentElement;
    root.classList.add('custom-theme');
    root.classList.add('theme-font-size');
    root.classList.toggle('theme-font-family', config.enableFontFamily);
    root.classList.toggle('theme-border-radius', config.enableBorderRadius);
    root.classList.toggle('theme-colors', config.enableColors);
  }, [config]);

  const applyToDOM = (cfg) => {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', cfg.primaryColor);
    root.style.setProperty('--bg-color', cfg.bgColor);
    root.style.setProperty('--sidebar-color', cfg.sidebarColor);
    root.style.setProperty('--card-color', cfg.cardColor);
    root.style.setProperty('--heading-color', cfg.headingColor);
    root.style.setProperty('--text-color', cfg.textColor);
    root.style.setProperty('--button-bg-color', cfg.buttonBgColor);
    root.style.setProperty('--button-text-color', cfg.buttonTextColor);
    root.style.setProperty('--base-font-size', cfg.fontSize);
    root.style.setProperty('--font-family', cssFontStack(cfg.fontFamily));
    root.style.setProperty('--border-radius', cfg.borderRadius);
    applyTextAndBackgroundVars(cfg);
  };

  const handleSave = async () => {
    applyToDOM(config);
    const root = document.documentElement;
    
    root.classList.add('custom-theme');
    root.classList.toggle('theme-font-family', config.enableFontFamily);
    root.classList.toggle('theme-font-size', true); // Always enabled
    root.classList.toggle('theme-border-radius', config.enableBorderRadius);
    root.classList.toggle('theme-colors', config.enableColors);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    localStorage.setItem('custom_theme_active', 'true');
    localStorage.setItem('theme', theme); // Save the selected theme
    window.dispatchEvent(new Event('storage')); // Notify App.jsx of theme change

    try {
      const res = await fetch("/api/settings/theme", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
          ...config,
          logoImage: logoPreview
        })
      });
      if (res.ok) {
        setSaved(true);
        if (onProfileUpdate) onProfileUpdate();
        setTimeout(() => setSaved(false), 2000);
      } else {
        alert("API Sync Failed");
      }
    } catch (e) {
      console.error("Failed to sync theme to backend", e);
    }
  };

  const handleReset = async () => {
    const d = defaults(isSystemDark);
    setConfig({ ...d, enableFontFamily: true, enableBorderRadius: true, enableColors: false });
    applyToDOM(d);
    setLogoPreview(null);
    document.documentElement.classList.remove('custom-theme', 'theme-font-family', 'theme-font-size', 'theme-border-radius', 'theme-colors');
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('custom_theme_active');
    
    setTheme('system');
    localStorage.setItem('theme', 'system');
    window.dispatchEvent(new Event('storage'));

    try {
      await fetch("/api/settings/theme", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
          primaryColor: "", bgColor: "", sidebarColor: "", cardColor: "", headingColor: "", textColor: "",
          buttonBgColor: "", buttonTextColor: "", fontSize: "", fontFamily: "", borderRadius: "", logoImage: "",
          enableFontFamily: true, enableBorderRadius: true, enableColors: false
        })
      });
      if (onProfileUpdate) onProfileUpdate();
    } catch (e) {
      console.error("Failed to sync reset theme to backend", e);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (user) {
      const newConfig = {
        primaryColor: user.primaryColor || "",
        bgColor: user.bgColor || "",
        sidebarColor: user.sidebarColor || "",
        cardColor: user.cardColor || "",
        headingColor: user.headingColor || "",
        textColor: user.textColor || "",
        buttonBgColor: user.buttonBgColor || "",
        buttonTextColor: user.buttonTextColor || "",
        fontSize: user.fontSize || '16px',
        fontFamily: user.fontFamily || 'Inter',
        borderRadius: user.borderRadius || '1rem',
        logoImage: user.logoImage || null,
        enableFontFamily: user.enableFontFamily ?? true,
        enableBorderRadius: user.enableBorderRadius ?? true,
        enableColors: user.enableColors ?? false,
        ...localExtras()
      };
      setConfig(newConfig);
      setLogoPreview(user.logoImage || null);
      applyToDOM(newConfig);
      if (newConfig.fontFamily) {
        ensureFontLoaded(newConfig.fontFamily);
      }
    }
  }, [user]);

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          setConfig(JSON.parse(saved));
        }
      } catch (e) {}
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const modeOptions = [
    { id: 'light', label: 'Light', icon: <LightModeIcon sx={{ fontSize: 18 }} /> },
    { id: 'dark', label: 'Dark', icon: <DarkModeIcon sx={{ fontSize: 18 }} /> },
    { id: 'system', label: 'System', icon: <SettingsBrightnessIcon sx={{ fontSize: 18 }} /> },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-2xl font-black tracking-tight mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            Theme Studio
          </h3>
          <p className="text-slate-500 text-sm font-medium">Design your perfect workspace environment.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleReset} className={`px-4 py-2.5 rounded-xl font-black text-sm flex items-center gap-1.5 transition-all border active:scale-95 ${isDark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
            <RestartAltIcon sx={{ fontSize: 16 }} /> 
          </button>
          <button type="button" onClick={handleSave} className={`px-5 py-2.5 rounded-xl font-black text-sm flex items-center gap-1.5 transition-all active:scale-95 shadow-md ${saved ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-indigo-500/30 hover:shadow-indigo-500/50'}`}>
            {saved ? <><CheckCircleIcon sx={{ fontSize: 16 }} /> Saved!</> : <><SaveIcon sx={{ fontSize: 16 }} /> Apply</>}
          </button>
        </div>
      </div>

      <div className={`p-1.5 rounded-2xl inline-flex gap-1 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
        {modeOptions.map(({ id, label, icon }) => (
          <button type="button" key={id} onClick={() => {
            setTheme(id);
            localStorage.setItem('theme', id);
            
            // Sync the custom colors to match the newly selected mode AND disable them so the switch takes effect
            const newlyDark = id === 'dark' || (id === 'system' && isSystemDark);
            const d = defaults(newlyDark);
            
            // Built up-front (not inside a setState updater) so the backend sync below gets it
            const nextConfig = {
              ...config,
              bgColor: d.bgColor,
              sidebarColor: d.sidebarColor,
              cardColor: d.cardColor,
              headingColor: d.headingColor,
              textColor: d.textColor,
              enableColors: false
            };
            setConfig(nextConfig);
            applyToDOM(nextConfig);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(nextConfig));
            } catch(e) {}
            window.dispatchEvent(new Event('storage'));
            
            // Silently sync to backend to prevent fetchProfile from reverting this on browser reload
            fetch("/api/settings/theme", {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
              },
              body: JSON.stringify({ ...nextConfig, logoImage: logoPreview })
            }).catch(() => {});

            setShowCustomPicker(false);
          }} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all duration-200 ${theme === id && !config.enableColors ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30' : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
            {icon} {label}
          </button>
        ))}
        {/* 4th mode: your own saved themes */}
        <button type="button" onClick={() => setShowCustomPicker(v => !v)} aria-expanded={showCustomPicker}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all duration-200 ${config.enableColors ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30' : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
          <PaletteIcon sx={{ fontSize: 18 }} /> Custom
          <ExpandMoreIcon sx={{ fontSize: 16 }} className={`transition-transform ${showCustomPicker ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {showCustomPicker && (
        <div className={`-mt-4 p-4 rounded-2xl border space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="space-y-2">
            <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Your custom themes</p>
            {savedThemes.length === 0 ? (
              <p className="text-xs text-slate-500">
                No custom themes yet — design a look below, then save it under <b>My Themes</b>.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {savedThemes.map(t => {
                  const active = JSON.stringify(pickTheme(t.config)) === JSON.stringify(pickTheme(config));
                  return (
                    <button type="button" key={t.id} onClick={() => applyCustomTheme(t.config)}
                      className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-xl border text-xs font-black transition-all hover:scale-[1.03]
                        ${active ? 'border-indigo-500 ring-2 ring-indigo-500/30' : isDark ? 'border-slate-700 text-slate-200' : 'border-slate-200 text-slate-700'}`}>
                      <span className="flex -space-x-1">
                        {[t.config.bgColor, t.config.cardColor, t.config.primaryColor].map((c, i) => (
                          <span key={i} className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: c }} />
                        ))}
                      </span>
                      {t.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Presets</p>
            <div className="flex flex-wrap gap-2">
              {presets.map(p => (
                <button type="button" key={p.name} onClick={() => applyPreset(p)}
                  className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-xl border text-xs font-black transition-all hover:scale-[1.03] ${isDark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'}`}>
                  <span className="flex -space-x-1">
                    {[p.bg, p.card, p.primary].map((c, i) => (
                      <span key={i} className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: c }} />
                    ))}
                  </span>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={() => document.getElementById('my-themes')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black">
              + Save current look as a theme
            </button>
            {!config.enableColors && (
              <button type="button" onClick={() => applyFullConfig({ enableColors: true })}
                className={`px-3 py-2 rounded-xl border text-xs font-black ${isDark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'}`}>
                Use my custom colours
              </button>
            )}
          </div>
        </div>
      )}

      <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-200'} space-y-4`}>
        <h4 className={`text-xs font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Background Theme</h4>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <label className={`w-28 h-28 rounded-2xl border border-dashed flex items-center justify-center overflow-hidden relative shadow-sm cursor-pointer hover:opacity-80 transition-opacity group ${isDark ? 'border-slate-700 bg-slate-850' : 'border-slate-350 bg-white'}`}>
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            {logoPreview ? (
              <img src={logoPreview} alt="Background Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1">
                <CloudUploadIcon className="text-slate-400 group-hover:text-indigo-500 transition-colors" sx={{ fontSize: 24 }} />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center px-2 group-hover:text-indigo-500 transition-colors">Upload</span>
              </div>
            )}
          </label>
          <div className="space-y-3 flex-grow text-center sm:text-left">
            <div>
              <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Custom Background Image</p>
              <p className="text-xs text-slate-500 font-medium">Click the preview box to upload a custom background for your dashboard and settings pages.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fit</label>
                <select value={config.bgFit} onChange={(e) => set('bgFit')(e.target.value)}
                  className={`w-full px-2 py-2 rounded-xl border text-xs font-bold outline-none ${isDark ? 'bg-slate-800 text-slate-300 border-slate-600' : 'bg-white text-slate-700 border-slate-200'}`}>
                  <option value="cover">Fill screen</option>
                  <option value="contain">Fit whole image</option>
                  <option value="auto">Tile / repeat</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Position</label>
                <select value={config.bgPosition} onChange={(e) => set('bgPosition')(e.target.value)}
                  className={`w-full px-2 py-2 rounded-xl border text-xs font-bold outline-none ${isDark ? 'bg-slate-800 text-slate-300 border-slate-600' : 'bg-white text-slate-700 border-slate-200'}`}>
                  {['center', 'top', 'bottom', 'left', 'right'].map(p => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Darken {config.bgDim}%</label>
                <input type="range" min="0" max="80" step="5" value={config.bgDim}
                  onChange={(e) => set('bgDim')(Number(e.target.value))} className="w-full accent-indigo-600" />
              </div>
            </div>
            <div className="flex justify-center sm:justify-start gap-3">
              {logoPreview && (
                <button 
                  type="button" 
                  onClick={async () => {
                    setLogoPreview(null);
                    fetch("/api/settings/theme", {
                      method: "PUT",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + token
                      },
                      body: JSON.stringify({ ...config, logoImage: "" })
                    }).catch(() => {});
                  }} 
                  className={`px-4 py-2 border text-xs font-black rounded-lg flex items-center gap-1.5 transition-all active:scale-95 ${isDark ? 'border-slate-700 text-red-400 hover:bg-slate-800' : 'border-slate-200 text-red-500 hover:bg-red-50'}`}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-[2px] rounded-2xl bg-gradient-to-tr from-indigo-500/40 to-purple-500/40">
        <div className="p-5 rounded-[calc(1rem-2px)] flex flex-col gap-4 transition-colors duration-300" style={{ backgroundColor: config.enableColors ? config.bgColor : undefined, fontFamily: config.enableFontFamily ? cssFontStack(config.fontFamily) : undefined, fontSize: config.fontSize, lineHeight: config.lineHeight, letterSpacing: config.letterSpacing, fontWeight: config.fontWeight }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {logoPreview ? (
                <div className="w-8 h-8 rounded-md overflow-hidden border border-black/10">
                  <img src={logoPreview} alt="Background Preview" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded bg-indigo-500/10 flex items-center justify-center font-bold text-indigo-500 text-sm">T</div>
              )}
              <div>
                <h4 className="font-black text-base" style={{ color: config.enableColors ? config.headingColor : undefined }}>Live Preview</h4>
                <p className="text-xs mt-0.5" style={{ color: config.enableColors ? config.textColor : undefined }}>Your workspace will look like this.</p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: config.enableColors ? `${config.primaryColor}25` : undefined, color: config.enableColors ? config.primaryColor : undefined }}>
              <CheckCircleIcon sx={{ fontSize: 18 }} />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" className="px-4 py-2 text-xs font-bold shadow-sm" style={{ backgroundColor: config.enableColors ? config.buttonBgColor : undefined, color: config.enableColors ? config.buttonTextColor : undefined, borderRadius: config.enableBorderRadius ? config.borderRadius : undefined }}>
              Primary Button
            </button>
            <button type="button" className="px-4 py-2 text-xs font-bold shadow-sm border border-black/5" style={{ backgroundColor: config.enableColors ? config.cardColor : undefined, color: config.enableColors ? config.textColor : undefined, borderRadius: config.enableBorderRadius ? config.borderRadius : undefined }}>
              Secondary
            </button>
          </div>
        </div>
      </div>

      <div id="my-themes" className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
        <CustomThemes config={config} onApply={applyCustomTheme} isDark={isDark} />
      </div>

      <div className="space-y-3">
        <h4 className={`text-xs font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Quick Presets</h4>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {presets.map(preset => (
            <button type="button" key={preset.name} onClick={() => applyPreset(preset)} title={preset.name} className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all hover:scale-105 hover:shadow-md ${isDark ? 'bg-slate-800/60 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-200 hover:border-indigo-300'}`}>
              <div className="w-7 h-7 rounded-full shadow-sm border-2 border-white/20" style={{ backgroundColor: preset.primary }} />
              <span className="text-[9px] font-black tracking-wide" style={{ color: isDark ? '#94a3b8' : '#6b7280' }}>{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`p-5 rounded-2xl border space-y-5 ${isDark ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
          <h4 className={`text-xs font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Typography &amp; Shape</h4>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Font Styles</label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={config.enableFontFamily} onChange={(e) => set('enableFontFamily')(e.target.checked)} />
                <div className="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
            <SearchableSelect 
              value={config.fontFamily} 
              disabled={!config.enableFontFamily} 
              onChange={(val) => set('fontFamily')(val)} 
              isDark={isDark} 
              placeholder="Select font..."
              options={fontOptions.map(f => ({ value: f.family, label: f.label || f.family }))}
              renderOption={(opt) => ({ fontFamily: `"${opt.value}", sans-serif` })}
              limit={120}
              onOptionsShown={(opts) => opts.forEach(o => loadFontPreview(o.value))}
            />
            {fontOptions.length === 0 && (
              <p className="text-[10px] text-amber-500 font-bold ml-1">Font list unavailable — is the backend running with GOOGLE_FONTS_API_KEY set?</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Font Size</label>
            <SearchableSelect 
              value={config.fontSize} 
              onChange={(val) => set('fontSize')(val)} 
              isDark={isDark}
              placeholder="Select size..."
              options={Array.from({ length: 98 }, (_, i) => i + 3).map(size => ({ value: `${size}px`, label: `${size}px` }))}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'fontWeight', label: 'Text Weight', options: [['300', 'Light'], ['400', 'Regular'], ['500', 'Medium'], ['600', 'Semi-bold'], ['700', 'Bold']] },
              { key: 'lineHeight', label: 'Line Height', options: [['1.25', 'Tight'], ['1.5', 'Normal'], ['1.75', 'Relaxed'], ['2', 'Loose']] },
              { key: 'letterSpacing', label: 'Letter Spacing', options: [['-0.02em', 'Tight'], ['0em', 'Normal'], ['0.03em', 'Wide'], ['0.08em', 'Wider']] },
            ].map(({ key, label, options }) => (
              <div key={key} className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
                <select value={config[key]} onChange={(e) => set(key)(e.target.value)}
                  className={`w-full px-2 py-2.5 rounded-xl border text-xs font-bold outline-none ${isDark ? 'bg-slate-800 text-slate-300 border-slate-600' : 'bg-white text-slate-700 border-slate-200'}`}>
                  {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">UI Rounding</label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={config.enableBorderRadius} onChange={(e) => set('enableBorderRadius')(e.target.checked)} />
                <div className="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
            <div className={`grid grid-cols-2 gap-2 ${!config.enableBorderRadius ? 'opacity-50 pointer-events-none' : ''}`}>
              {[
                { label: 'None', value: '0px' }, { label: 'Extra Sharp', value: '0.125rem' },
                { label: 'Sharp', value: '0.25rem' }, { label: 'Sleek', value: '0.5rem' },
                { label: 'Rounded', value: '0.75rem' }, { label: 'Soft', value: '1.25rem' },
                { label: 'Extra Soft', value: '1.75rem' }, { label: 'Pill', value: '9999px' },
              ].map(r => (
                <button type="button" key={r.value} onClick={() => set('borderRadius')(r.value)} className={`py-2 rounded-xl text-[10px] font-black border transition-all ${config.borderRadius === r.value ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : isDark ? 'border-slate-700 text-slate-400 hover:bg-slate-700' : 'border-slate-200 text-slate-500 hover:bg-white'}`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`p-5 rounded-2xl border space-y-5 ${isDark ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <h4 className={`text-xs font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Color Mapping</h4>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={config.enableColors} onChange={(e) => set('enableColors')(e.target.checked)} />
              <div className="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className={`space-y-3 ${!config.enableColors ? 'opacity-50 pointer-events-none' : ''}`}>
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b border-indigo-500/20 pb-1">Core &amp; Surfaces</p>
            <div className="grid grid-cols-2 gap-3">
              <ColorInput label="Brand Primary" value={config.primaryColor} onChange={set('primaryColor')} isDark={isDark} />
              <ColorInput label="Background" value={config.bgColor} onChange={set('bgColor')} isDark={isDark} />
              <ColorInput label="Sidebar" value={config.sidebarColor} onChange={set('sidebarColor')} isDark={isDark} />
              <ColorInput label="Cards" value={config.cardColor} onChange={set('cardColor')} isDark={isDark} />
            </div>
          </div>

          <div className={`space-y-3 ${!config.enableColors ? 'opacity-50 pointer-events-none' : ''}`}>
            <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest border-b border-purple-500/20 pb-1">Text &amp; Buttons</p>
            <div className="grid grid-cols-2 gap-3">
              <ColorInput label="Headings" value={config.headingColor} onChange={set('headingColor')} isDark={isDark} />
              <ColorInput label="Body Text" value={config.textColor} onChange={set('textColor')} isDark={isDark} />
              <ColorInput label="Button BG" value={config.buttonBgColor} onChange={set('buttonBgColor')} isDark={isDark} />
              <ColorInput label="Button Text" value={config.buttonTextColor} onChange={set('buttonTextColor')} isDark={isDark} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

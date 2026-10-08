import React, { useState, useEffect, useRef } from "react";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import PersonIcon from "@mui/icons-material/Person";
import EmailIcon from "@mui/icons-material/Email";
import LogoutIcon from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";
import PhoneIcon from "@mui/icons-material/Phone";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import SettingsBrightnessIcon from "@mui/icons-material/SettingsBrightness";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import PaletteIcon from "@mui/icons-material/Palette";
import CheckIcon from "@mui/icons-material/Check";
import { applyThemeModeSwitch, applySavedTheme, presetToConfig, THEME_PRESETS } from "../utils/themeMode";
import { loadThemes, pickTheme } from "./settings/CustomThemes";
import TranslateIcon from "@mui/icons-material/Translate";
import { useI18n } from "../i18n/I18nContext";
import { UI_LANGUAGES } from "../i18n/languages";
import { loadSoundSettings, saveSoundSettings, previewTone } from "../utils/sound";

const THEME_CYCLE = ["light", "dark", "system"];
const THEME_META = {
  light: { icon: LightModeIcon, label: "Light mode" },
  dark: { icon: DarkModeIcon, label: "Dark mode" },
  system: { icon: SettingsBrightnessIcon, label: "System theme" },
};

const greetingKey = (hour) => (hour < 5 ? "greet.night" : hour < 12 ? "greet.morning" : hour < 17 ? "greet.afternoon" : "greet.evening");

export default function Header({ user, setToken, searchQuery, setSearchQuery, onEditProfile, onOpenSettings, onGoHome, theme, setTheme, isSystemDark }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);
  const { t, uiLang, setUiLanguage } = useI18n();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const langMenuRef = useRef(null);
  useEffect(() => {
    const closeOutside = (e) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target)) setShowLangMenu(false);
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, []);
  const isDark = theme === "dark" || (theme === "system" && isSystemDark);
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Ctrl/⌘+K focuses search; Escape closes the profile menu
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === "Escape") {
        setShowDropdown(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Live Clock
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Date in the chosen language (e.g. "गुरु, 8 अक्टू॰ 2026"); time digits stay Latin for the mono clock
  const formattedDate = currentTime.toLocaleDateString(uiLang.code === "en" ? "en-GB" : uiLang.code, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const hhmm = currentTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const seconds = String(currentTime.getSeconds()).padStart(2, "0");
  const firstName = (user?.name || "").trim().split(/\s+/)[0];

  // Theme menu: Light / Dark / System + saved custom themes + presets
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const themeMenuRef = useRef(null);
  const readThemeState = () => {
    let cfg = {};
    try { cfg = JSON.parse(localStorage.getItem("todo_theme_config") || "{}") || {}; } catch { cfg = {}; }
    return {
      customActive: localStorage.getItem("custom_theme_active") === "true" && !!cfg.enableColors,
      current: JSON.stringify(pickTheme(cfg)),
      themes: loadThemes(),
    };
  };
  const [themeState, setThemeState] = useState(readThemeState);
  useEffect(() => {
    const sync = () => setThemeState(readThemeState());
    window.addEventListener("storage", sync);
    window.addEventListener("custom-themes-changed", sync);
    const closeOutside = (e) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target)) setShowThemeMenu(false);
    };
    document.addEventListener("mousedown", closeOutside);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("custom-themes-changed", sync);
      document.removeEventListener("mousedown", closeOutside);
    };
  }, []);

  const ThemeIcon = themeState.customActive ? PaletteIcon : (THEME_META[theme]?.icon || SettingsBrightnessIcon);
  const pickMode = (mode) => {
    applyThemeModeSwitch(mode, isSystemDark); // also turns custom colours off
    setTheme(mode);
    setShowThemeMenu(false);
  };
  const pickCustom = (cfg) => {
    const { mode } = applySavedTheme(cfg);
    setTheme(mode);
    setShowThemeMenu(false);
  };
  const manageThemes = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "theme");
    window.history.replaceState({}, "", url);
    setShowThemeMenu(false);
    onOpenSettings();
  };

  const [soundOn, setSoundOn] = useState(() => loadSoundSettings().enabled);
  useEffect(() => {
    const sync = () => setSoundOn(loadSoundSettings().enabled);
    window.addEventListener("sound-settings-changed", sync);
    return () => window.removeEventListener("sound-settings-changed", sync);
  }, []);
  const toggleSound = () => {
    const s = loadSoundSettings();
    const next = { ...s, enabled: !s.enabled };
    saveSoundSettings(next);
    setSoundOn(next.enabled);
    if (next.enabled) previewTone(next.tone, next); // audible confirmation
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };

  const iconBtn = `w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-200 active:scale-95
    ${isDark
      ? "bg-slate-800/40 border-slate-700/50 text-slate-300 hover:bg-slate-800 hover:text-white"
      : "bg-white/60 border-slate-200/60 text-slate-600 hover:bg-white hover:text-indigo-600"}`;

  return (
    <header className={`sticky top-0 z-50 px-4 sm:px-6 py-3 rounded-b-3xl shadow-xl backdrop-blur-xl border-b border-x transition-all duration-500
      flex flex-wrap md:flex-nowrap items-center gap-x-4 gap-y-3
      ${isDark
        ? "bg-slate-900/75 text-white border-slate-800 shadow-black/40"
        : "bg-white/75 text-slate-900 border-slate-100 shadow-slate-200/50"}`}>

      {/* Logo + greeting */}
      <button
        onClick={onGoHome}
        className="flex items-center gap-3 cursor-pointer group/logo text-left outline-none shrink-0"
        aria-label="Go to dashboard"
      >
        <div className="bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-500/20 flex items-center justify-center transform group-hover/logo:scale-105 transition-all duration-300 group-active/logo:scale-95">
          <FactCheckIcon className="text-white" sx={{ fontSize: 24 }} />
        </div>
        <div className="flex flex-col leading-none">
          <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent tracking-tighter">
            Todo Pro
          </h1>
          <span className={`hidden sm:block text-[11px] font-bold mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            {t(greetingKey(currentTime.getHours()))}{firstName ? `, ${firstName}` : ""} 👋
          </span>
        </div>
      </button>

      {/* Search — full-width second row on phones */}
      <div className="order-last md:order-none w-full md:w-auto md:flex-1 md:max-w-xl md:mx-auto">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <SearchIcon className={`transition-colors duration-300 ${isDark ? 'text-slate-500 group-focus-within:text-indigo-400' : 'text-slate-400 group-focus-within:text-indigo-600'}`} sx={{ fontSize: 20 }} />
          </div>
          <input
            ref={searchRef}
            type="search"
            aria-label="Search tasks"
            placeholder={t("app.search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { setSearchQuery(""); e.currentTarget.blur(); } }}
            className={`w-full rounded-2xl py-2.5 pl-12 pr-20 text-sm font-semibold transition-all duration-300 focus:ring-4 border outline-none [&::-webkit-search-cancel-button]:hidden
              ${isDark
                ? 'bg-slate-800/40 text-slate-100 placeholder:text-slate-500 focus:ring-indigo-500/20 focus:bg-slate-800 border-slate-700/50 focus:border-indigo-500/50'
                : 'bg-slate-100/50 text-slate-700 placeholder:text-slate-400 focus:ring-indigo-500/10 focus:bg-white border-slate-200/60 focus:border-indigo-500/50'
              }`}
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1">
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="p-1 rounded-lg text-slate-400 hover:text-indigo-500 transition-colors"
              >
                <ClearIcon sx={{ fontSize: 18 }} />
              </button>
            ) : (
              <kbd className={`hidden md:inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-black font-mono
                ${isDark ? "border-slate-700 text-slate-500 bg-slate-800/60" : "border-slate-200 text-slate-400 bg-white"}`}>
                {isMac ? "⌘" : "Ctrl"} K
              </kbd>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 ml-auto md:ml-0 shrink-0">
        {/* Compact live clock */}
        <div className={`hidden lg:flex items-center gap-3 h-10 px-4 rounded-xl border transition-all duration-500
          ${isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white/60 border-slate-200/60'}`}
          title={currentTime.toLocaleString()}>
          <span className={`text-xs font-bold tracking-wide ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            {formattedDate}
          </span>
          <span className={`w-px h-4 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
          <span className={`text-sm font-black font-mono tabular-nums ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
            {hhmm}<span className="opacity-50 text-xs">:{seconds}</span>
          </span>
        </div>

        {/* Quick toggles */}
        <div className="relative" ref={themeMenuRef}>
          <button type="button" onClick={() => setShowThemeMenu(v => !v)} className={`${iconBtn} ${showThemeMenu ? "ring-4 ring-indigo-500/20 border-indigo-500/40" : ""}`}
            title={t("header.theme")} aria-label={t("header.theme")} aria-haspopup="menu" aria-expanded={showThemeMenu}>
            <ThemeIcon sx={{ fontSize: 20 }} className={themeState.customActive ? "text-indigo-400" : ""} />
          </button>

          {showThemeMenu && (
            <div role="menu" className={`absolute right-0 mt-3 w-72 max-h-[70vh] overflow-y-auto rounded-2xl border shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200
              ${isDark ? "bg-slate-900/95 backdrop-blur-2xl border-slate-800 text-white" : "bg-white/95 backdrop-blur-2xl border-slate-100 text-slate-900"}`}>
              {/* Modes */}
              <div className={`grid grid-cols-3 gap-1 p-1 rounded-xl ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                {THEME_CYCLE.map(mode => {
                  const Icon = THEME_META[mode].icon;
                  const active = theme === mode && !themeState.customActive;
                  return (
                    <button key={mode} type="button" role="menuitemradio" aria-checked={active} onClick={() => pickMode(mode)}
                      className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-[10px] font-black transition-all
                        ${active ? "bg-indigo-600 text-white shadow" : isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-800"}`}>
                      <Icon sx={{ fontSize: 18 }} />
                      {mode[0].toUpperCase() + mode.slice(1)}
                    </button>
                  );
                })}
              </div>

              {/* Saved custom themes */}
              <p className={`mt-3 mb-1 px-1 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                <PaletteIcon sx={{ fontSize: 12 }} /> Custom themes
              </p>
              {themeState.themes.length === 0 ? (
                <p className={`px-1 text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>None saved yet.</p>
              ) : (
                themeState.themes.map(t => {
                  const active = themeState.customActive && JSON.stringify(pickTheme(t.config)) === themeState.current;
                  return (
                    <button key={t.id} type="button" role="menuitemradio" aria-checked={active} onClick={() => pickCustom(t.config)}
                      className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-xs font-bold text-left transition-colors
                        ${active ? "bg-indigo-500/10" : isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}>
                      <span className="flex -space-x-1 shrink-0">
                        {[t.config.bgColor, t.config.cardColor, t.config.primaryColor].map((c, i) => (
                          <span key={i} className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: c }} />
                        ))}
                      </span>
                      <span className="flex-1 truncate">{t.name}</span>
                      {active && <CheckIcon sx={{ fontSize: 14 }} className="text-indigo-500" />}
                    </button>
                  );
                })
              )}

              {/* Presets */}
              <p className={`mt-3 mb-1 px-1 text-[10px] font-black uppercase tracking-widest ${isDark ? "text-slate-400" : "text-slate-500"}`}>Presets</p>
              <div className="grid grid-cols-4 gap-1.5">
                {THEME_PRESETS.map(p => {
                  const active = themeState.customActive && JSON.stringify(pickTheme({ ...JSON.parse(themeState.current || "{}"), ...presetToConfig(p) })) === themeState.current;
                  return (
                    <button key={p.name} type="button" title={p.name} onClick={() => pickCustom(presetToConfig(p))}
                      className={`flex flex-col items-center gap-1 py-1.5 rounded-lg text-[9px] font-black transition-colors
                        ${active ? "bg-indigo-500/10 text-indigo-500" : isDark ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"}`}>
                      <span className="w-6 h-6 rounded-full border-2 border-white/30 shadow-sm"
                        style={{ background: `linear-gradient(135deg, ${p.bg} 50%, ${p.primary} 50%)` }} />
                      {p.name}
                    </button>
                  );
                })}
              </div>

              <button type="button" onClick={manageThemes}
                className={`mt-3 w-full py-2 rounded-xl text-xs font-black border transition-colors
                  ${isDark ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                Create / manage themes…
              </button>
            </div>
          )}
        </div>
        {/* Language picker */}
        <div className="relative" ref={langMenuRef}>
          <button type="button" onClick={() => setShowLangMenu(v => !v)}
            className={`${iconBtn} !w-auto px-2.5 gap-1 ${showLangMenu ? "ring-4 ring-indigo-500/20 border-indigo-500/40" : ""}`}
            title={t("header.language")} aria-label={t("header.language")} aria-haspopup="menu" aria-expanded={showLangMenu}>
            <TranslateIcon sx={{ fontSize: 18 }} />
            <span className="text-[11px] font-black uppercase">{uiLang.code}</span>
          </button>
          {showLangMenu && (
            <div role="menu" className={`absolute right-0 mt-3 w-56 max-h-[70vh] overflow-y-auto rounded-2xl border shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200
              ${isDark ? "bg-slate-900/95 backdrop-blur-2xl border-slate-800 text-white" : "bg-white/95 backdrop-blur-2xl border-slate-100 text-slate-900"}`}>
              {UI_LANGUAGES.map(l => (
                <button key={l.code} type="button" role="menuitemradio" aria-checked={uiLang.code === l.code}
                  onClick={() => { setUiLanguage(l.code); setShowLangMenu(false); }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm font-bold text-left transition-colors
                    ${uiLang.code === l.code ? "bg-indigo-500/10 text-indigo-500" : isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}>
                  <span lang={l.code} dir={l.dir}>{l.name}</span>
                  <span className="text-[10px] font-bold text-slate-400">{l.english}</span>
                </button>
              ))}
              <button type="button" onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set("tab", "language");
                  window.history.replaceState({}, "", url);
                  setShowLangMenu(false);
                  onOpenSettings();
                }}
                className={`mt-1 w-full py-2 rounded-xl text-xs font-black border ${isDark ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                ⌨ {t("lang.typing")}…
              </button>
            </div>
          )}
        </div>

        <button type="button" onClick={toggleSound} className={iconBtn}
          title={soundOn ? t("header.soundOn") : t("header.soundOff")}
          aria-label={soundOn ? "Mute notification sounds" : "Unmute notification sounds"} aria-pressed={!soundOn}>
          {soundOn ? <VolumeUpIcon sx={{ fontSize: 20 }} /> : <VolumeOffIcon sx={{ fontSize: 20 }} className="text-rose-500" />}
        </button>
        <button type="button" onClick={onOpenSettings} className={`${iconBtn} hidden sm:flex`} title={t("header.settings")} aria-label={t("header.settings")}>
          <SettingsIcon sx={{ fontSize: 20 }} />
        </button>

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          aria-haspopup="menu"
          aria-expanded={showDropdown}
          className={`group flex items-center gap-2 p-1 pr-1 lg:pr-2 rounded-2xl border transition-all duration-300
            ${showDropdown
              ? "bg-indigo-500/10 border-indigo-500/30 ring-4 ring-indigo-500/15"
              : isDark ? "border-transparent hover:bg-slate-800/60" : "border-transparent hover:bg-slate-100/80"}`}
        >
          <div className="relative">
            {user?.profileImage && !user.profileImage.startsWith('blob:') ? (
              <img
                src={user.profileImage}
                alt="Profile"
                className="w-10 h-10 rounded-xl object-cover shadow-md border-2 border-indigo-500/30"
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-md">
                <PersonIcon />
              </div>
            )}
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 ${isDark ? "border-slate-900" : "border-white"}`} title="Online" />
          </div>

          <div className="hidden lg:flex flex-col items-start justify-center max-w-[130px]">
            <span className={`text-xs font-black truncate w-full tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
              {user?.name || "Member"}
            </span>
            <span className={`text-[10px] font-bold truncate w-full ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {user?.username ? `@${user.username}` : user?.email || ""}
            </span>
          </div>
          <KeyboardArrowDownIcon sx={{ fontSize: 18 }}
            className={`hidden lg:block transition-transform duration-300 ${showDropdown ? "rotate-180" : ""} ${isDark ? "text-slate-400" : "text-slate-500"}`} />
        </button>

        {showDropdown && (
          <div className={`absolute right-0 mt-4 w-80 rounded-[2.5rem] shadow-2xl border p-6 z-50 transform origin-top-right transition-all animate-in fade-in zoom-in slide-in-from-top-4 duration-300
            ${theme === "dark" || (theme === 'system' && isSystemDark)
              ? "bg-slate-900/95 backdrop-blur-2xl border-slate-800 text-white"
              : "bg-white/95 backdrop-blur-2xl border-slate-100 text-slate-900"
            }`}>
            
            {/* User Info Header - Always Visible */}
            <div className="flex flex-col items-center pb-4">
              <div className="relative group/avatar">
                <div className="absolute -inset-1 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-full blur opacity-25 group-hover/avatar:opacity-50 transition duration-300"></div>
                <div className="relative w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-700 shadow-2xl overflow-hidden">
                  {user?.profileImage && !user.profileImage.startsWith('blob:') ? (
                    <img src={user.profileImage} alt="Avatar" className="w-full h-full object-cover transform group-hover/avatar:scale-110 transition duration-500" />
                  ) : (
                    <AccountCircleIcon className="text-indigo-500" sx={{ fontSize: 60 }} />
                  )}
                </div>
              </div>
              <h3 className="mt-3 font-black text-xl tracking-tighter">
                {user?.name || "Member"}
              </h3>
              <p className="bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent font-bold text-xs">
                @{user?.username || "username"}
              </p>
            </div>

            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-4">
                  <div className="flex items-center gap-4 px-2 group/item">
                    <div className="w-8 h-8 bg-indigo-500/10 rounded-xl flex items-center justify-center group-hover/item:bg-indigo-500/20 transition-colors">
                      <EmailIcon className="text-indigo-500" sx={{ fontSize: 16 }} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[9px] tracking-widest text-slate-400 font-black">Email Address</span>
                      <span className="text-xs font-bold truncate opacity-80">{user?.email}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 px-2 group/item">
                    <div className="w-8 h-8 bg-purple-500/10 rounded-xl flex items-center justify-center group-hover/item:bg-purple-500/20 transition-colors">
                      <PhoneIcon className="text-purple-500" sx={{ fontSize: 16 }} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[9px] tracking-widest text-slate-400 font-black">Phone Number</span>
                      <span className="text-xs font-bold truncate opacity-80">{user?.mobile || "Not provided"}</span>
                    </div>
                  </div>
                </div>

              <div className="flex justify-center pt-2">
                <button 
                  onClick={() => {
                    setShowDropdown(false);
                    onOpenSettings();
                  }}
                  className={`w-full flex items-center justify-center gap-2 text-sm font-black py-3 rounded-xl transition-all border text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-transparent hover:border-slate-200 dark:hover:border-slate-700`}
                >
                  <SettingsIcon sx={{ fontSize: 20 }} /> {t("header.settings")}
                </button>
              </div>
                <div className="flex flex-row gap-2 pt-2">
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      onEditProfile();
                    }}
                    className="flex-1 flex items-center justify-center gap-1 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:shadow-lg hover:shadow-indigo-500/30 active:scale-[0.98] transition-all font-black text-xs"
                  >
                    <PersonIcon sx={{ fontSize: 16 }} /> Edit
                  </button>

                  <button
                    onClick={handleLogout}
                    className={`flex-1 flex items-center justify-center gap-1 py-3 rounded-xl active:scale-[0.98] transition-all font-black text-xs border
                      ${theme === 'dark' || (theme === 'system' && isSystemDark)
                        ? 'bg-slate-800 text-red-400 border-slate-700 hover:bg-red-500/10'
                        : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'
                      }`}
                  >
                    <LogoutIcon sx={{ fontSize: 16 }} /> Logout
                  </button>
                </div>
              </div>


            
          </div>
        )}
      </div>
</div>
    </header>
  );
}
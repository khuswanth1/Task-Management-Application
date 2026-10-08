import React, { useState, useEffect, useCallback } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Create from "./pages/Create";
import { ensureFontLoaded, cssFontStack } from "./utils/googleFonts";
import { listenForPushSounds } from "./utils/sound";
import { applyTextAndBackgroundVars } from "./utils/themeMode";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Theme Management
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "system");
  const [isSystemDark, setIsSystemDark] = useState(window.matchMedia("(prefers-color-scheme: dark)").matches);

  const applyCustomThemeConfig = useCallback(() => {
    try {
      const saved = localStorage.getItem("todo_theme_config");
      const isActive = localStorage.getItem("custom_theme_active") === "true";
      const root = document.documentElement;
      // Background fit/position/darken + text spacing apply even without a custom colour theme
      applyTextAndBackgroundVars(saved ? JSON.parse(saved) : {});

      if (saved && isActive) {
        const cfg = JSON.parse(saved);
        if (cfg.primaryColor)    root.style.setProperty('--primary-color', cfg.primaryColor);
        if (cfg.bgColor)         root.style.setProperty('--bg-color', cfg.bgColor);
        if (cfg.sidebarColor)    root.style.setProperty('--sidebar-color', cfg.sidebarColor);
        if (cfg.cardColor)       root.style.setProperty('--card-color', cfg.cardColor);
        if (cfg.headingColor)    root.style.setProperty('--heading-color', cfg.headingColor);
        if (cfg.textColor)       root.style.setProperty('--text-color', cfg.textColor);
        if (cfg.buttonBgColor)   root.style.setProperty('--button-bg-color', cfg.buttonBgColor);
        if (cfg.buttonTextColor) root.style.setProperty('--button-text-color', cfg.buttonTextColor);
        if (cfg.fontSize)        root.style.setProperty('--base-font-size', cfg.fontSize);
        if (cfg.fontFamily) {
          root.style.setProperty('--font-family', cssFontStack(cfg.fontFamily));
          ensureFontLoaded(cfg.fontFamily);
        }
        if (cfg.borderRadius)    root.style.setProperty('--border-radius', cfg.borderRadius);
        
        root.classList.add('custom-theme');
        root.classList.toggle('theme-font-family', cfg.enableFontFamily ?? true);
        root.classList.toggle('theme-font-size', true);
        root.classList.toggle('theme-border-radius', cfg.enableBorderRadius ?? true);
        root.classList.toggle('theme-colors', cfg.enableColors ?? false);
      } else {
        root.classList.remove('custom-theme', 'theme-font-family', 'theme-font-size', 'theme-border-radius', 'theme-colors');
        root.style.removeProperty('--primary-color');
        root.style.removeProperty('--bg-color');
        root.style.removeProperty('--sidebar-color');
        root.style.removeProperty('--card-color');
        root.style.removeProperty('--heading-color');
        root.style.removeProperty('--text-color');
        root.style.removeProperty('--button-bg-color');
        root.style.removeProperty('--button-text-color');
        root.style.removeProperty('--base-font-size');
        root.style.removeProperty('--font-family');
        root.style.removeProperty('--border-radius');
      }
    } catch (e) {
      console.warn("Could not apply theme config:", e);
    }
  }, []);

  // Auto-play the chosen notification sound when a push arrives while the app is open
  useEffect(() => listenForPushSounds(), []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => setIsSystemDark(e.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      root.classList.toggle("dark", isSystemDark);
    }
    localStorage.setItem("theme", theme);
  }, [theme, isSystemDark]);

  useEffect(() => {
    const handleStorage = () => {
      setTheme(localStorage.getItem("theme") || "system");
      applyCustomThemeConfig();
    };
    window.addEventListener("storage", handleStorage);
    applyCustomThemeConfig();
    return () => window.removeEventListener("storage", handleStorage);
  }, [applyCustomThemeConfig]);

  const fetchProfile = useCallback(async (tk) => {
    try {
      const res = await fetch("/auth/profile", {
        headers: { Authorization: "Bearer " + tk }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        // Apply custom theme settings from DB if present
        if (data.primaryColor) {
          const root = document.documentElement;
          root.style.setProperty('--primary-color', data.primaryColor);
          root.style.setProperty('--bg-color', data.bgColor);
          root.style.setProperty('--sidebar-color', data.sidebarColor);
          root.style.setProperty('--card-color', data.cardColor);
          root.style.setProperty('--heading-color', data.headingColor);
          root.style.setProperty('--text-color', data.textColor);
          root.style.setProperty('--button-bg-color', data.buttonBgColor);
          root.style.setProperty('--button-text-color', data.buttonTextColor);
          root.style.setProperty('--base-font-size', data.fontSize || '16px');
          root.style.setProperty('--font-family', cssFontStack(data.fontFamily || 'Inter'));
          root.style.setProperty('--border-radius', data.borderRadius || '1rem');
          
          root.classList.add('custom-theme');
          root.classList.toggle('theme-font-family', data.enableFontFamily ?? true);
          root.classList.toggle('theme-font-size', true);
          root.classList.toggle('theme-border-radius', data.enableBorderRadius ?? true);
          root.classList.toggle('theme-colors', data.enableColors ?? false);
          
          ensureFontLoaded(data.fontFamily);
        } else {
          document.documentElement.classList.remove('custom-theme', 'theme-font-family', 'theme-font-size', 'theme-border-radius', 'theme-colors');
        }
      } else {
        const errData = await res.json();
        console.error("Profile fetch rejected:", errData.error);
        localStorage.removeItem("token");
        setToken(null);
      }
    } catch (err) {
      console.error("Network error fetching profile", err);
      localStorage.removeItem("token");
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get("token");
    if (urlToken) {
      localStorage.setItem("token", urlToken);
      setToken(urlToken);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchProfile(token);
    } else {
      setLoading(false);
    }
  }, [token, fetchProfile]);

  const onProfileUpdate = useCallback(() => fetchProfile(token), [fetchProfile, token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold">Loading...</div>;

  if (!token) return <Login setToken={setToken} theme={theme} isSystemDark={isSystemDark} />;

  // ✅ If user is logged in but has no mobile number, redirect to Create page to fill profile
  if (user && !user.mobile) {
    return <Create token={token} user={user} setToken={setToken} onComplete={onProfileUpdate} theme={theme} isSystemDark={isSystemDark} />;
  }

  return <Dashboard token={token} setToken={setToken} theme={theme} setTheme={setTheme} isSystemDark={isSystemDark} user={user} onProfileUpdate={onProfileUpdate} />;
}
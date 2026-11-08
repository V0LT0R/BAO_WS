import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from '../public/translations.js';

const SiteContext = createContext(null);

export function SiteProvider({ children }) {
  // The initial render is deterministic so prerendered pages hydrate without a mismatch.
  const [language, updateLanguage] = useState('en');
  const [theme, updateTheme] = useState('auto');
  const [systemTheme, setSystemTheme] = useState('dark');

  useEffect(() => {
    try {
      const savedLanguage = localStorage.getItem('language');
      const savedTheme = localStorage.getItem('color-scheme');
      if (['en', 'ua'].includes(savedLanguage)) updateLanguage(savedLanguage);
      if (['light', 'dark', 'auto'].includes(savedTheme)) updateTheme(savedTheme);
    } catch { /* Preferences are optional when storage is disabled. */ }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemTheme(media.matches ? 'dark' : 'light');
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === 'ua' ? 'uk' : 'en';
  }, [language]);

  useEffect(() => {
    for (const scheme of ['light', 'dark']) {
      const links = document.querySelectorAll(`link[data-theme="${scheme}"], #theme-${scheme}`);
      links.forEach(link => {
        link.media = theme === 'auto' ? `(prefers-color-scheme: ${scheme})` : theme === scheme ? 'all' : 'not all';
      });
    }
  }, [theme]);

  function setLanguage(value) {
    if (!['en', 'ua'].includes(value)) return;
    updateLanguage(value);
    try { localStorage.setItem('language', value); } catch { /* Optional preference. */ }
  }

  function setTheme(value) {
    if (!['light', 'dark', 'auto'].includes(value)) return;
    updateTheme(value);
    try { localStorage.setItem('color-scheme', value); } catch { /* Optional preference. */ }
  }

  const value = useMemo(() => ({
    language, setLanguage, theme, setTheme,
    effectiveTheme: theme === 'auto' ? systemTheme : theme,
    t: key => translations[language][key] ?? translations.en[key] ?? key,
  }), [language, theme, systemTheme]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  const value = useContext(SiteContext);
  if (!value) throw new Error('useSite must be used inside SiteProvider');
  return value;
}

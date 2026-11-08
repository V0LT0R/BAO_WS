import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from '../public/translations.js';
import { languages, languageCode } from '../lib/locales.js';

const SiteContext = createContext(null);

export function SiteProvider({ children, initialLanguage = 'en', allowLanguagePreference = false }) {
  // The initial render is deterministic so prerendered pages hydrate without a mismatch.
  const [preferredLanguage, updatePreferredLanguage] = useState('en');
  const language = allowLanguagePreference ? preferredLanguage : languages.includes(initialLanguage) ? initialLanguage : 'en';
  const [theme, updateTheme] = useState('auto');
  const [systemTheme, setSystemTheme] = useState('dark');

  useEffect(() => {
    if (!allowLanguagePreference) return;
    try {
      const savedLanguage = localStorage.getItem('language');
      if (['en', 'ua'].includes(savedLanguage)) updatePreferredLanguage(savedLanguage);
    } catch { /* Account language preferences are optional when storage is disabled. */ }
  }, [allowLanguagePreference]);

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('color-scheme');
      if (['light', 'dark', 'auto'].includes(savedTheme)) updateTheme(savedTheme);
    } catch { /* Preferences are optional when storage is disabled. */ }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemTheme(media.matches ? 'dark' : 'light');
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.lang = languageCode(language);
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
    if (!allowLanguagePreference || !['en', 'ua'].includes(value)) return;
    updatePreferredLanguage(value);
    try { localStorage.setItem('language', value); } catch { /* Optional account preference. */ }
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
  }), [language, theme, systemTheme, allowLanguagePreference]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  const value = useContext(SiteContext);
  if (!value) throw new Error('useSite must be used inside SiteProvider');
  return value;
}

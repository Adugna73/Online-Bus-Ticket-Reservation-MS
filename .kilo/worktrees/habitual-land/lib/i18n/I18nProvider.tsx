"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from "react";
import { Locale, defaultLocale, getDict, resolve, Dict } from "./index";

const STORAGE_KEY = "app.locale";

type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  dict: Dict;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (stored && ["en", "am", "om"].includes(stored)) setLocaleState(stored);
    } catch {}
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  }, []);

  const dict = useMemo(() => getDict(locale), [locale]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => resolve(dict, key, vars),
    [dict],
  );

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t, dict }), [locale, setLocale, t, dict]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback so components used outside provider don't crash.
    const dict = getDict(defaultLocale);
    return {
      locale: defaultLocale,
      setLocale: () => {},
      t: (key, vars) => resolve(dict, key, vars),
      dict,
    };
  }
  return ctx;
}

export function useT() {
  return useI18n().t;
}

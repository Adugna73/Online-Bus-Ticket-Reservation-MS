import { en, type Dict } from "./locales/en";
import { am } from "./locales/am";
import { om } from "./locales/om";

export type Locale = "en" | "am" | "om";
export type { Dict };

export const locales: Locale[] = ["en", "am", "om"];
export const defaultLocale: Locale = "en";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  am: "አማርኛ",
  om: "Afaan Oromoo",
};

export const dictionaries: Record<Locale, Dict> = { en, am, om };

// Resolve a nested key like "nav.home" from a dictionary.
export function resolve(dict: Dict, key: string, vars?: Record<string, string | number>): string {
  const parts = key.split(".");
  let cur: any = dict;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) {
      cur = cur[p];
    } else {
      return key;
    }
  }
  if (typeof cur !== "string") return key;
  if (!vars) return cur;
  return cur.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function getDict(locale: Locale): Dict {
  return dictionaries[locale] || dictionaries[defaultLocale];
}

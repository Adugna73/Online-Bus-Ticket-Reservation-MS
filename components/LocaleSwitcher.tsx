"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { locales, localeLabels, Locale } from "@/lib/i18n";

export default function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n();
  return (
    <div className="inline-flex items-center gap-1">
      {locales.map((l: Locale) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
            locale === l
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-foreground border-border hover:bg-muted"
          }`}
          title={localeLabels[l]}
        >
          {compact ? l.toUpperCase() : localeLabels[l]}
        </button>
      ))}
    </div>
  );
}

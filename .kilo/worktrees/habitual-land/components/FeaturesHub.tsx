"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FEATURES, FeatureDef } from "@/lib/features/registry";
import { useI18n } from "@/lib/i18n/I18nProvider";

const PRIORITY_COLOR: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  low: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

const STATUS_COLOR: Record<string, string> = {
  stub: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  planned: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

export default function FeaturesHubPage() {
  const { t } = useI18n();
  const [features, setFeatures] = useState<FeatureDef[]>(FEATURES);

  useEffect(() => {
    fetch("/api/features")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.features)) setFeatures(d.features);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8 md:px-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold">{t("features.title")}</h1>
          <p className="text-muted-foreground mt-2">{t("features.subtitle")}</p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 border border-amber-300 dark:border-amber-700 rounded px-3 py-2 inline-block">
            {t("common.stubNotice")}
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <Link
              key={f.id}
              href={f.uiPath}
              className="block rounded-lg border border-border bg-card p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">#{f.number}</span>
                  <h2 className="font-semibold">{t(`${f.i18nKey}.name`)}</h2>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[f.status]}`}>
                  {t(`features.status.${f.status}`)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{t(`${f.i18nKey}.desc`)}</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {f.capabilities.slice(0, 4).map((c) => (
                  <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {c}
                  </span>
                ))}
                {f.capabilities.length > 4 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    +{f.capabilities.length - 4}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className={`px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[f.priority]}`}>
                  {f.priority.toUpperCase()}
                </span>
                <span className="text-muted-foreground">{f.impact}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { getFeature } from "@/lib/features/registry";

// Generic scaffolded stub page for a gap feature. Renders the localized name,
// description, capability list, a stub notice, and a "try API" button that
// exercises the feature's API endpoint so the wiring is verifiable.
export default function StubFeaturePage({ featureId }: { featureId: string }) {
  const { t } = useI18n();
  const feature = getFeature(featureId);
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  if (!feature) {
    return <div className="p-8">Unknown feature: {featureId}</div>;
  }

  const apiPrefix = feature.apiPrefix;

  async function tryApi() {
    setLoading(true);
    setResult("");
    try {
      const res = await fetch(apiPrefix, { method: "GET" });
      const text = await res.text();
      setResult(`GET ${apiPrefix} → ${res.status}\n${text.slice(0, 500)}`);
    } catch (e: any) {
      setResult(`Error: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8 md:px-8">
      <div className="max-w-3xl mx-auto">
        <a href="/features" className="text-sm text-muted-foreground hover:underline">← {t("nav.features")}</a>
        <h1 className="text-2xl md:text-3xl font-bold mt-3">
          <span className="text-muted-foreground font-mono text-base mr-2">#{feature.number}</span>
          {t(`${feature.i18nKey}.name`)}
        </h1>
        <p className="text-muted-foreground mt-2">{t(`${feature.i18nKey}.desc`)}</p>

        <div className="mt-4 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 rounded px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          {t("common.stubNotice")}
        </div>

        <section className="mt-6">
          <h2 className="font-semibold mb-2">Capabilities</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {feature.capabilities.map((c) => (
              <li key={c} className="text-sm flex items-center gap-2">
                <span className="text-emerald-500">✓</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6">
          <h2 className="font-semibold mb-2">API & Service</h2>
          <dl className="text-sm space-y-1">
            <div className="flex gap-2"><dt className="text-muted-foreground w-28">API:</dt><dd className="font-mono">{feature.apiPrefix}</dd></div>
            <div className="flex gap-2"><dt className="text-muted-foreground w-28">Service:</dt><dd className="font-mono">{feature.serviceModule}</dd></div>
            <div className="flex gap-2"><dt className="text-muted-foreground w-28">Priority:</dt><dd>{feature.priority}</dd></div>
            <div className="flex gap-2"><dt className="text-muted-foreground w-28">Impact:</dt><dd>{feature.impact}</dd></div>
          </dl>
          <button
            onClick={tryApi}
            disabled={loading}
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? t("common.loading") : `Try GET ${feature.apiPrefix}`}
          </button>
          {result && (
            <pre className="mt-3 text-xs bg-muted rounded p-3 overflow-auto whitespace-pre-wrap">{result}</pre>
          )}
        </section>
      </div>
    </div>
  );
}

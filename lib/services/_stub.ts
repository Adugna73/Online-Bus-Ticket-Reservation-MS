// Shared helpers for stubbed service modules. All external integrations
// (Redis, payment providers, SMS/USSD, GPS, AI) are mocked here and clearly
// marked with TODO for real wiring.

export type StubResult<T> = { ok: boolean; data?: T; error?: string; stub: true };

export function stub<T>(data: T): StubResult<T> {
  return { ok: true, data, stub: true };
}

export function stubError(error: string): StubResult<undefined> {
  return { ok: false, error, stub: true };
}

// Simulate async latency for realistic stub behavior.
export function delay(ms = 120): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function nowISO(): string {
  return new Date().toISOString();
}

// Tamper-proof chain hash stub (real impl: SHA-256 over prevHash+payload).
export function chainHash(prevHash: string | null, payload: string): string {
  // TODO: replace with crypto SHA-256 in production.
  const raw = `${prevHash || ""}|${payload}|${Date.now()}`;
  return `stubhash_${Math.abs(hashCode(raw)).toString(16)}`;
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

export const TODO_REAL_INTEGRATION =
  "TODO: replace mock with real provider integration (see gap requirements).";

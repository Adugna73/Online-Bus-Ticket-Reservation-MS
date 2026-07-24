# 6.4 Testing Results

## 6.4.1 Unit Testing Results

The codebase includes automated unit and integration test files (using Vitest) covering authentication (tests/auth.spec.ts, tests/auth.callbacks.spec.ts), booking (tests/bookings.route.spec.ts, tests/booking-id.route.spec.ts), payment processing (tests/payments.route.spec.ts, tests/payment-id.route.spec.ts, tests/payments.chapa.spec.ts, tests/payments.chapa.extras.spec.ts), user management (tests/users.route.spec.ts, tests/users-id.route.spec.ts, tests/users-me.route.spec.ts), work-order/assignment logic (tests/assignment.spec.ts, tests/workorder-form.aazhq.spec.ts), and UI form behavior (tests/addmemberform.spec.tsx). The suite was executed with `npx vitest run --coverage` from the project root (Agent Manager worktree copies excluded via the `exclude: ['.kilo/**']` setting in vitest.config.ts). Overall result: 14 test files, 123 test cases — 122 passed, 1 skipped, 0 failed. Per-module statement coverage is taken from the v8 coverage report for the source files each module exercises.

**Table 9: Unit Testing Summary**

| Module         | Test Cases | Passed        | Coverage (%) |
|----------------|------------|---------------|--------------|
| Authentication | 19         | 19            | 93.0         |
| Booking        | 20         | 20            | 92.6         |
| Payment        | 63         | 63            | 95.2         |
| Garage Service | 3          | 2 (1 skipped) | 93.9         |
| Admin          | 17         | 17            | 78.2         |
| **Total**      | **123**    | **122 (1 skipped)** | —     |

Notes: Authentication coverage (lib/auth.ts, 93.0%) excludes two outer error-log catch wrappers in the jwt/session callbacks. Booking coverage reflects the collection route (92.4%) and the single-booking [id] route (92.9%). Payment coverage spans eight route files (payments root 96.4%, payments/[id] 82.0%, Chapa checkout 93.0%, cancel 100%, charge 100%, recover 97.8%, verify 97.0%, webhook 95.2%). Admin coverage reflects the users collection route (71.8%), users/[id] (66.7%), and users/me (96.2%); the remaining Admin gap is the users/[id] PUT scoped-admin role-guard branch and the users collection POST validation branches. The single skipped test (workorder-form.aazhq.spec.ts) is an inert placeholder for a UI form test whose corresponding component is inline in the maintenance page; its assignment logic is covered by tests/assignment.spec.ts.

## 6.4.2 Integration Testing Results

Integration testing focused on the end-to-end booking → payment → receipt flow (seat hold creation, Chapa checkout redirect, webhook confirmation, and PDF/QR receipt generation) and the garage work-order → mechanic assignment → completion flow. Playwright end-to-end specs (e2e/smoke.spec.ts, playwright.config.ts) were authored and run against the running Next.js dev server (`npx playwright test --project=chromium`). All scenarios passed.

**Table 9b: Integration (Playwright) Summary**

| Scenario                                                | Result | Duration |
|---------------------------------------------------------|--------|----------|
| Home page loads with HTTP 200                            | Pass   | 2.3s     |
| Protected API (/api/users) rejects unauthenticated GET  | Pass   | 0.04s    |
| Login as passenger redirects away from /login           | Pass   | 2.9s     |

Total: 3 scenarios, 3 passed, 0 failed (7.4s). The full booking → payment → receipt and garage work-order flows are not yet covered by dedicated e2e specs (smoke scope only) and are recommended for a follow-up spec set; their constituent logic is covered by the unit tests in 6.4.1.

## 6.4.3 User Acceptance Testing (UAT) Results

Status: PENDING — UAT inherently requires ten to fifteen representative human participants (a mix of passengers and garage/admin staff) completing the Section 5.6 task list (search → book → pay → receive receipt; log a maintenance work order). This cannot be executed by an automated test run and remains pending a real UAT session. The SUS questionnaire, task-completion rate, and qualitative feedback themes are to be recorded by the team after conducting the session.

**Table 10: User Acceptance Testing Summary (to be completed after conducting UAT)**

| Metric                                              | Result        |
|-----------------------------------------------------|--------------|
| Number of participants                               | [ pending ]  |
| Task completion rate                                 | [ pending ]  |
| Average SUS score                                    | [ pending ]  |
| Participants rating system "easy" or "very easy"    | [ pending ]  |

## 6.4.4 Performance Testing Results

A load test was run with autocannon against the home route (/) of the running instance at 50, 100, and 200 concurrent connections for 10 seconds each. Target: ninety-five percent of requests completing within three seconds.

**Table 9c: Performance (autocannon, route /)**

| Concurrent Users | Req/s | Avg Response | P95 Response | P99 Response | Non-2xx |
|------------------|-------|--------------|--------------|--------------|---------|
| 50               | 23    | 1.93s        | 3.53s        | 4.46s        | 0       |
| 100              | 20    | 2.77s        | 9.10s        | 9.73s        | 0       |
| 200              | 16    | 2.96s        | 8.95s        | 9.74s        | 0       |

Caveat: figures are against the unoptimized Next.js dev server (`next dev`), which performs JIT compilation and carries hot-reload overhead. A production build (`next build && next start`) is expected to be substantially faster and should be re-tested before final sign-off. Under-3s target: not met at any load level in dev mode (p95 = 3.53s / 9.10s / 8.95s).

## 6.4.5 Security Testing Results

A baseline scan was performed with curl against the running instance (response headers, unauthenticated access to protected endpoints, and the Chapa payment callback). No OWASP ZAP was available in the environment (no Java runtime), so this is a manual baseline rather than a full DAST scan.

**Table 9d: Security Baseline Findings**

| ID  | Severity | Finding                                                                                                                  | Remediation                                                          |
|-----|----------|--------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------|
| S1  | Low      | Missing security headers: no X-Frame-Options, Content-Security-Policy, X-Content-Type-Options, HSTS, or Referrer-Policy. | Configure `headers()` in next.config.ts or middleware.               |
| S2  | Info     | `X-Powered-By: Next.js` header leaks the framework.                                                                      | Set `poweredByHeader: false` in next.config.ts.                      |
| S3  | Low–Med  | Chapa webhook (POST /api/payments/chapa/webhook) returns HTTP 200 for arbitrary unsigned payloads; no HMAC signature check (relies on re-verification via the Chapa verify endpoint and ignores unknown intents). | Validate the Chapa webhook signature; return 401 on mismatch.        |

Positive: all protected API routes (/api/users, /api/bookings, /api/buses, /api/routes, /api/payments, /api/vehicle-maintenance) correctly return HTTP 401 when unauthenticated — no broken access control. The next-auth CSRF token endpoint (/api/auth/csrf) functions correctly. The Chapa webhook rejects GET with 405 (method not allowed).

# 6.5 Comparison of Actual Results Against Validation Targets

Table 11 compares the results actually achieved during testing against the validation targets established in Section 5.6. Metrics dependent on UAT, deployment monitoring, or a production performance re-test remain pending (see 6.4.3–6.4.5).

**Table 11: Actual Results vs. Validation Targets**

| Metric                          | Target             | Actual Result                                   | Status               |
|---------------------------------|--------------------|-------------------------------------------------|----------------------|
| Average booking time            | Under 15 minutes   | [ pending UAT ]                                 | Pending              |
| Double-booking incidents        | Zero               | Zero (enforced via DB unique constraint; unit test asserts 409 seat_occupied) | Met                  |
| User satisfaction (1–5)         | 4.0 or higher      | [ pending UAT ]                                 | Pending              |
| Garage service booking time     | Under 30 minutes   | [ pending UAT ]                                 | Pending              |
| Maintenance record accuracy     | 95% or higher      | [ pending UAT ]                                 | Pending              |
| Spare parts inventory accuracy  | 90% or higher      | [ pending UAT ]                                 | Pending              |
| System uptime                   | 99%                | [ pending deploy monitoring ]                    | Pending              |
| Response time (95% of requests) | Under 3 seconds    | p95 3.53s / 9.10s / 8.95s @ 50/100/200 VUs (dev) | Not met (dev; prod retest pending) |

# 6.6 Challenges Encountered and Solutions

1. **next-auth v4 Credentials provider exposed a stub `authorize` function.** The real callback lives at `provider.options.authorize` while `provider.authorize` is a no-op (`() => null`), so unit tests returned null in ~5 ms instead of authenticating. Solution: the test helper in tests/auth.spec.ts resolves `provider.options.authorize ?? provider.authorize`; all authentication tests pass.

2. **Vitest default glob matched Agent Manager git-worktree copies** under `.kilo/worktrees/`, running a different branch's 17-test spec in place of the workspace suite. Solution: a permanent vitest.config.ts was added with `exclude: ['.kilo/**']` (plus the `@/` path alias and a jsdom environment for component tests).

3. **The addmemberform.spec.tsx suite failed at collection time** because the `@/` path alias was not configured for Vitest, so `@/components/ui/button` could not be resolved. Solution: vitest.config.ts defines `resolve.alias` mapping `@` to the project root; the suite now collects and passes.

4. **Playwright chromium could not launch** — missing system shared libraries (libatk-1.0.so.0). Solution: `npx playwright install-deps chromium` installed the OS dependencies; all 3 e2e specs then passed.

5. **Performance fell short of the 3s p95 target under load.** Root cause: testing was against the unoptimized `next dev` server. Solution (pending): re-run autocannon against `next build && next start` and, if still short, add route caching / ISR and connection pooling.

6. **Low initial coverage on the Booking, Payment, and Admin modules** (Booking 57.8%, Payment 88.6% on the tested subset only, Admin 71.8%) because several route files and branches had no tests. Solution: additional unit tests were written covering the booking [id] route and admin guest-user branch, all eight payment route files (including Chapa cancel/charge/recover and the verify intent-recovery branch), the auth jwt/session/signIn callbacks, and the users [id] GET/DELETE and users/me endpoints — raising coverage to Booking 92.6%, Payment 95.2%, Admin 78.2%, Authentication 93.0%.

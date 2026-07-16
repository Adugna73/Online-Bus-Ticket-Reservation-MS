# Tasks generated from git commits

Range: 2025-12-01 → 2025-12-30

Total tasks: 34

## uncategorized (4)

- **feat: include .d.ts files in TypeScript compilation closes #PMTM-1** — yohanessenbeto — 2025-12-30T14:26:02.000Z
  - commit: b0dfc014861557ff5562256da17bc9bf25588fe5
  - files: tsconfig.json
- **ci: disable eslint.config.mjs to allow lint reporting** — yohanessenbeto — 2025-12-11T07:04:33.000Z
  - commit: 44d051a9033aa84c7fec03394c600d16c415419c
  - files: eslint.config.mjs.disabled, package-lock.json, package.json
- **chore: restore eslint.config.mjs** — yohanessenbeto — 2025-12-11T07:02:14.000Z
  - commit: 7e7ab5ef33334fd40359dc4175b8f2d38f5fa724
  - files: .eslintrc.cjs, eslint.config.mjs
- **chore: disable broken eslint.config.mjs to run lint checks** — yohanessenbeto — 2025-12-11T07:00:04.000Z
  - commit: 98b39c2928811efcbe3ecdd9e655fe62e6ac3f57
  - files: .eslintrc.cjs, eslint.config.mjs.disabled

## frontend (26)

- **refactor: improve code formatting and readability in PreventiveMaintenanceDashboard component** — yohanessenbeto — 2025-12-29T15:30:41.000Z
  - commit: 3888cd940007d071dcbc49fe86a0da36977673fb
  - files: components/PreventiveMaintenanceDashboard.tsx
- **feat: add expanded card functionality for Completed Vs Scheduled chart and improve layout responsiveness** — yohanessenbeto — 2025-12-29T15:29:38.000Z
  - commit: 3d306faae32f0a7a3336d24191fa81521ff399a9
  - files: components/PreventiveMaintenanceDashboard.tsx
- **Refactor PreventiveMaintenanceDashboard component for improved readability and consistency** — yohanessenbeto — 2025-12-29T12:46:34.000Z
  - commit: 20b987430326407738b77a80c10ee762274dfbac
  - files: components/DashboardClient.tsx, components/PreventiveMaintenanceDashboard.tsx
- **feat: replace DashboardClient with PreventiveMaintenanceDashboard in manager and supervisor dashboards** — yohanessenbeto — 2025-12-29T12:45:54.000Z
  - commit: 64b40fce1789db65859528392ff50d59e617ad20
  - files: app/admin/dashboard/page.tsx, app/api/dashboard/stats/route.ts, app/manager/managerial-dashboard/page.tsx, app/supervisor/dashboard/page.tsx, components/DashboardClient.tsx
- **Refactor code structure for improved readability and maintainability** — yohanessenbeto — 2025-12-25T15:38:25.000Z
  - commit: bf8514db56296f4594ba2a5a8f3d7049aa9bb074
  - files: app/admin/workorders/create-new-order/page.tsx, app/api/public-images/route.ts, app/api/workorders/[id]/checklist/route.ts, app/api/workorders/[id]/route.ts, app/api/workorders/route.ts
- **feat: update DashboardClient layout and spacing** — yohanessenbeto — 2025-12-24T15:31:45.000Z
  - commit: c9ce18fe20bcbcb5ac0ea864394ddab5a6ad8ab8
  - files: .vscode/settings.json, app/favicon.ico, app/manager/workorders/create-new-order/page.tsx, app/supervisor/teams/page.tsx, app/supervisor/workorders/create-new-order/page.tsx
- **refactor: improve code readability by restructuring rolePath assignments across multiple components** — yohanessenbeto — 2025-12-23T16:24:37.000Z
  - commit: 6e8715065a8f96576baaecc286702086dbfa600b
  - files: app/admin/teams/[id]/page.tsx, app/admin/workorders/create-new-order/page.tsx, app/create-work-orders/[id]/page.tsx, app/manager/teams/[id]/page.tsx, app/manager/workorders/create-new-order/page.tsx
- **feat: Add pages for managing work orders across different roles** — yohanessenbeto — 2025-12-23T16:24:09.000Z
  - commit: 93497966947caa32b562810eec2c840e2ec4a35c
  - files: .next-dev.log, app/admin/all/page.tsx, app/admin/completed/page.tsx, app/admin/create-work-orders/page.tsx, app/admin/dashboard/page.tsx
- **refactor: improve code readability and formatting in WorkOrdersTableClient component** — yohanessenbeto — 2025-12-22T16:20:04.000Z
  - commit: d6701046611e1d9ebba17dffdcff518d8b5250b7
  - files: app/layout.tsx, components/WorkOrderForm.tsx, components/workorders-table/WorkOrdersTableClient.tsx
- **feat: enhance work orders table with new view options and improved filtering** — yohanessenbeto — 2025-12-22T16:19:45.000Z
  - commit: 70952bd2f34ab84f15e2e792f28d665d49865c5a
  - files: app/api/assets/route.post.ts, app/api/debug/supervisor-mapping/route.ts, app/api/debug/supervisor-report/route.ts, app/globals.css, app/layout.tsx
- **Refactor code structure for improved readability and maintainability** — yohanessenbeto — 2025-12-19T15:16:46.000Z
  - commit: c08e8303cbbd7f1830687168f30b484a90d6f136
  - files: components/TeamDetails.tsx, components/TeamsClient.tsx
- **feat: add checklist scope functionality to technician checklist form and work order form** — yohanessenbeto — 2025-12-19T15:16:28.000Z
  - commit: 44a8f890d86cacb6f809d7e28b127c9806240321
  - files: app/api/ne-names/route.ts, app/api/sites/[siteId]/route.ts, app/api/sites/route.ts, app/api/team-assignments/[id]/route.ts, app/api/team-assignments/route.ts
- **Refactor code structure for improved readability and maintainability** — yohanessenbeto — 2025-12-15T16:38:03.000Z
  - commit: a0a935f3fe51194653e6ad43859aa6a211da2cc2
  - files: app/api/dashboard/stats/route.ts, app/api/workorders/route.ts, app/dashboard/page.tsx, app/page.tsx, app/workorders/page.tsx
- **style: update button styles for consistency and improved UI feat: enhance sidebar and maintenance page with role-based a** — yohanessenbeto — 2025-12-12T16:44:35.000Z
  - commit: cb798517aa34aaf61562e2402aff40b03c2e437d
  - files: app/globals.css, app/maintenance/page.tsx, components/AppSidebar.tsx, components/LoginForm.tsx, components/ReportsClient.tsx
- **Refactor code structure for improved readability and maintainability** — yohanessenbeto — 2025-12-12T15:34:59.000Z
  - commit: cc2d9076ffec7f6b1a452837347720f66ccdb3e1
  - files: app/globals.css, app/layout.tsx, app/login/page.tsx, app/maintenance/page.tsx, app/page.tsx
- **feat: add checklist attachments page for managers with access control** — yohanessenbeto — 2025-12-11T15:58:33.000Z
  - commit: e5493e83ba6e1586b352b17d33b1950709c12ee0
  - files: app/dashboard/page.tsx, app/globals.css, app/layout.tsx, app/login/page.tsx, app/maintenance/page.tsx
- **theme: apply Ethio Telecom brand colors to globals.css** — yohanessenbeto — 2025-12-11T08:23:13.000Z
  - commit: bbf4d85d5c6f0fc2d7350b40d09808957c6f2e73
  - files: app/globals.css
- **chore(ui): add lightweight shadcn-style UI primitives (button,input,dialog,toast)** — yohanessenbeto — 2025-12-11T08:13:02.000Z
  - commit: a091843aa216d3934179d3fd860dcad24e8f97ee
  - files: .eslintrc.cjs, ENDPOINTS_AND_SAMPLES.md, components/ui/button.tsx, components/ui/dialog.tsx, components/ui/index.ts
- **All in one** — yohanessenbeto — 2025-12-10T19:38:54.000Z
  - commit: 2a0efd437703e434feb8609121d0140eae508ce5
  - files: .next-dev.log, app/api/checklist/attachments/route.ts, app/api/dashboard/stats/route.ts, app/api/debug/supervisor-mapping/route.ts, app/api/reports/manager/route.ts
- **refactor: Improve code formatting and readability in layout, Sidebar, and WorkOrdersClient components** — yohanessenbeto — 2025-12-08T15:56:33.000Z
  - commit: 671ed19ae956e11460eb15b0bf6226a06523aa51
  - files: app/layout.tsx, components/SidebarV2.tsx, components/WorkOrdersClient.tsx
- **feat: Update work order management features** — yohanessenbeto — 2025-12-08T15:56:12.000Z
  - commit: b1143f615e3c290b4b63676d215041fb25add0b9
  - files: app/all/page.tsx, app/api/dashboard/stats/route.ts, app/api/workorders/[id]/attachments/route.ts, app/api/workorders/[id]/route.ts, app/api/workorders/counts/route.ts
- **refactor: Enhance formatting and readability in DashboardClient component** — yohanessenbeto — 2025-12-05T15:37:54.000Z
  - commit: a43a6f932177e86e9e8d997fe2386819bb7a6a6b
  - files: components/DashboardClient.tsx
- **feat: add site seeding script with region and zone handling** — yohanessenbeto — 2025-12-05T15:36:44.000Z
  - commit: b9b7a10ea1fdc76458171ffe4e6f342e02c3e0dc
  - files: app/api/checklist/attachments/route.ts, app/api/dashboard/stats/route.ts, app/api/ne-names/route.ts, app/api/sites/[siteId]/route.ts, app/api/sites/[siteId]/teams/route.ts
- **refactor: Improve code formatting and readability in Sidebar, WorkOrderForm, and WorkOrdersClient components** — yohanessenbeto — 2025-12-03T15:17:16.000Z
  - commit: f8fd92a11c22bd8ceca26db775966d53d9c77ad6
  - files: components/SidebarV2.tsx, components/WorkOrderForm.tsx, components/WorkOrdersClient.tsx
- **feat: Add various scripts for user management, data import, and database operations** — yohanessenbeto — 2025-12-03T15:15:39.000Z
  - commit: 9aec649fc681f00db0df7fac1d3bf22bf9497508
  - files: Preventive Maintenance Template for information V3.4.xlsx, TN_OM Staff V.2.json, TN_OM Staff V.2.xlsx, UX design sample.png, app/api/assets/route.post.ts
- **Initial commit from Create Next App** — yohanessenbeto — 2025-12-02T16:15:25.000Z
  - commit: 3b09e280774a1ff947b22e843e03ee324b4a1a74
  - files: .gitignore, README.md, app/favicon.ico, app/globals.css, app/layout.tsx

## scripts (2)

- **chore: archive scripts and coursera_short assets** — yohanessenbeto — 2025-12-11T06:57:16.000Z
  - commit: 1d95d89d800a0fad54b0353d15ce9d76bf194185
  - files: archive/assets/coursera_short/captions_en.srt, archive/assets/coursera_short/captions_photos_en.srt, archive/assets/coursera_short/make_sample_video.sh, archive/assets/coursera_short/make_sample_video_simple.sh, archive/assets/coursera_short/make_steps_video.sh
- **chore: archive ad-hoc root scripts to archive/old-scripts** — yohanessenbeto — 2025-12-11T06:54:44.000Z
  - commit: bbd5ac6038d6b62bfe023d23038232f84de6efef
  - files: archive/old-scripts/assign-supervisors.ts, archive/old-scripts/assign-weliso.ts, archive/old-scripts/check-cwr-data.ts, archive/old-scripts/check-cwr.js, archive/old-scripts/check-supervisors.ts

## backend (1)

- **chore: ignore build artifacts and local logs** — yohanessenbeto — 2025-12-11T06:55:07.000Z
  - commit: 480a189c898883b142af256dd503e10f9cec9aff
  - files: .gitignore, prisma-studio.log

## docs (1)

- **first commit** — yohanessenbeto — 2025-12-03T15:14:18.000Z
  - commit: 0994c7408224fbc7f7d533c84913ac62e23e41d3
  - files: README.md


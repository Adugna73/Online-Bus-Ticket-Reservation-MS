## Advanced seeding & relations

This project supports a richer set of relationships for staff and supervisors. The import script (`scripts/import-staff.ts`) will:
- Create users and roles, regions, and zones.
- Create teams from the `Group` column and assign team membership.
- Assign `immediateSupervisor` relations when `Immediate Supervisor` matches another imported staff member.

To reset your database and re-seed using the provided staff JSON:

1) Ensure a running DB and `DATABASE_URL` is configured (e.g., using Docker):
```
docker run --rm -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pmdb -p 5432:5432 -d postgres:15
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pmdb"
```
2) Run prisma migrations and generate client:
```
npx prisma migrate dev --name add-password-hash
npx prisma generate
```
3) Reset DB (drops rows) and import staff (from JSON):
```
npm run db:reset
npm run import:staff -- "./TN_OM Staff V.2.json"
```
4) Validate seeding:
```
npm run db:seed:check
```

Sample queries / checks
- Count rows for essential checks:
	- Users: `await prisma.user.count()`
	- Teams: `await prisma.team.count()`
	- Workorders: `await prisma.workOrder.count()`
- Subordinates of a manager (by immediate supervisor):
```
const subordinates = await prisma.user.findMany({ where: { immediateSupervisorId: managerId } });
```
- Staff in a manager's assigned regions or zones:
```
// where manager.assignedRegion holds an array of region ids assigned to the manager
const usersInRegions = await prisma.user.findMany({ where: { assignedRegion: { hasSome: manager.assignedRegion } } });
```
- Per-manager or per-zone work order performance (planned/unplanned and completed vs not) sample:
```
// get assigned user ids first (subordinates or region users)
const assigneeIds = usersInRegions.map(u => u.id);
const grouped = await prisma.workOrder.groupBy({
	by: ['planned', 'status'],
	where: { assignedToId: { in: assigneeIds } },
	_count: { _all: true }
});
console.log(grouped);
```

Notes
- Data normalization: import tries to map exact names and emails for supervisors; if the `Immediate Supervisor` doesn't match a full name or email in the sheet, the relation remains empty.
- Team management: Teams are created from the `Group` column; if a supervisor is set, the same supervisor becomes the team manager by default.
- In production, replace the default seed password flows and add password reset flows and hashed-only passwords for imports.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Dev Notes

- Login: The login form accepts either staff/employee ID (e.g., `ethio14001`) or your company email (e.g., `yohanes.senbeto@ethiotelecom.et`).
- AD/LDAP configuration: By default the app binds directly to the LDAP server defined in `LDAP_URL` (usually an internal IP). For public deployments you can instead set `AD_LOGIN_URL` to an HTTP endpoint that accepts `{ email, password }` and returns success/failure; the code will POST to that URL before falling back to LDAP. This allows usage of a reverse‑proxy or separate authentication service.
 - Dashboard: After login, the app displays a role-aware dashboard (supervisor, manager, director) with KPI cards and team/subordinate breakdowns. Use `app/dashboard` to view and test the new layout.
- Seed default password: When importing staff via `scripts/import-staff.ts`, seeded users can sign in using the default password `pm@12345` (for demo purposes only). In production, store and validate password hashes securely.
- Roles recognised by the importer now include **director**; you can also supply a `role` field in the JSON to override automatic inference.

### Organizing the staff JSON

A helper script makes it easy to inspect or reorder the big staff file by region
and zone. Run it from the project root:

```bash
# print grouped listing (readonly)
npm run format:staff

# rewrite the JSON sorted by region/zone/name
npm run format:staff -- --write    # or -w

# output a JSON object keyed by region codes
npm run format:staff -- --group --output grouped.json
```

You can now maintain the file either as a flat array **or** as a grouped object
(the importer will flatten it automatically).  A grouped file looks like:

```json
{
  "CWR": [ { ... }, ... ],
  "WR": [ { ... } ],
  …
}
```

This makes it simple to edit one region at a time without scrolling through
the entire array.  When you import, `npm run import:staff` will happily accept
either format and dedup the records.

To convert your existing flat file into a grouped structure in place, combine
the `--group` and `--write` flags:

```bash
npm run format:staff -- --group --write
```

The file will be overwritten with the grouped‑by‑region object instead of an
array.  You can later run `--group` again to view or re-export the regions.

The script lives in `scripts/format-staff.ts` and sorts by
`locationCategory` (region code), then `location` (zone), then name. It's
handy when you update the file and want related entries to stay together.

**Additional options:**

* `--group` or `-g` will output a JSON object grouping records by region code
  (top‑level keys).  That makes it trivial to edit or copy sections for a
  particular region.  You can pipe the output or use `--output path.json` to
  save the result:

  ```bash
  npm run format:staff -- --group > grouped.json
  npm run format:staff -- --group --output by-region.json
  ```
  The resulting structure looks like:
  ```json
  {
    "CWR": [
      {"employeeId": "2972", "fullName": "Abrham Temteme Makonnen", ...},
      ...
    ],
    "WR": [ ... ]
  }
  ```

* `--write` rewrites the original file in sorted order (as before).

#### Organizing the site JSON

We have a sister helper for the site list (`data/site-info.json`) that works
the same way. It sorts by the `region_zone` field and can group entries by
region for easier editing.

```bash
# show a text listing grouped by region
npm run format:sites

# sort the file in place
npm run format:sites -- --write

# create a grouped object (print to stdout or save with --output)
npm run format:sites -- --group --output grouped-sites.json

# convert the existing file to grouped form directly
npm run format:sites -- --group --write
```

The import script (`npm run import:sites`) now accepts either the flat array
or the grouped object produced above.  This makes it simple to make
region-specific adjustments to the site catalogue, just like the staff data.

 - Import formats: The staff import script supports both XLSX (`.xls`/`.xlsx`) and JSON (`.json`) files. You can convert your XLSX files to JSON by running:
 
 ```bash
 npm run convert:staff:json -- "./TN_OM Staff V.2.xlsx"
 ```
 
 This writes a `.json` file next to the XLSX file with the same row objects. You can then import the JSON file directly:
 
 ```bash
 npm run import:staff -- "./TN_OM Staff V.2.json"
 # or for dry-run
 npm run import:staff:dry -- "./TN_OM Staff V.2.json"
 ```

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# pm-task-management-sys
# Online-Bus-Ticket-Reservation-MS

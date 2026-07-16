# API Endpoints and Sample Test Data

This file lists the API endpoints found under `app/api/**` and provides concise sample requests you can paste into Postman or use with curl. For a ready-to-import collection see `postman_collection.json` at the repository root.

Base URL (dev): `http://localhost:3000`

Auth: set header `Authorization: Bearer {{authToken}}` or send your session cookie.

---

## Auth

- POST /api/auth/login
  - Body (JSON):
    ```json
    {"email":"test.user@example.com","password":"Password123!"}
    ```

- POST /api/auth/logout
  - No body. Use cookie or auth header.

- GET /api/auth/me
  - Returns current user session info.

---

## Users

- GET /api/users
  - Query options may include pagination/filtering depending on server.

- POST /api/users
  - Body (JSON):
    ```json
    {"email":"new.user@example.com","name":"New User","role":"technician","teamId":"team_1"}
    ```

- GET /api/users/:id
  - Replace `:id` with user id.

- PUT /api/users/:id
  - Body (JSON): fields to update, e.g.
    ```json
    {"name":"Updated Name","role":"manager"}
    ```

- DELETE /api/users/:id
  - Deletes the user.

---

## Work Orders

- GET /api/workorders
  - Optional query params: `status`, `siteId`, etc.

- POST /api/workorders
  - Body (JSON):
    ```json
    {
      "title":"Fix leaking pipe in Building A",
      "description":"Valve in basement leaking intermittently",
      "siteId":"site_101",
      "teamId":"team_1",
      "priority":"high",
      "requestedBy":"user_456",
      "dueDate":"2025-12-20T12:00:00.000Z"
    }
    ```

- GET /api/workorders/counts
  - Returns counts/summary (open/closed etc.).

- GET /api/workorders/:id
  - Single work order details.

- PATCH /api/workorders/:id
  - Partial updates, e.g. change status:
    ```json
    {"status":"closed","assignedTo":"user_789"}
    ```

- POST /api/workorders/:id/checkin
  - Check-in action, body depends on implementation (e.g. `{"checkedInBy":"user_123"}`).

- POST /api/workorders/:id/attachments
  - `multipart/form-data` with field `file` to upload attachments.

- GET /api/workorders/:id/attachments
  - List attachments for work order.

---

## Work Order Checklist

- POST /api/workorders/:id/checklist
  - Add checklist item. Example:
    ```json
    {"title":"Inspect valve","completed":false}
    ```

- GET /api/workorders/:id/checklist
  - Lists checklist items.

- PATCH /api/workorders/:id/checklist
  - Update checklist item(s), e.g. mark complete:
    ```json
    {"itemId":"chk_1","completed":true}
    ```

---

## Reports

- POST /api/reports/manager
  - Generates an XLSX report. Body example:
    ```json
    {"startDate":"2025-11-01","endDate":"2025-11-30","managerId":"manager_1","regionIds":["region_1"]}
    ```

---

## Sites

- GET /api/sites

- GET /api/sites/:siteId

- GET /api/sites/:siteId/teams
  - Lists teams assigned to the site.

---

## Teams

- GET /api/teams

- GET /api/teams/:id

- GET /api/teams/:id/areas

- GET /api/teams/organization

Create a team (if supported): POST /api/teams with body:
```json
{"name":"West Region Team A","members":["user_456","user_789"]}
```

---

## Assets

- GET /api/assets

- POST /api/assets (or /api/assets via `route.post.ts`)
  - Body example for creating an asset:
    ```json
    {"name":"Pump A","siteId":"site_101","serial":"SN-001"}
    ```

---

## Maintenance

- GET /api/maintenance/templates

- GET /api/maintenance/categories

---

## Dashboard

- GET /api/dashboard/stats

- POST /api/dashboard/seed-demo
  - No body or small JSON to seed demo data (used in dev).

---

## Regions / Zones / Names

- GET /api/regions
- GET /api/zones
- GET /api/ne-names

---

## Roles

- GET /api/roles

---

## Checklist Attachments (global)

- POST /api/checklist/attachments
  - `multipart/form-data` file field for checklist attachments.

---

## Debug / Utility

- GET /api/debug/supervisor-mapping
  - Returns supervisor mapping debug info (reads `supervisor-map.json` / `supervisors.json`).

---

## Usage notes
- Import `postman_collection.json` (repo root) into Postman for quick testing.
- Use the example JSON bodies above for POST/PUT/PATCH endpoints.
- For file uploads use Postman's `form-data` mode and a `file` field.
- If the API requires a session cookie, authenticate first (via `/api/auth/login`) and reuse the cookie.

If you'd like, I can:
- Expand `postman_collection.json` to include every single discovered route (currently contains main ones). Reply `expand-all`.
- Add example responses into the collection (`add-responses`).
- Run a quick smoke test (curl) against a running local server (you must confirm the server is running). Reply `smoke-test`.

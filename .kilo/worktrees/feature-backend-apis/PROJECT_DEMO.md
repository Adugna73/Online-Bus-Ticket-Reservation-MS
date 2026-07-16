# Preventive Maintenance Tasks Management System: Project Demo

## 1. Project Structure Overview

- **Frontend:**
  - `app/` — Next.js pages for each role and feature (admin, manager, supervisor, technician, dashboard, login, reports, etc.)
  - `components/` — Reusable React components (Sidebar, Dashboard, WorkOrderForm, TeamDetails, etc.)
  - `public/` — Static assets (images, uploads)
  - `globals.css`, `tailwind.config.js` — Styling and theme

- **Backend/API:**
  - `app/api/` — API routes (e.g., `/api/teams/organization`, `/api/workorders`, `/api/sites`, `/api/users`)
  - `lib/` — Utility functions (auth, prisma client, helpers)

- **Database:**
  - `prisma/schema.prisma` — Prisma schema (see below for full models)
  - `prisma/migrations/` — Migration history

- **Other:**
  - `scripts/` — Data processing scripts
  - `data/` — Seed and mapping JSON files
  - `tests/` — Test files
  - `Dockerfile`, `docker-compose.yml` — Containerization (not included in this demo)

## 2. Frontend Flow

- Pages are organized by user role and feature (e.g., `app/admin/teams`, `app/manager/workorders`).
- Components are reused for UI consistency (e.g., Sidebar, DashboardCard, WorkOrderForm).
- User actions (search, create, edit) trigger API calls using fetch.
- State management via React hooks and context.

## 3. Backend/API Flow

- API routes in `app/api/` handle requests from the frontend.
- Example: `app/api/teams/organization/route.ts` aggregates managers, supervisors, technicians, and sites.
- API routes use Prisma to query/update the database.
- Authentication handled via `lib/auth.ts` and NextAuth.

## 4. Database Schema (Prisma)

### Role
```
model Role {
  id          String @id @default(uuid())
  key         String @unique
  displayName String
  users       User[]
}
```

### User
```
model User {
  id                  String    @id @default(cuid())
  employeeId          String?   @unique
  fullName            String
  email               String    @unique
  username            String    @unique
  immediateSupervisorId String?
  immediateSupervisor   User?   @relation("UserSupervisor", fields: [immediateSupervisorId], references: [id])
  subordinates          User[]  @relation("UserSupervisor")
  managerId             String?
  phone               String?
  division            String?
  department          String?
  section             String?
  group               String?
  locationCategory    String?
  location            String?
  supervisorStationId String?
  supervisorStation   Site? @relation("supervisorStation", fields: [supervisorStationId], references: [id])
  jobTitle            String?
  category            String?
  jobRole             String?
  roleId              String?
  role                Role?      @relation(fields: [roleId], references: [id])
  teamId              String?
  team                Team?      @relation("TeamMembers", fields: [teamId], references: [id])
  managedTeams        Team[]     @relation("TeamManager")
  teamAssignments     TeamAssignment[]
  pmTemplatesCreated  PMTemplate[]
  assignedWorkOrders  WorkOrder[]  @relation("WorkOrderAssignedTo")
  createdWorkOrders   WorkOrder[]  @relation("WorkOrderCreatedBy")
  completedWorkOrders WorkOrder[]  @relation("WorkOrderCompletedBy")
  reviewedWorkOrders  WorkOrder[]  @relation("WorkOrderReviewedBy")
  deletedWorkOrders   WorkOrder[]  @relation("WorkOrderDeletedBy")
  completedChecklists Checklist[]
  uploadedAttachments WorkOrderAttachment[]
  managedRegions      Region[]    @relation("RegionManagers")
  managedZones        Zone[]      @relation("ZoneManagers")
  createdAt           DateTime  @default(now())
  updatedAt           DateTime?
  deletedAt           DateTime?
  staffId             String?   @unique
  passwordHash        String?
  assignedRegion      String[]
  assignedZone        String[]
  enabled             Boolean   @default(true)
}
```

### Team
```
model Team {
  id        String @id @default(uuid())
  name      String
  managerId String?
  manager   User?  @relation("TeamManager", fields: [managerId], references: [id])
  members   User[] @relation("TeamMembers")
  teamAssignments TeamAssignment[]
  workOrders WorkOrder[] @relation("TeamWorkOrders")
  sites     Site[]  @relation("TeamSites")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Region, Zone, Area
```
model Region {
  id             String       @id @default(uuid())
  name           String
  description    String?
  organization   Organization @relation(fields: [organizationId], references: [id])
  organizationId String
  zones          Zone[]
  areas          Area[]
  sites          Site[]
  managers       User[] @relation("RegionManagers")
}

model Zone {
  id       String @id @default(uuid())
  name     String
  region   Region @relation(fields: [regionId], references: [id])
  regionId String
  managers User[] @relation("ZoneManagers")
  sites    Site[]
  workOrders WorkOrder[]
}

model Area {
  id       String @id @default(uuid())
  name     String
  region   Region @relation(fields: [regionId], references: [id])
  regionId String
  sites    Site[]
}
```

### Site
```
model Site {
  id        String      @id @default(uuid())
  siteCode  String      @unique
  name      String
  region    Region      @relation(fields: [regionId], references: [id])
  regionId  String
  zone      Zone?       @relation(fields: [zoneId], references: [id])
  zoneId    String?
  area      Area?       @relation(fields: [areaId], references: [id])
  areaId    String?
  address   String?
  geom      Json?
  neNameAndId String?
  allNeNames  Json?
  deviceModel String?
  vendor     String?
  longitude  String?
  latitude   String?
  runningState String?
  supervisorStationId String?
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
  assets    Asset[]
  WorkOrder WorkOrder[]
  supervisors User[] @relation("supervisorStation")
  teams      Team[]  @relation("TeamSites")
}
```

### Asset
```
model Asset {
  id                String            @id @default(uuid())
  assetTag          String            @unique
  serialNumber      String?
  manufacturer      String?
  model             String?
  assetType         String
  criticality       Int               @default(2)
  installDate       DateTime?
  warrantyEnd       DateTime?
  site              Site              @relation(fields: [siteId], references: [id])
  siteId            String
  lastMaintenance   DateTime?
  status            String            @default("operational")
  telemetryDeviceId String?
  metadata          Json?
  pmSchedules       PMSchedule[]
  WorkOrder         WorkOrder[]
  TelemetryDevice   TelemetryDevice[]
}
```

### WorkOrder
```
model WorkOrder {
  id               String          @id @default(uuid())
  taskNumber       String?         @unique
  title            String
  description      String?
  site             Site            @relation(fields: [siteId], references: [id])
  siteId           String
  zone             Zone?           @relation(fields: [zoneId], references: [id])
  zoneId           String?
  asset            Asset?          @relation(fields: [assetId], references: [id])
  assetId          String?
  template         PMTemplate?     @relation(fields: [templateId], references: [id])
  templateId       String?
  type             String
  checklistScope   String          @default("full")
  scheduledStartAt DateTime?
  scheduledEndAt   DateTime?
  actualStartAt    DateTime?
  actualEndAt      DateTime?
  status           String          @default("created")
  priority         Int?
  assignedTo       User?           @relation(name: "WorkOrderAssignedTo", fields: [assignedToId], references: [id])
  assignedToId     String?
  planned          Boolean         @default(true)
  teamId           String?
  team             Team?           @relation("TeamWorkOrders", fields: [teamId], references: [id])
  createdBy        User?           @relation(name: "WorkOrderCreatedBy", fields: [createdById], references: [id])
  createdById      String?
  checklist        Checklist?
  parts            WorkOrderPart[]
  attachments      WorkOrderAttachment[]
  completedBy   User?      @relation("WorkOrderCompletedBy", fields: [completedById], references: [id])
  completedById String?
  completedAt   DateTime?
  reviewedBy    User?      @relation("WorkOrderReviewedBy", fields: [reviewedById], references: [id])
  reviewedById  String?
  reviewedAt    DateTime?
  archived      Boolean    @default(false)
  archivedAt    DateTime?
  deletedAt     DateTime?
  deletedBy     User?      @relation("WorkOrderDeletedBy", fields: [deletedById], references: [id])
  deletedById   String?
  technicianLatitude  String?
  technicianLongitude String?
  checkInTime         DateTime?
  checkOutTime        DateTime?
  locationVerified    Boolean      @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Other Models
- Checklist
- Part
- WorkOrderPart
- WorkOrderAttachment
- TelemetryDevice
- TelemetryLog
- ActivityLog
- TeamAssignment

## 5. Methods & Data Flow (No Docker)

### How Each Page Works

- **Login:**
  - User logs in via `/app/login`.
  - Auth logic in `lib/auth.ts`.

- **Dashboard:**
  - Loads user-specific data (work orders, teams, sites).
  - Uses API routes to fetch data.

- **Work Order Search/Create:**
  - `WorkOrdersClient.tsx` and `WorkOrderForm.tsx` handle UI and logic.
  - Search/filter by site, task number, archived status.
  - Form submits to API, which updates DB via Prisma.

- **Admin Team Management:**
  - `app/admin/teams/page.tsx` fetches managers, supervisors, techs, sites.
  - Uses `AdminTeamsManagerGrid.tsx` for UI.

- **API Example:**
  - Frontend calls `/api/teams/organization`.
  - API route queries DB, aggregates data, returns JSON.

- **Database:**
  - Prisma schema defines relations.
  - Migrations update DB structure.

## 6. How to Explain to Manager

- Show folder structure and explain separation of concerns.
- Demo UI: login, dashboard, work order, admin features.
- Show API routes and how frontend talks to backend.
- Open Prisma schema and explain models and relations.
- Walk through a data flow: user action → API → DB → UI update.

## 7. Key Schema Relations: Sites, Work Orders, and Users

### Entity Relationship Overview

- **User**: Represents staff (manager, supervisor, technician, etc.).
- **Site**: Represents a physical location (facility, station, etc.).
- **WorkOrder**: Represents a maintenance or repair task, linked to a Site and assigned to a User (technician or supervisor).

### How They Relate

- Each **WorkOrder** is linked to one **Site** (`siteId` foreign key).
- Each **WorkOrder** can be assigned to one **User** (technician/supervisor) via `assignedToId`.
- Each **Site** can have multiple **WorkOrders** (one-to-many).
- Each **User** can be assigned multiple **WorkOrders** (one-to-many).
- **Site** can belong to a **Region**, **Zone**, and **Area** for organizational grouping.
- **User** can have a supervisor (self-relation) and can be part of a **Team**.

### Example Prisma Schema (Simplified)

```
model User {
  id        String @id @default(uuid())
  fullName  String
  email     String @unique
  role      String
  assignedRegion String[]
  assignedZone   String[]
  assignedWorkOrders  WorkOrder[]  @relation("WorkOrderAssignedTo")
  // ...other fields
}

model Site {
  id        String @id @default(uuid())
  name      String
  regionId  String
  zoneId    String?
  workOrders WorkOrder[]
  // ...other fields
}

model WorkOrder {
  id         String @id @default(uuid())
  title      String
  siteId     String
  site       Site   @relation(fields: [siteId], references: [id])
  assignedToId String?
  assignedTo User?  @relation("WorkOrderAssignedTo", fields: [assignedToId], references: [id])
  // ...other fields
}
```

### Visual Diagram

```
User (1) <--- assignedTo --- (M) WorkOrder (M) --- site ---> (1) Site
```
- One User can be assigned many WorkOrders.
- One Site can have many WorkOrders.
- Each WorkOrder is for one Site and (optionally) one User.

### Real-World Example
- A technician (User) is assigned to fix an issue at a specific site (Site).
- The work order (WorkOrder) records the task, links to the site, and is assigned to the technician.
- Managers and supervisors can view all work orders for their sites or teams.

### Why This Matters
- This structure allows tracking all maintenance tasks by location and responsible staff.
- Enables reporting, accountability, and efficient resource allocation.

---

## 8. Application Flow: From Login to Work Order Completion

### 1. User Login (Authentication)
- **Frontend:** User visits `/login` page and enters credentials.
- **Backend/API:**
  - The login form sends a POST request to the NextAuth API route (`/api/auth/callback/credentials`).
  - If the user exists in the database (seeded or registered), credentials are checked.
  - If the user is not seeded (not in DB), access is denied and a "No Access" page is shown.
- **Database:**
  - User data is stored in the `User` table (seeded via migration or admin panel).
- **Result:**
  - On success, a session is created and the user is redirected to their dashboard.
  - On failure, an error or no-access message is shown.

### 2. Dashboard & Data Fetching
- **Frontend:**
  - After login, the dashboard loads. It fetches user-specific data (work orders, teams, sites) using GET requests to API routes (e.g., `/api/workorders`, `/api/teams`).
- **Backend/API:**
  - API routes use GET methods to retrieve data from the database using Prisma.
- **Database:**
  - Queries are made to fetch all relevant records for the logged-in user (e.g., all work orders assigned to them).

### 3. Work Order Creation
- **Frontend:**
  - User (manager/supervisor) fills out the WorkOrderForm and submits.
  - The form sends a POST request to `/api/workorders` with the new work order data.
- **Backend/API:**
  - The API route validates the data and creates a new WorkOrder record in the database.
- **Database:**
  - A new row is inserted into the `WorkOrder` table, linked to the selected site and assigned user.
- **Result:**
  - The frontend updates to show the new work order in the list.

### 4. Work Order Processing & Status Updates
- **Frontend:**
  - Technicians and supervisors can update work order status (e.g., mark as completed, add notes).
  - These actions send PATCH or PUT requests to the API (e.g., `/api/workorders/[id]`).
- **Backend/API:**
  - The API route updates the relevant fields in the database.
- **Database:**
  - The `WorkOrder` record is updated (status, completion time, etc.).

### 5. Work Order Search & Filtering
- **Frontend:**
  - Users can search/filter work orders by site, task number, archived status, etc.
  - The UI sends GET requests with query parameters (e.g., `/api/workorders?siteId=...&archived=true`).
- **Backend/API:**
  - The API route parses query params and returns filtered results.

### 6. Access Control & No Access
- **Seeded Users:**
  - Only users present in the database (seeded or created by admin) can log in and access features.
- **Non-Seeded Users:**
  - If a user is not found in the DB, the backend denies access and the frontend shows a "No Access" page.

### 7. API Methods Used
- **GET:** Fetch data (work orders, users, sites, teams, etc.)
- **POST:** Create new records (work orders, users, teams)
- **PUT/PATCH:** Update existing records (work order status, user info)
- **DELETE:** Remove records (admin actions)

### 8. Example Flow: Work Order Lifecycle
1. **Manager logs in** (POST /api/auth/callback/credentials)
2. **Manager creates a work order** (POST /api/workorders)
3. **Technician views assigned work orders** (GET /api/workorders?assignedTo=techId)
4. **Technician updates status to completed** (PATCH /api/workorders/[id])
5. **Manager reviews and archives work order** (PATCH /api/workorders/[id])

### 9. Summary
- The app uses clear API methods for each action.
- All data is validated and stored in the database via Prisma.
- Access is strictly controlled by user presence in the DB.
- The frontend, backend, and database work together for a seamless workflow from login to task completion.

---

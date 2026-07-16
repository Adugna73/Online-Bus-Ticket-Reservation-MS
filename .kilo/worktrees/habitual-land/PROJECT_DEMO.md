# Online Bus Ticket Reservation Management System: Project Demo

## 1. Project Structure Overview

- **Frontend:**
  - `app/` — Next.js pages for each role and feature (admin, supervisor, mechanic, passenger, dashboard, login, reports, maintenance, etc.)
  - `components/` — Reusable React components (Sidebar, booking forms, bus tables, seat maps, etc.)
  - `public/` — Static assets (images, uploads)
  - `globals.css`, `tailwind.config.js` — Styling and theme

- **Backend/API:**
  - `app/api/` — API routes (e.g., `/api/bookings`, `/api/trips`, `/api/buses`, `/api/payments/chapa`, `/api/seats`)
  - `lib/` — Utility functions (auth, prisma client, payment services, helpers)

- **Database:**
  - `prisma/schema.prisma` — Prisma schema (see below for key models)
  - `prisma/migrations/` — Migration history

- **Other:**
  - `scripts/` — Seed and utility scripts
  - `data/` — Seed JSON files
  - `tests/` — Test files
  - `Dockerfile`, `docker-compose.yml` — Containerization

## 2. Frontend Flow

- Pages are organized by user role and feature (e.g., `app/admin/buses`, `app/supervisor/bookings`, `app/passenger/book-now`).
- Components are reused for UI consistency (e.g., Sidebar, SeatMap, BookingsTableClient).
- User actions (search, book, pay) trigger API calls using fetch.
- State management via React hooks and context.

## 3. Backend/API Flow

- API routes in `app/api/` handle requests from the frontend.
- Example: `app/api/trips/route.ts` lists available trips with seat availability.
- API routes use Prisma to query/update the database.
- Authentication handled via `lib/auth.ts` and NextAuth.js.

## 4. Database Schema (Prisma)

### User
```
model User {
  id           String   @id @default(cuid())
  fullName     String
  email        String   @unique
  phone        String?
  passwordHash String
  role         UserRole @default(PASSENGER)
  stationId    String?
  station      Station? @relation(fields: [stationId], references: [id])
  bookings     Booking[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

enum UserRole {
  PASSENGER
  STAFF
  ADMIN
  MECHANIC
}
```

### Station
```
model Station {
  id        String   @id @default(uuid())
  name      String
  city      String
  code      String   @unique
  address   String?
  staff     User[]
  routesFrom Route[] @relation("RouteOrigin")
  routesTo   Route[] @relation("RouteDestination")
}
```

### BusCompany & Bus
```
model BusCompany {
  id           String   @id @default(uuid())
  name         String   @unique
  contactEmail String?
  contactPhone String?
  buses        Bus[]
}

model Bus {
  id          String   @id @default(uuid())
  companyId   String
  company     BusCompany @relation(fields: [companyId], references: [id])
  plateNumber String   @unique
  model       String?
  seatLayout  Json?
  seatCount   Int
  status      String   @default("active")
  seats       Seat[]
  trips       Trip[]
  maintenances VehicleMaintenance[]
}
```

### Seat
```
model Seat {
  id          String   @id @default(uuid())
  busId       String
  bus         Bus      @relation(fields: [busId], references: [id])
  seatNumber  String
  seatType    SeatType @default(STANDARD)
  isActive    Boolean  @default(true)
  bookingSeats BookingSeat[]
  @@unique([busId, seatNumber])
}

enum SeatType {
  STANDARD
  VIP
}
```

### Route & Trip
```
model Route {
  id                    String   @id @default(uuid())
  originStationId       String
  destinationStationId  String
  originStation         Station @relation("RouteOrigin", ...)
  destinationStation    Station @relation("RouteDestination", ...)
  distanceKm            Int?
  defaultPrice          Float?
  trips                 Trip[]
  @@unique([originStationId, destinationStationId])
}

model Trip {
  id        String    @id @default(uuid())
  routeId   String
  busId     String
  departAt  DateTime
  arriveAt  DateTime
  basePrice Float
  status    TripStatus @default(SCHEDULED)
  route     Route     @relation(...)
  bus       Bus       @relation(...)
  bookings  Booking[]
  bookingSeats BookingSeat[]
}

enum TripStatus {
  SCHEDULED
  CANCELLED
  COMPLETED
}
```

### Booking & BookingSeat
```
model Booking {
  id         String        @id @default(uuid())
  bookingRef String        @unique
  userId     String
  tripId     String
  status     BookingStatus @default(PENDING)
  totalPrice Float
  passengerFullName String?
  passengerPhone    String?
  passengerEmail    String?
  user       User          @relation(...)
  trip       Trip          @relation(...)
  seats      BookingSeat[]
  payment    Payment?
  receipt    Receipt?
}

enum BookingStatus {
  PENDING
  CONFIRMED
  CANCELLED
  COMPLETED
}
```

### Payment & Receipt
```
model Payment {
  id             String        @id @default(uuid())
  bookingId      String        @unique
  method         PaymentMethod
  status         PaymentStatus @default(PENDING)
  amount         Float
  transactionRef String?
  paidAt         DateTime?
  booking        Booking       @relation(...)
}

enum PaymentMethod {
  TELEBIRR
  CBE_BIRR
  M_BIRR
  CASH
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
}

model Receipt {
  id              String   @id @default(uuid())
  bookingId       String   @unique
  receiptNumber   String   @unique
  pdfUrl          String?
  chapaReceiptUrl String?
  booking         Booking  @relation(...)
}
```

### Garage & VehicleMaintenance
```
model Garage {
  id           String   @id @default(uuid())
  name         String
  address      String?
  city         String?
  buses        Bus[]
  maintenances VehicleMaintenance[]
}

model VehicleMaintenance {
  id           String                  @id @default(uuid())
  busId        String
  garageId     String
  status       VehicleMaintenanceStatus @default(SCHEDULED)
  description  String?
  scheduledDate DateTime?
  completedDate DateTime?
  estimatedCost Float?
  actualCost   Float?
  bus          Bus                     @relation(...)
  garage       Garage                  @relation(...)
}
```

### Other Models
- SeatHold, SeatEvent (real-time seat locking)
- SupportTicket, ChatMessage, Dispute (support & disputes)
- TransactionLog, Refund, Escrow (payment audit chain)
- DynamicPricingRule, OperatorFraudFlag (operator tools)
- AgentBookingChannel, OfflineTicket, ChannelSession (offline/multi-channel)
- BusLocation, SosAlert (real-time tracking)
- Review, TravelBuddy, SafetyReport (social & community)
- TravelInsurance, CargoBooking, HotelPartner, GroupBooking (value-added services)
- CorporateAccount, GovernmentReport, NgoBulkBooking (enterprise & government)
- AnalyticsEvent, RouteHeatmap (analytics & BI)
- UserLoyalty, Badge, UserBadge, Referral (gamification)
- CustomerServiceAssignment (customer service)

## 5. Methods & Data Flow

### How Each Page Works

- **Login:**
  - User logs in via `/login`.
  - Auth logic in `lib/auth.ts` using NextAuth.js credentials provider.
  - Passwords are hashed with bcrypt.

- **Dashboard:**
  - Loads role-specific data (bookings, trips, revenue KPIs).
  - Uses API routes to fetch data.

- **Trip Search & Booking:**
  - Passenger searches trips by origin, destination, and date.
  - Selects seats from the seat map.
  - Form submits to `/api/bookings`, which creates a booking + payment record.

- **Payment:**
  - Redirects to Chapa hosted checkout (Telebirr/CBE Birr/M-Birr).
  - On success, payment is verified and receipt is generated.

- **Admin Management:**
  - Admin manages buses, routes, trips, stations, and users.
  - Uses CRUD API routes with role-based authorization.

- **API Example:**
  - Frontend calls `/api/trips` to list available trips.
  - API route queries DB via Prisma, returns JSON with seat availability.

## 6. Key Schema Relations: Trips, Bookings, and Users

### Entity Relationship Overview

- **User**: Represents passengers, staff, admins, and mechanics.
- **Trip**: Represents a scheduled bus trip on a route with a specific bus.
- **Booking**: Represents a ticket reservation, linked to a Trip and a User.

### How They Relate

- Each **Booking** is linked to one **Trip** (`tripId` foreign key).
- Each **Booking** belongs to one **User** (`userId` foreign key).
- Each **Trip** can have multiple **Bookings** (one-to-many).
- Each **Trip** uses one **Bus** on one **Route**.
- Each **Bus** has multiple **Seats**.
- Each **Booking** reserves one or more **Seats** via **BookingSeat**.

### Visual Diagram

```
User (1) <--- userId --- (M) Booking (M) --- tripId ---> (1) Trip (M) --- busId ---> (1) Bus (1) --- seats ---> (M) Seat
```

### Real-World Example
- A passenger (User) searches for a trip from Addis Ababa to Bahir Dar.
- They select a Trip, choose seats from the seat map, and create a Booking.
- Payment is processed via Chapa (Telebirr), and a PDF Receipt is generated.
- Staff and admins can view and manage all bookings.

## 7. Application Flow: From Login to Ticket Confirmation

### 1. User Login (Authentication)
- **Frontend:** User visits `/login` and enters email + password.
- **Backend/API:**
  - The login form sends credentials to NextAuth (`/api/auth/[...nextauth]`).
  - Password is verified against the bcrypt hash in the database.
- **Result:** On success, a session is created and the user is redirected to their dashboard.

### 2. Trip Search
- **Frontend:** Passenger enters origin, destination, and departure date.
- **Backend/API:** GET `/api/trips` returns matching trips with available seat counts.

### 3. Seat Selection & Booking
- **Frontend:** Passenger views the seat map (GET `/api/seats?tripId=...`).
- Seats can be temporarily held (POST `/api/seats` with action "hold").
- Passenger submits booking (POST `/api/bookings`).

### 4. Payment
- **Frontend:** Passenger is redirected to Chapa checkout.
- **Backend/API:** POST `/api/payments/chapa` initializes the transaction.
- On return, POST `/api/payments/chapa/verify` confirms the payment.
- A Receipt is auto-generated.

### 5. Receipt
- **Frontend:** Passenger views the receipt inline or downloads a PDF.
- GET `/api/receipts/[id]/pdf` generates a branded PDF receipt.

### 6. Booking Management
- Passengers view their bookings (GET `/api/bookings`).
- Staff/admins can approve manual payments (POST `/api/bookings/[id]/approve-payment`).
- Bookings can be cancelled (PATCH `/api/bookings/[id]`).

### 7. API Methods Used
- **GET:** Fetch data (trips, bookings, buses, seats, etc.)
- **POST:** Create new records (bookings, payments, trips, buses)
- **PUT/PATCH:** Update existing records (booking status, bus info)
- **DELETE:** Remove records (admin actions)

### 8. Example Flow: Booking Lifecycle
1. **Passenger logs in** (POST /api/auth/[...nextauth])
2. **Searches for trips** (GET /api/trips?origin=...&destination=...&date=...)
3. **Views seat map** (GET /api/seats?tripId=...)
4. **Creates booking** (POST /api/bookings)
5. **Pays via Chapa** (POST /api/payments/chapa → redirect → POST /api/payments/chapa/verify)
6. **Downloads receipt** (GET /api/receipts/[id]/pdf)

### 9. Summary
- The app uses clear API methods for each action.
- All data is validated with Zod and stored in PostgreSQL via Prisma.
- Access is role-based (PASSENGER, STAFF, ADMIN, MECHANIC).
- Payments are processed through the Chapa aggregator (Telebirr, CBE Birr, M-Birr).
- The frontend, backend, and database work together for a seamless booking workflow.

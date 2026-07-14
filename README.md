# Online Bus Ticket Reservation Management System

A web-based system for reserving bus tickets online, designed as a BSc graduation final project. Passengers can search trips, select seats, book tickets, pay via Ethiopian payment gateways (Telebirr, CBE Birr, M-Birr via Chapa), and receive digital receipts. Staff and admins manage buses, routes, trips, stations, garages, and vehicle maintenance.

## Tech Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** NextAuth.js (credentials provider, bcrypt password hashing)
- **Payments:** Chapa aggregator (Telebirr / CBE Birr / M-Birr)
- **UI:** Tailwind CSS, shadcn/ui, Radix UI, Heroicons
- **Validation:** Zod
- **PDF:** pdf-lib (receipt generation)
- **Containerization:** Docker + docker-compose

## Getting Started

### Prerequisites

- Node.js v18+
- PostgreSQL (or use Docker)
- npm

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example env file and update values:

```bash
cp .env.example .env
```

Key settings:

```
DATABASE_URL="postgresql://online_bus_user:changeme@localhost:5432/online_bus_db?schema=public"
NEXTAUTH_SECRET="generate-with-openssl-rand-hex-32"
NEXTAUTH_URL="http://localhost:3000"
CHAPA_SECRET_KEY=CHASECK_TEST-xxxxxxxxxxxx
```

### 3. Run PostgreSQL with Docker (optional)

```bash
docker run --rm -e POSTGRES_PASSWORD=changeme -e POSTGRES_DB=online_bus_db -p 5432:5432 -d postgres:15
```

### 4. Run Prisma migrations & generate client

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 5. Seed demo data

```bash
npm run seed:all
```

This seeds bus companies, buses, stations, routes, trips, demo users, and the 12 gap-filling feature stubs.

### 6. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
app/
  api/              API routes (auth, bookings, payments, trips, buses, etc.)
  admin/            Admin dashboard pages
  supervisor/       Supervisor (station staff) pages
  mechanic/         Mechanic / vehicle maintenance pages
  passenger/        Passenger booking pages
  dashboard/        Shared dashboard
  login/            Login page
  reports/          Reports & analytics
  maintenance/      Vehicle maintenance management
components/         Reusable React components (Sidebar, forms, tables, etc.)
lib/                Utilities (auth, prisma client, services, helpers)
prisma/             Prisma schema & migrations
scripts/            Seed & utility scripts
data/               Seed JSON data
public/             Static assets (images, uploads)
tests/              Test files
```

## Database Schema Overview

Core models:

| Model | Description |
|-------|-------------|
| `User` | Passengers, staff, admins, mechanics |
| `Station` | Bus stations / terminals |
| `BusCompany` | Bus operating companies |
| `Bus` | Individual buses with seat layouts |
| `Seat` | Seats on a bus |
| `Route` | Origin → destination station pairs |
| `Trip` | Scheduled bus trips on a route |
| `Booking` | Ticket bookings with passenger details |
| `BookingSeat` | Seats reserved in a booking |
| `Payment` | Payment records (Telebirr/CBE/M-Birr/Cash) |
| `Receipt` | Digital receipts (PDF) |
| `Garage` | Vehicle maintenance garages |
| `VehicleMaintenance` | Maintenance records per bus |

The schema also includes 12 gap-filling feature modules (payments/escrow, seat locking, support tickets, operator tools, offline channels, real-time tracking, social/reviews, value-added services, enterprise/government, analytics, gamification, accessibility).

## User Roles

| Role | Access |
|------|--------|
| `PASSENGER` | Search trips, book tickets, pay, view receipts, reviews, loyalty |
| `STAFF` | Station operations, manage bookings, approve payments |
| `ADMIN` | Full system management (buses, routes, trips, users, reports) |
| `MECHANIC` | Vehicle maintenance & garage management |

## Payment Integration

Payments are processed through the [Chapa](https://chapa.co) aggregator, which wraps Telebirr, CBE Birr, and M-Birr. Set `CHAPA_SECRET_KEY` in `.env` to enable live payments. Use `PAYMENT_TEST_MODE=1` for local testing (forces 1 ETB per transaction).

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests (Vitest) |
| `npm run seed:all` | Seed all demo data |
| `npm run seed:bus` | Seed bus/route/trip data |
| `npm run seed:gap` | Seed gap-filling feature stubs |

## Deployment

### Docker

```bash
docker-compose up -d
```

### Vercel

The easiest way to deploy is via the [Vercel Platform](https://vercel.com/new). See the [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for details.

## Documentation

- [Project Demo & Architecture](PROJECT_DEMO.md)
- [API Endpoints & Samples](ENDPOINTS_AND_SAMPLES.md)
- [Team Collaboration Guide](TEAM_GUIDE.md)
# Online-Bus-Ticket-Reservation-MS
# Online-Bus-Ticket-Reservation-MS

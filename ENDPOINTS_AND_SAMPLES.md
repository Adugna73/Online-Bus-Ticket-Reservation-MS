# API Endpoints and Sample Test Data

This file lists the API endpoints found under `app/api/**` and provides concise sample requests you can paste into Postman or use with curl.

Base URL (dev): `http://localhost:3000`

Auth: send your session cookie (NextAuth) or set header `Authorization: Bearer {{authToken}}` / `x-api-key: {{API_KEY}}` where applicable.

---

## Auth

- POST /api/auth/signup
  - Register a new passenger:
    ```json
    {"fullName":"John Doe","email":"john@example.com","phone":"+251912345678","password":"Password123!"}
    ```

- POST /api/auth/login
  - Demo login (sets session cookie):
    ```json
    {"email":"john@example.com","password":"Password123!"}
    ```

- POST /api/auth/logout
  - Clears the session cookie.

- GET /api/auth/me
  - Returns the current user from the session.

---

## Users

- GET /api/users
  - Query: `?role=PASSENGER&email=...`

- POST /api/users
  - Create a user (admin/staff only):
    ```json
    {"fullName":"Jane Doe","email":"jane@example.com","phone":"+251987654321","role":"STAFF","password":"Password123!"}
    ```

- GET /api/users/me
  - Returns the authenticated user's full profile.

- GET /api/users/:id
  - Fetch a single user.

- PUT /api/users/:id
  - Update a user:
    ```json
    {"fullName":"Updated Name","role":"ADMIN"}
    ```

- DELETE /api/users/:id
  - Delete a user (admin only).

---

## Profile

- GET /api/profile
  - Returns the authenticated passenger's profile.

- PUT /api/profile
  - Update own profile (passenger only):
    ```json
    {"fullName":"Updated Name","phone":"+251911223344"}
    ```

---

## Stations

- GET /api/stations
  - Lists stations (name, code).

- POST /api/stations
  - Create a station (admin/supervisor only):
    ```json
    {"name":"Addis Ababa Terminal","city":"Addis Ababa","code":"AAD","address":"Megenagna"}
    ```

---

## Routes

- GET /api/routes
  - Lists bus routes with origin/destination stations.

- POST /api/routes
  - Create a route (admin/supervisor only):
    ```json
    {"originStationId":"station_1","destinationStationId":"station_2","distanceKm":560,"defaultPrice":450}
    ```

- PATCH /api/routes
  - Update a route (id in body):
    ```json
    {"id":"route_1","defaultPrice":500}
    ```

- DELETE /api/routes?id=route_1
  - Delete a route.

---

## Buses

- GET /api/buses
  - Lists buses with company info.

- POST /api/buses
  - Create a bus and auto-generate seats (admin/supervisor only):
    ```json
    {"companyId":"company_1","plateNumber":"AA123456","model":"Hyundai","seatCount":44,"level":"2x2"}
    ```

- PATCH /api/buses
  - Update a bus (id in body):
    ```json
    {"id":"bus_1","driverName":"Abebe","status":"active"}
    ```

- POST /api/buses/:id/image
  - Upload a bus image (base64):
    ```json
    {"base64":"data:image/png;base64,..."}
    ```

---

## Trips

- GET /api/trips
  - Lists trips with bus, route, and booked/available seat counts.
  - Query: `?origin=...&destination=...&date=...`

- POST /api/trips
  - Create a trip (admin/supervisor only):
    ```json
    {"routeId":"route_1","busId":"bus_1","departAt":"2026-01-15T06:00:00.000Z","arriveAt":"2026-01-15T14:00:00.000Z","basePrice":450}
    ```

- GET /api/trips/:id
  - Fetch a single trip with seat map (booked status per seat).

---

## Seats

- GET /api/seats?tripId=...
  - Returns the seat map for a trip with hold/booked status.

- POST /api/seats
  - Hold a seat:
    ```json
    {"action":"hold","tripId":"trip_1","seatId":"seat_1"}
    ```
  - Release a hold:
    ```json
    {"action":"release","tripId":"trip_1","seatId":"seat_1"}
    ```
  - Book seats:
    ```json
    {"action":"book","tripId":"trip_1","seatIds":["seat_1","seat_2"]}
    ```

---

## Bookings

- GET /api/bookings
  - Lists bookings (passengers see their own; staff/admin see all).
  - Query: `?status=PENDING&paymentStatus=PENDING`

- POST /api/bookings
  - Create a booking:
    ```json
    {
      "tripId":"trip_1",
      "seatIds":["seat_1","seat_2"],
      "passengerFullName":"John Doe",
      "passengerPhone":"+251912345678",
      "passengerEmail":"john@example.com",
      "paymentMethod":"TELEBIRR",
      "markPaid":false
    }
    ```

- GET /api/bookings/:id
  - Fetch a single booking with payment, receipt, seats, trip, bus, route.

- POST /api/bookings/:id/approve-payment
  - Approve a manual payment (admin/staff only).

- POST /api/bookings/:id/payment-proof
  - Upload a payment proof file (base64):
    ```json
    {"base64":"data:image/png;base64,...","fileName":"proof.png"}
    ```

---

## Payments

- GET /api/payments
  - Lists the current user's payments.

- POST /api/payments
  - Charge a booking:
    ```json
    {"action":"charge","bookingId":"booking_1","method":"TELEBIRR"}
    ```
  - Refund a payment:
    ```json
    {"action":"refund","paymentId":"payment_1","amount":450}
    ```
  - Release escrow:
    ```json
    {"action":"release_escrow","bookingId":"booking_1"}
    ```

- GET /api/payments/:id
  - Fetch a payment with escrow, refunds, and audit log.

---

## Payments — Chapa Gateway

- POST /api/payments/chapa
  - Initialize a Chapa checkout:
    ```json
    {"bookingId":"booking_1","method":"TELEBIRR"}
    ```
  - Returns `checkout_url` for redirect.

- POST /api/payments/chapa/verify
  - Verify a transaction after redirect:
    ```json
    {"tx_ref":"tx_12345"}
    ```

- POST /api/payments/chapa/recover
  - Recover a dropped PENDING payment.

- POST /api/payments/chapa/charge
  - Direct in-app charge (initiate/authorize OTP).

- POST /api/payments/chapa/cancel
  - Cancel an active checkout:
    ```json
    {"tx_ref":"tx_12345"}
    ```

- POST /api/payments/chapa/webhook
  - Chapa callback endpoint (no session required).

---

## Receipts

- GET /api/receipts/:id
  - Fetch receipt details (booking, passenger, trip, payment).

- GET /api/receipts/:id/pdf
  - Download a branded PDF receipt.

---

## Dashboard

- GET /api/dashboard/trends
  - Returns KPIs, 6-month monthly trends, top routes, status/payment distributions, recent trips.

---

## Reports

- GET /api/reports/comprehensive
  - Comprehensive booking report.
  - Query: `?startDate=2026-01-01&endDate=2026-01-31&routeId=...&status=...`

---

## Garages

- GET /api/garages
  - Lists garages with buses and counts.

- POST /api/garages
  - Create a garage:
    ```json
    {"name":"Central Garage","city":"Addis Ababa","contactPhone":"+251911000000"}
    ```

- PATCH /api/garages
  - Update a garage (id in body).

- DELETE /api/garages?id=...
  - Delete a garage.

---

## Vehicle Maintenance

- GET /api/vehicle-maintenance
  - Lists maintenance records.
  - Query: `?busId=...&garageId=...&status=SCHEDULED`

- POST /api/vehicle-maintenance
  - Create a maintenance record:
    ```json
    {"busId":"bus_1","garageId":"garage_1","description":"Oil change","scheduledDate":"2026-01-20T08:00:00.000Z","estimatedCost":1500}
    ```

- PATCH /api/vehicle-maintenance
  - Update a maintenance record (id in body).

- DELETE /api/vehicle-maintenance?id=...
  - Delete a maintenance record.

---

## Maintenance Templates

- GET /api/maintenance/templates
  - Returns maintenance templates from `data/maintenance-templates.json`.

- GET /api/maintenance/categories
  - Returns available maintenance categories.

---

## Support

- GET /api/support
  - Lists support tickets (passengers see own; staff/admin see all).

- POST /api/support
  - Create a ticket:
    ```json
    {"action":"ticket","subject":"Booking issue","priority":"HIGH","bookingId":"booking_1"}
    ```
  - Add a message:
    ```json
    {"action":"message","ticketId":"ticket_1","content":"Please help"}
    ```

- GET /api/support/:id
  - Fetch a ticket with messages.

- PATCH /api/support/:id
  - Update ticket status (staff/admin only):
    ```json
    {"status":"RESOLVED"}
    ```

---

## Support — Disputes

- GET /api/support/disputes
  - Lists disputes.

- POST /api/support/disputes
  - Create a dispute:
    ```json
    {"bookingId":"booking_1","reason":"Wrong seat assigned"}
    ```

---

## CS Assignments

- GET /api/cs-assignments
  - Lists customer-service assignments.

- POST /api/cs-assignments
  - Create a CS assignment:
    ```json
    {"userId":"user_1","type":"REFUND","location":"Addis Ababa","description":"Refund request"}
    ```

- PATCH /api/cs-assignments
  - Update (id in body).

- DELETE /api/cs-assignments?id=...
  - Delete.

---

## Operator Tools

- GET /api/operator
  - Returns revenue dashboard, pricing rules, fraud flags.
  - Query: `?computePrice=...` to compute dynamic price.

- POST /api/operator
  - Create a pricing rule:
    ```json
    {"kind":"rule","routeId":"route_1","minFillPct":0,"maxFillPct":50,"multiplier":1.2}
    ```
  - Create a fraud flag:
    ```json
    {"kind":"flag","busId":"bus_1","reason":"Suspicious activity","severity":"high"}
    ```

- PATCH /api/operator/:id
  - Update a pricing rule.

- DELETE /api/operator/:id
  - Delete a pricing rule.

---

## Analytics

- GET /api/analytics
  - Returns BI dashboard summary + heatmap (admin/manager only).
  - Query: `?kind=heatmap` for heatmap only.

- POST /api/analytics
  - Track an event:
    ```json
    {"action":"track","kind":"page_view","meta":{"page":"bookings"}}
    ```
  - Recompute heatmap:
    ```json
    {"action":"recompute"}
    ```

---

## Tracking

- GET /api/tracking
  - Trip tracking: `?tripId=...`
  - Latest bus location: `?busId=...`
  - SOS alerts: `?sos=1`

- POST /api/tracking
  - Report bus location:
    ```json
    {"action":"location","busId":"bus_1","tripId":"trip_1","lat":9.03,"lng":38.74,"speed":60}
    ```
  - Raise SOS:
    ```json
    {"action":"sos","busId":"bus_1","lat":9.03,"lng":38.74}
    ```

- PATCH /api/tracking/:id
  - Resolve an SOS alert (admin/staff only).

---

## Social

- GET /api/social
  - Reviews/buddies: `?tripId=...`
  - Safety reports: `?safety=1`
  - Buddies only: `?buddies=1&tripId=...`

- POST /api/social
  - Create a review:
    ```json
    {"action":"review","bookingId":"booking_1","rating":5,"comment":"Great trip"}
    ```
  - Opt-in as travel buddy:
    ```json
    {"action":"buddy","tripId":"trip_1"}
    ```
  - Report safety issue:
    ```json
    {"action":"safety","bookingId":"booking_1","category":"Driving","description":"Speeding"}
    ```

- DELETE /api/social/:id
  - Delete a review (author or staff/admin only).

---

## Value-Added Services (VAS)

- GET /api/vas?kind=insurance|cargo|hotel|group
  - Lists VAS by kind.

- POST /api/vas
  - Buy insurance:
    ```json
    {"kind":"insurance","bookingId":"booking_1","premium":25}
    ```
  - Create cargo shipment:
    ```json
    {"kind":"cargo","tripId":"trip_1","senderPhone":"+251912345678","weightKg":10,"price":100}
    ```
  - Group booking:
    ```json
    {"kind":"group","tripId":"trip_1","seatsCount":10}
    ```

---

## Enterprise & Government

- GET /api/enterprise?kind=corporate|gov|ngo
  - Lists enterprise records (admin only).

- POST /api/enterprise
  - Create corporate account:
    ```json
    {"kind":"corporate","name":"ABC Corp","billingEmail":"finance@abccorp.com","creditLimit":50000}
    ```
  - Generate government report:
    ```json
    {"kind":"gov","period":"2026-Q1","taxCollected":150000}
    ```

- PATCH /api/enterprise/:id
  - Update a corporate account (admin only).

---

## Accessibility

- GET /api/accessibility
  - Lists accessible buses/trips.
  - Query: `?trips=1&wheelchair=1&womenOnly=1`

- POST /api/accessibility
  - Update accessibility flags on a bus:
    ```json
    {"busId":"bus_1","wheelchairAccessible":true,"womenOnly":false}
    ```

- PATCH /api/accessibility/:id
  - Update accessibility flags by bus id.

---

## Gamification

- GET /api/gamification
  - Returns the user's loyalty points, badges, and referrals.

- POST /api/gamification
  - Create a referral:
    ```json
    {"action":"referral","referredEmail":"friend@example.com"}
    ```
  - Redeem a referral:
    ```json
    {"action":"redeem","referralId":"ref_1"}
    ```

---

## Channels (Offline / Multi-Channel)

- GET /api/channels
  - Lists agents, offline tickets, and sessions.

- POST /api/channels
  - Create an agent:
    ```json
    {"action":"agent","agentName":"Agent 1","phone":"+251912345678","commissionPct":5}
    ```
  - Issue offline ticket:
    ```json
    {"action":"offline","bookingId":"booking_1"}
    ```
  - Start a session:
    ```json
    {"action":"session","channel":"SMS","msisdn":"+251912345678"}
    ```

- PATCH /api/channels/:id
  - Update an agent booking channel.

---

## Features Discovery

- GET /api/features
  - Public endpoint listing all 12 gap features with status/priority/capabilities.

---

## Public Images

- GET /api/public-images
  - Lists image files in `/public/images` (no auth).

---

## Usage notes
- Authenticate first via `/api/auth/login` or NextAuth and reuse the session cookie.
- For file uploads (bus image, payment proof), send base64-encoded data in JSON.
- All POST/PUT/PATCH bodies are JSON (`Content-Type: application/json`).
- Role-based access: `PASSENGER`, `STAFF`, `ADMIN`, `MECHANIC`.

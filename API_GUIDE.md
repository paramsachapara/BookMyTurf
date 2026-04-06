# E-Management API Guide

This guide lists **all APIs** with request/response examples and the **step-by-step order** in which to implement them.

**Base URL:** `http://localhost:4000/api`

**Authentication:** For protected routes, send header: `Authorization: Bearer <token>`

---

## Implementation Order (Step-by-Step)

Implement APIs in this order so each step has the data and auth it needs:

| Step | API | Why this order |
|------|-----|----------------|
| **1** | POST `/auth/register` | Create users and (for `club_owner`) create club. No dependencies. |
| **2** | POST `/auth/login` | Get token for all other requests. |
| **3** | GET `/owner/club` | Club owner reads their club (created in step 1). |
| **4** | PUT `/owner/club` | Club owner updates club details. |
| **5** | POST `/owner/yard` | Create yards for the club. Requires club. |
| **6** | GET `/owner/yards` | List all yards of the club. |
| **7** | PUT `/owner/yard/:id` | Update a yard. |
| **8** | DELETE `/owner/yard/:id` | Delete a yard. |
| **9** | POST `/booking` | Create booking (start_time, end_time, yard(s) + club; optional negotiated price + advance). |
| **10** | PUT `/booking/:id` | Update booking (payment/status or start_time/end_time). |
| **11** | PUT `/booking/:id/settlement` | Final settlement after match (remaining online/cash). |
| **12** | GET `/booking/my-bookings` | User/owner/admin views their bookings. |
| **13** | GET `/owner/bookings` | Club owner views all club bookings. |
| **14** | GET `/owner/history` | History: totals, payment breakdown, yard-wise; optional date/yard filters. |
| **15** | GET `/admin/clubs` | Super admin lists all clubs. |
| **16** | PUT `/admin/club/:id` | Super admin (or owner for own club) updates any club. |
| **17** | DELETE `/admin/yard/:id` | Super admin or owner deletes a yard. |
| **18** | GET `/admin/bookings` | Super admin lists all bookings. |
| **19** | GET `/admin/history` | History: same as owner, with optional club filter. |
| **20** | GET `/analytics/bookings` | Analytics: booking summary and income stats for date range. |
| **21** | GET `/analytics/trends` | Analytics: daily booking trends and statistics. |

**Removed APIs:** Slot and Add-On APIs have been removed from the codebase. Bookings use **start_time** and **end_time**; price is computed from yard(s) only.

---

## How to: Date parameters (Yards, Bookings, History)

Use the following query parameters to filter by date:

### Yards API – fetch slot availability by date

- **Endpoint:** `GET /owner/yards`
- **`date`** (required): Query param in **YYYY-MM-DD** format. Returns yards with `bookedSlots` for that date only.
- **Validation:** If `date` is missing or invalid, the API returns **400** with a clear message.

**Example:**

```
GET {{baseUrl}}/owner/yards?date=2024-02-20
```

**Error (400):**  
- Missing date: `"date is required. Pass date in YYYY-MM-DD format to fetch slot availability."`  
- Invalid date: `"Invalid date. Use YYYY-MM-DD format (e.g. 2024-02-20)."`

---

### Bookings API – retrieve bookings by date

- **Endpoint:** `GET /owner/bookings`
- **`date`** (required): Query param in **YYYY-MM-DD** format. Returns only bookings for that day (filtered by `bookingDate`).
- **Validation:** If `date` is missing or invalid, the API returns **400** with a clear message.

**Example:**

```
GET {{baseUrl}}/owner/bookings?date=2024-02-20
```

**Error (400):**  
- Missing date: `"date is required. Pass date in YYYY-MM-DD format to retrieve bookings."`  
- Invalid date: `"Invalid date. Use YYYY-MM-DD format (e.g. 2024-02-20)."`

---

### History API – fetch historical data by date range

- **Endpoints:** `GET /owner/history` (owner), `GET /admin/history` (admin)
- **`start_date`** (required): Query param in **YYYY-MM-DD** format. Fetches data from this date onward.
- **`end_date`** (optional): In **YYYY-MM-DD** format. When provided with `start_date`, returns data only within the range from `start_date` to `end_date` (inclusive).
- **Validation:** If `start_date` is missing or invalid, or if `end_date` is invalid when provided, the API returns **400** with a clear message.
- **Aliases:** `fromDate` and `toDate` are accepted as aliases for `start_date` and `end_date`.

**Error (400):**  
- Missing start_date: `"start_date is required. Pass start_date in YYYY-MM-DD format to fetch historical data."`  
- Invalid start_date: `"Invalid start_date. Use YYYY-MM-DD format (e.g. 2024-02-01)."`  
- Invalid end_date: `"Invalid end_date. Use YYYY-MM-DD format (e.g. 2024-02-28)."`

**Examples:**

```
# From a single date onward
GET {{baseUrl}}/owner/history?start_date=2024-02-01

# Date range (start_date to end_date)
GET {{baseUrl}}/owner/history?start_date=2024-02-01&end_date=2024-02-28

# With yard filter
GET {{baseUrl}}/owner/history?start_date=2024-02-01&end_date=2024-02-28&yardId=<yard_id>
```

---

## 1. Authentication APIs

### 1.1 Register User

- **Step:** 1  
- **URL:** `POST {{baseUrl}}/auth/register`  
- **Auth:** None  

**Request Body (JSON):**

```json
{
  "name": "Jane Owner",
  "email": "jane@owner.com",
  "password": "Password123",
  "role": "club_owner",
  "club": "Elite Sports Club",
  "clubAddress": "123 Main St",
  "clubCity": "New York",
  "clubState": "NY",
  "isActive": true
}
```

**Success Response (201):**

```json
{
  "message": "User registered successfully",
  "user": {
    "_id": "...",
    "name": "Jane Owner",
    "email": "jane@owner.com",
    "role": "club_owner",
    "club": "Elite Sports Club",
    "clubAddress": "123 Main St",
    "clubCity": "New York",
    "clubState": "NY",
    "isActive": true
  }
}
```

**Error Response (400):** `{ "message": "Email already registered. Please use a different email." }`

---

### 1.2 Login

- **Step:** 2  
- **URL:** `POST {{baseUrl}}/auth/login`  
- **Auth:** None  

**Request Body (JSON):**

```json
{
  "email": "jane@owner.com",
  "password": "Password123"
}
```

**Success Response (200):**

```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "name": "Jane Owner",
    "email": "jane@owner.com",
    "role": "club_owner",
    "assignedShops": []
  }
}
```

**Error Responses (400):**  
`{ "message": "Email and password are required" }`  
`{ "message": "User not found" }`  
`{ "message": "Invalid credentials" }`  
`{ "message": "User is not active contact to admin" }`

---

## 2. Club Owner – Club APIs

### 2.1 Get Club Details

- **Step:** 3  
- **URL:** `GET {{baseUrl}}/owner/club`  
- **Auth:** Bearer (role: `club_owner`)  

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "_id": "...",
    "name": "Elite Sports Club",
    "ownerId": "...",
    "address": "123 Main St",
    "city": "New York",
    "state": "NY",
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Error:** `404` – `{ "success": false, "message": "Club not found" }`

---

### 2.2 Update Club Details

- **Step:** 4  
- **URL:** `PUT {{baseUrl}}/owner/club`  
- **Auth:** Bearer (role: `club_owner`)  

**Request Body (JSON):**

```json
{
  "name": "New Club Name",
  "address": "New Address",
  "city": "Boston",
  "state": "MA"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "_id": "...",
    "name": "New Club Name",
    "ownerId": "...",
    "address": "New Address",
    "city": "Boston",
    "state": "MA",
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Error:** `400` – empty body; `404` – club not found.

---

## 3. Club Owner – Yard APIs

### 3.1 Create Yard

- **Step:** 5  
- **URL:** `POST {{baseUrl}}/owner/yard`  
- **Auth:** Bearer (role: `club_owner`)  

**Request Body (JSON):**

```json
{
  "name": "Tennis Court A",
  "gameType": "Tennis",
  "pricePerHour": 50
}
```

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "_id": "...",
    "clubId": "...",
    "name": "Tennis Court A",
    "gameType": "Tennis",
    "pricePerHour": 50,
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

---

### 3.2 Get All Yards

- **Step:** 6  
- **URL:** `GET {{baseUrl}}/owner/yards`  
- **Auth:** Bearer (role: `club_owner`)  

Returns all yards of the club. Each yard includes **bookedSlots**: the list of booked time slots for that yard. Each slot has **date-wise** fields: `start_time`, `end_time`, `bookingDate` (ISO), and **`date`** (YYYY-MM-DD) for the calendar day of the booking. **`date`** query param is **required** (YYYY-MM-DD) to fetch slot availability for a specific day.

**Query parameters:**

| Param   | Type   | Required | Description                                                                 |
|--------|--------|----------|-----------------------------------------------------------------------------|
| `date` | string | **Yes**  | Date in YYYY-MM-DD format (e.g. `2024-02-20`) to show slots for that date only. |

**Success Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "clubId": "...",
      "name": "Yard 1",
      "gameType": "Cricket",
      "pricePerHour": 500,
      "isActive": true,
      "createdAt": "...",
      "updatedAt": "...",
      "bookedSlots": [
        { "start_time": "08:00", "end_time": "09:00", "bookingDate": "2024-02-20T00:00:00.000Z", "date": "2024-02-20" },
        { "start_time": "09:00", "end_time": "10:00", "bookingDate": "2024-02-20T00:00:00.000Z", "date": "2024-02-20" },
        { "start_time": "10:00", "end_time": "11:00", "bookingDate": "2024-02-20T00:00:00.000Z", "date": "2024-02-20" }
      ]
    },
    {
      "_id": "...",
      "name": "Yard 2",
      "gameType": "Cricket",
      "bookedSlots": [
        { "start_time": "09:00", "end_time": "10:00", "bookingDate": "2024-02-20T00:00:00.000Z", "date": "2024-02-20" },
        { "start_time": "10:00", "end_time": "11:00", "bookingDate": "2024-02-20T00:00:00.000Z", "date": "2024-02-20" }
      ]
    }
  ]
}
```

- **bookedSlots**: Non-cancelled bookings for this yard. Each slot has `start_time`, `end_time`, `bookingDate` (ISO), and **`date`** (YYYY-MM-DD) for date-wise display. **date** query param is required (YYYY-MM-DD). Empty array if no bookings for that date.

**Error (400):** Missing date: `"date is required. Pass date in YYYY-MM-DD format to fetch slot availability."` — Invalid date: `"Invalid date. Use YYYY-MM-DD format (e.g. 2024-02-20)."`

---

### 3.3 Update Yard

- **Step:** 7  
- **URL:** `PUT {{baseUrl}}/owner/yard/:id`  
- **Auth:** Bearer (role: `club_owner`)  

**Request Body (JSON):**

```json
{
  "name": "Tennis Court A - Premium",
  "pricePerHour": 60
}
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "_id": "...",
    "clubId": "...",
    "name": "Tennis Court A - Premium",
    "gameType": "Tennis",
    "pricePerHour": 60,
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Error:** `404` – `{ "success": false, "message": "Yard not found or unauthorized" }`

---

### 3.4 Delete Yard

- **Step:** 8  
- **URL:** `DELETE {{baseUrl}}/owner/yard/:id`  
- **Auth:** Bearer (role: `club_owner`)  

**Success Response (200):**

```json
{
  "success": true,
  "message": "Yard deleted"
}
```

**Error:** `404` – yard not found or unauthorized.

---

## 4. Booking APIs (User / Owner / Admin)

### 4.1 Create Booking

- **Step:** 9  
- **URL:** `POST {{baseUrl}}/booking`  
- **Auth:** Bearer (role: `club_owner` or `super_admin`)  
- **Note:** `user` role cannot create bookings directly.

**Time-based booking:** You must pass **start_time** and **end_time** (e.g. `"09:00"`, `"10:00"`). No slot selection.

**Multiple yards:** You can book multiple yards for the **same** time slot in one booking (e.g. Cricket Yard 1 and Cricket Yard 2 from 9:00–10:00). Pass **yardIds** (array) or a single **yardId**. Total price = sum of each yard’s price (e.g. Yard 1 ₹500 + Yard 2 ₹500 = ₹1000). The response and all list/history APIs include **yardBreakdown** (per-yard amount) and **yardBreakdownWithAdvance** (per-yard amount with advance proportionally applied).

**Validation:** If the same yard already has a booking for the same start/end time on the same date, the API returns **400** with a message that the time slot is already booked for that yard. Multiple yards are allowed for the same time if each yard is free.

**Advance booking:** **userName** and **mobileNumber** are **mandatory**. **Advance payment:** Send `advance_payment_received: true` and `advance_payment_online`, `advance_payment_cash` as needed.

**Request Body (JSON):**

```json
{
  "yardIds": ["<yard_id_1>", "<yard_id_2>"],
  "clubId": "<club _id>",
  "start_time": "09:00",
  "end_time": "10:00",
  "bookingDate": "2024-02-20",
  "userName": "John Doe",
  "mobileNumber": "9876543210",
  "userId": "<optional>",
  "price": 1000,
  "negotiatedAmount": 900,
  "advance_payment_received": true,
  "advance_payment_online": 300,
  "advance_payment_cash": 200
}
```

- **yardIds** (required): Array of yard IDs, or use **yardId** (single) instead. All yards must belong to **clubId**.
- **start_time**, **end_time** (required): e.g. `"09:00"`, `"10:00"`. End must be after start.
- **bookingDate** (required): Date of the booking.
- **userName**, **mobileNumber** (required for advance booking).
- **price** (optional): Amount to use as **originalAmount** for this booking. If provided, this value is stored as the booking’s original amount and is what **History API** and **Owner Bookings list API** return as **originalAmount**. If omitted, originalAmount is computed from yard prices (pricePerHour × duration, summed for all yards). Per-yard breakdown (**yardBreakdown**) is scaled so it sums to this value when **price** is passed.
- **negotiatedAmount** (optional): Final agreed total. Omit to use **price** (or computed original) as total.
- **advance_payment_received**, **advance_payment_online**, **advance_payment_cash** (optional).

**Success Response (201):**

```json
{
  "success": true,
  "originalAmount": 1000,
  "totalAmount": 900,
  "advancePaymentReceived": true,
  "booking": {
    "_id": "...",
    "userId": "...",
    "clubId": "...",
    "yardId": "...",
    "yardIds": ["...", "..."],
    "start_time": "09:00",
    "end_time": "10:00",
    "bookingDate": "2024-02-20T00:00:00.000Z",
    "yardBreakdown": [
      { "yardId": "...", "yardName": "Cricket Yard 1", "amount": 500 },
      { "yardId": "...", "yardName": "Cricket Yard 2", "amount": 500 }
    ],
    "originalAmount": 1000,
    "totalAmount": 900,
    "advancePaymentReceived": true,
    "advancePaymentOnline": 300,
    "advancePaymentCash": 200,
    "settlementDone": false,
    "paymentStatus": "pending",
    "bookingStatus": "confirmed",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Error:** `400` – missing `start_time`/`end_time` or yards; same time slot already booked for that yard; `403` – users cannot book directly.

---

### 4.2 Update Booking

- **Step:** 10  
- **URL:** `PUT {{baseUrl}}/booking/:id`  
- **Auth:** Bearer (role: `club_owner` or `super_admin`)  

You can update **paymentStatus**, **bookingStatus**, **start_time** / **end_time**, and/or **addOns** (e.g. water, drink). Add-ons recalculate total; **addonceAmount** is shown in owner/bookings and owner/history. When updating time, the same overlap validation applies: the new slot must not be already booked for any of the booking’s yards on that date.

**Request Body (JSON):**

```json
{
  "paymentStatus": "paid",
  "bookingStatus": "confirmed",
  "start_time": "10:00",
  "end_time": "11:00",
  "addOns": [
    { "name": "Water", "price": 20, "quantity": 2 },
    { "name": "Drink", "price": 30, "quantity": 1 }
  ]
}
```

- `paymentStatus`: `pending` | `paid` | `failed`  
- `bookingStatus`: `confirmed` | `cancelled`  
- `start_time`, `end_time` (optional): Both must be sent together; same validation as create.  
- `addOns` (optional): Array of `{ name, price, quantity }`. Replaces add-ons and recalculates total.

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "_id": "...",
    "userId": "...",
    "clubId": "...",
    "yardId": "...",
    "yardIds": [...],
    "start_time": "10:00",
    "end_time": "11:00",
    "bookingDate": "...",
    "yardBreakdown": [...],
    "addOns": [{ "name": "Water", "price": 20, "quantity": 2 }],
    "totalAmount": 1000,
    "addoneAmount": 40,
    "paymentStatus": "paid",
    "bookingStatus": "confirmed",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

- **totalAmount**: Base amount only (yard/original). Does **not** include add-ons.
- **addoneAmount**: Add-ons total (sum of price × quantity). Shown in owner/bookings and owner/history. Full bill = totalAmount + addoneAmount; amount to pay = bill − negotiatedDiscount.

**Error:** `404` – Booking not found; `403` – not allowed to update; `400` – time slot already booked for same yard.

---

### 4.2.0 Cancel Booking

- **URL:** `PUT {{baseUrl}}/booking/:id/cancel`  
- **Auth:** Bearer (role: `club_owner` or `super_admin`)  

Cancels the booking (sets `bookingStatus` to `"cancelled"`). No request body.

**Success Response (200):**

```json
{
  "success": true,
  "message": "Booking cancelled",
  "data": {
    "_id": "...",
    "bookingStatus": "cancelled",
    ...
  }
}
```

**Error:** `404` – Booking not found; `403` – Unauthorized; `400` – Booking is already cancelled.

---

### 4.2.1 Final Settlement (After Match Completion)

- **Step:** 16  
- **URL:** `PUT {{baseUrl}}/booking/:id/settlement`  
- **Auth:** Bearer (role: `club_owner` or `super_admin`)  

Call after the match/slot is completed to record remaining payment and get full payment breakdown.

**Request Body (JSON):**

```json
{
  "settlement_remaining_online": 50,
  "settlement_remaining_cash": 50
}
```

- `settlement_remaining_online`: Amount paid **online** at settlement.
- `settlement_remaining_cash`: Amount paid **cash** at settlement.

**Success Response (200):**

```json
{
  "success": true,
  "message": "Settlement recorded",
  "data": { "...booking with settlementDone: true, paymentStatus: \"paid\"..." },
  "settlement": {
    "totalAmountPaid": 600,
    "advanceAmountPaid": 500,
    "remainingAmountPaidAtSettlement": 100,
    "amountPaidOnline": 350,
    "amountPaidOfflineCash": 250
  }
}
```

**Error:** `404` – Booking not found; `403` – not allowed to update this booking.

See **BOOKING_FLOW_CHANGES.md** for full flow (negotiation, advance, settlement).

---

### 4.3 View My Bookings

- **Step:** 12  
- **URL:** `GET {{baseUrl}}/booking/my-bookings`  
- **Auth:** Bearer (role: `user`, `club_owner`, or `super_admin`)  

**Success Response (200):** Each booking includes **start_time**, **end_time**, **yardIds**, and **yardBreakdown** (per-yard amount). No slot or addon.

```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "userId": "...",
      "clubId": { "_id": "...", "name": "Elite Sports Club" },
      "yardId": { "_id": "...", "name": "Tennis Court A", "gameType": "Tennis" },
      "yardIds": [{ "_id": "...", "name": "Tennis Court A", "gameType": "Tennis" }],
      "start_time": "10:00",
      "end_time": "11:00",
      "bookingDate": "...",
      "yardBreakdown": [{ "yardId": "...", "yardName": "Tennis Court A", "amount": 720 }],
      "totalAmount": 720,
      "paymentStatus": "paid",
      "bookingStatus": "confirmed",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

---

## 5. Club Owner – Bookings Overview

### 5.1 View All Club Bookings

- **Step:** 13  
- **URL:** `GET {{baseUrl}}/owner/bookings`  
- **Auth:** Bearer (role: `club_owner`)  

Returns all club bookings with **display-friendly amounts** and **per-yard breakdown**. **`date`** is **required** (YYYY-MM-DD) to retrieve bookings for that day (filters by `bookingDate`).

**Query parameters:**

| Param  | Type   | Required | Description                                      |
|--------|--------|----------|--------------------------------------------------|
| `date` | string | **Yes**  | Booking date in YYYY-MM-DD format (e.g. `2024-02-20`). |

**Error (400):** Missing or invalid date: message asks for date in YYYY-MM-DD format.

**totalAmount** = billAmount − negotiatedDiscount. Each booking includes **yardBreakdown** (per-yard amount) and **yardBreakdownWithAdvance** (per-yard amount with advance proportionally applied). If an advance amount is applied, it is reflected in **yardBreakdownWithAdvance** (e.g. `amount`, `advanceApplied`, `amountAfterAdvance` per yard).

**Success Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "userId": { "_id": "...", "name": "John", "email": "john@example.com" },
      "clubId": "...",
      "yardId": { "_id": "...", "name": "Tennis Court A" },
      "yardIds": [...],
      "start_time": "09:00",
      "end_time": "10:00",
      "bookingDate": "...",
      "userName": "John Doe",
      "mobileNumber": "9876543210",
      "yardBreakdown": [
        { "yardId": "...", "yardName": "Cricket Yard 1", "amount": 500 },
        { "yardId": "...", "yardName": "Cricket Yard 2", "amount": 500 }
      ],
      "yardBreakdownWithAdvance": [
        { "yardId": "...", "yardName": "Cricket Yard 1", "amount": 500, "advanceApplied": 250, "amountAfterAdvance": 250 },
        { "yardId": "...", "yardName": "Cricket Yard 2", "amount": 500, "advanceApplied": 250, "amountAfterAdvance": 250 }
      ],
      "originalAmount": 1000,
      "billAmount": 1000,
      "negotiatedDiscount": 0,
      "negotiatedAmount": 0,
      "totalAmount": 1000,
      "advancePaid": 500,
      "remainingToPay": 500,
      "totalPaid": 500,
      "settlementDone": false,
      "paymentStatus": "pending",
      "bookingStatus": "confirmed",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "totalBookings": 1,
  "totalOriginalAmount": 1000,
  "totalNegotiatedAmount": 1000,
  "totalPaidAmount": 500,
  "totalRemainingAmount": 500
}
```

**Per-booking display (advance-booking fields):** **userName**, **mobileNumber**.

**Per-booking display (amounts and per-yard):**

| Field | Description |
|-------|-------------|
| **yardBreakdown** | Per-yard amount: `[{ yardId, yardName, amount }]`. Total = sum of amounts. |
| **yardBreakdownWithAdvance** | Per-yard with advance applied: `amount`, `advanceApplied`, `amountAfterAdvance`. |
| **originalAmount** | Sum of yard amounts (before discount). |
| **billAmount** | Pre-discount total. **totalAmount** = billAmount − negotiatedDiscount. |
| **negotiatedDiscount** / **negotiatedAmount** | Discount amount. |
| **totalAmount** | Final total to pay. Use for display. |
| **addonceAmount** | Total from add-ons only: sum of (price × quantity). Shown in owner/bookings and owner/history. |
| **advancePaid** | Amount paid in advance. |
| **remainingToPay** | negotiatedAmount − totalPaid; **decrements** as advance/settlement paid. |
| **totalPaid** | Total paid so far. **After settlement**, use this as the total amount paid for that booking. |
| **settlementDone** | Whether settlement was recorded. |

**Summary totals (for “total” display):**

| Field | Description |
|-------|-------------|
| **totalBookings** | Number of bookings. |
| **totalOriginalAmount** | Sum of original amounts. |
| **totalNegotiatedAmount** | Sum of negotiated (agreed) amounts — use for “Total” when showing negotiated total. |
| **totalPaidAmount** | Sum of amount paid so far — **display as total amount paid** after settlements. |
| **totalRemainingAmount** | `totalNegotiatedAmount - totalPaidAmount` — remaining to collect (decrements as paid). |

---

### 5.2 History API (Owner) – Bookings with Totals & Filters

- **URL:** `GET {{baseUrl}}/owner/history`  
- **Auth:** Bearer (role: `club_owner`)  

Returns all bookings for the owner’s club with **total bookings**, **total amount**, **payment breakdown** (Cash / Online / Mixed), and **yard-wise** totals. **`start_date`** is **required** (YYYY-MM-DD). **`end_date`** is optional; if provided, data is returned for the range from `start_date` to `end_date`. Each booking includes **yardBreakdown** and **yardBreakdownWithAdvance** (per-yard amount with advance proportionally applied). **totalAmount** = bill − negotiated discount. **Yard filter** matches bookings that have that yard in **yardId** or **yardIds**. Data updates dynamically based on query filters.

**Query parameters:**

| Param        | Type   | Required | Description                                                                 |
|-------------|--------|----------|-----------------------------------------------------------------------------|
| `start_date`| string | **Yes**  | Start of date range in YYYY-MM-DD (e.g. `2024-02-01`). When used alone, returns data from this date onward. |
| `end_date`  | string | No       | End of date range in YYYY-MM-DD (e.g. `2024-02-28`). When provided with `start_date`, returns data for the range from start_date to end_date. |
| `yardId`    | string | No       | Filter by yard (single yard)                                                |

**Error (400):**  
- Missing start_date: `{ "success": false, "message": "start_date is required. Pass start_date in YYYY-MM-DD format to fetch historical data." }`  
- Invalid start_date: `{ "success": false, "message": "Invalid start_date. Use YYYY-MM-DD format (e.g. 2024-02-01)." }`  
- Invalid end_date: `{ "success": false, "message": "Invalid end_date. Use YYYY-MM-DD format (e.g. 2024-02-28)." }`

- **Date filter:** Bookings are filtered by `bookingDate` (slot date). With only `start_date`, bookings on or after that date; with both `start_date` and `end_date`, bookings in the inclusive range. Totals and yard-wise stats apply to the filtered set.
- **Yard filter:** Only bookings for that yard. Yard-wise array will have one entry (or none if no bookings).
- **Backward compatibility:** `fromDate` and `toDate` are accepted as aliases for `start_date` and `end_date`.

**Success Response (200):**

```json
{
  "success": true,
  "filters": {
    "start_date": "2024-02-01",
    "end_date": "2024-02-28",
    "yardId": null
  },
  "totalBookings": 42,
  "totalAmount": 28500,
  "paymentBreakdown": {
    "cashBookings": 20,
    "onlineBookings": 18,
    "mixedBookings": 4
  },
  "yardWise": [
    {
      "yardId": "...",
      "yardName": "Tennis Court A",
      "totalBookings": 25,
      "totalAmount": 15000,
      "paymentBreakdown": { "cash": 12, "online": 10, "mixed": 3 }
    },
    {
      "yardId": "...",
      "yardName": "Badminton Court B",
      "totalBookings": 17,
      "totalAmount": 13500,
      "paymentBreakdown": { "cash": 8, "online": 8, "mixed": 1 }
    }
  ],
  "bookings": [
    {
      "_id": "...",
      "userId": { "_id": "...", "name": "John", "email": "john@example.com" },
      "yardId": { "_id": "...", "name": "Tennis Court A", "gameType": "Tennis" },
      "yardIds": [...],
      "start_time": "10:00",
      "end_time": "11:00",
      "bookingDate": "...",
      "yardBreakdown": [{ "yardId": "...", "yardName": "Tennis Court A", "amount": 700 }],
      "yardBreakdownWithAdvance": [{ "yardId": "...", "yardName": "Tennis Court A", "amount": 700, "advanceApplied": 300, "amountAfterAdvance": 400 }],
      "userName": "John Doe",
      "mobileNumber": "9876543210",
      "originalAmount": 700,
      "billAmount": 1000,
      "negotiatedDiscount": 300,
      "negotiatedAmount": 700,
      "totalAmount": 700,
      "advancePaid": 300,
      "remainingToPay": 400,
      "totalPaid": 600,
      "settlementDone": true,
      "paymentType": "cash",
      "paymentStatus": "paid",
      "bookingStatus": "confirmed",
      ...
    }
  ]
}
```

**Per-booking display fields for History tab:** **userName**, **mobileNumber**; **yardBreakdown**; **yardBreakdownWithAdvance**; **addonceAmount** (add-ons total: price × quantity per item). Amounts: **totalAmount**, **billAmount**, **negotiatedDiscount**, **negotiatedAmount**, **originalAmount**, **advancePaid**, **remainingToPay**, **totalPaid**, **settlementDone**. **paymentType**: `"cash"` | `"online"` | `"mixed"`. **yardWise** and summary totals use the final calculated total (bill − discount) per booking.

---

## 6. Super Admin APIs

### 6.1 Get All Clubs

- **Step:** 19  
- **URL:** `GET {{baseUrl}}/admin/clubs`  
- **Auth:** Bearer (role: `super_admin`)  

**Success Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "name": "Elite Sports Club",
      "ownerId": "...",
      "address": "123 Main St",
      "city": "New York",
      "state": "NY",
      "isActive": true,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

---

### 6.2 Update Any Club

- **Step:** 20  
- **URL:** `PUT {{baseUrl}}/admin/club/:id`  
- **Auth:** Bearer (role: `super_admin` or `club_owner` for own club only)  

**Request Body (JSON):** Same as owner update (e.g. `name`, `address`, `city`, `state`, `isActive` for activate/deactivate).

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "_id": "...",
    "name": "...",
    "ownerId": "...",
    "address": "...",
    "city": "...",
    "state": "...",
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Error:** `403` – club_owner editing another club; `404` – club not found.

---

### 6.2.1 Delete Club (Super Admin only)

- **URL:** `DELETE {{baseUrl}}/admin/club/:id`  
- **Auth:** Bearer (role: `super_admin`)  

Deletes the club. Fails with **400** if the club has any yards (delete all yards first).

**Success Response (200):**

```json
{
  "success": true,
  "message": "Club deleted successfully"
}
```

**Error:** `400` – "Cannot delete club: it has yards. Delete all yards first."; `404` – Club not found.

---

### 6.2.2 Get Yards by Club (Super Admin)

- **URL:** `GET {{baseUrl}}/admin/yards?clubId=<clubId>`  
- **Auth:** Bearer (role: `super_admin`)  
- **Query:** `clubId` (required), `date` (optional, YYYY-MM-DD for bookedSlots for that date).

**Success Response (200):** Same shape as GET `/owner/yards` (list of yards with `bookedSlots` when `date` is provided).

**Error:** `400` – clubId missing or invalid date; `404` – Club not found.

---

### 6.2.3 Update Yard (Super Admin)

- **URL:** `PUT {{baseUrl}}/admin/yard/:id`  
- **Auth:** Bearer (role: `super_admin`)  
- **Request Body (JSON):** e.g. `name`, `gameType`, `pricePerHour`, `isActive`.

**Success Response (200):** `{ "success": true, "data": { ...yard } }`

**Error:** `400` – empty body; `404` – Yard not found.

---

### 6.3 Delete Yard (Admin)

- **Step:** 21  
- **URL:** `DELETE {{baseUrl}}/admin/yard/:id`  
- **Auth:** Bearer (role: `super_admin` or `club_owner` for own club's yard)  

**Success Response (200):**

```json
{
  "success": true,
  "message": "Yard deleted successfully"
}
```

---

### 6.4 View All Bookings (Admin)

- **Step:** 22  
- **URL:** `GET {{baseUrl}}/admin/bookings`  
- **Auth:** Bearer (role: `super_admin`)  

**Query parameters (all optional):** `clubId` – filter by club; `date` – filter by booking date (YYYY-MM-DD); `yardId` – filter by yard.

**Success Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "userId": "...",
      "clubId": "...",
      "yardId": "...",
      "slotId": "...",
      "bookingDate": "...",
      "addOns": [...],
      "totalAmount": 720,
      "paymentStatus": "paid",
      "bookingStatus": "confirmed",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

---

### 6.5 History API (Admin) – Bookings with Totals & Filters

- **URL:** `GET {{baseUrl}}/admin/history`  
- **Auth:** Bearer (role: `super_admin`)  

Same as Owner History but for **all clubs** (or filter by `clubId`). **`start_date`** is **required** (YYYY-MM-DD); **`end_date`** is optional—if provided, data is returned for the range from start_date to end_date. Returns total bookings, total amount, payment breakdown (Cash / Online / Mixed), and yard-wise breakdown. Data updates dynamically based on query filters.

**Query parameters:** `start_date` (required, YYYY-MM-DD), `end_date` (optional, YYYY-MM-DD), `yardId` (optional), `clubId` (optional; filter by club; omit for all clubs). `fromDate` and `toDate` are accepted as aliases for `start_date` and `end_date`. Same **400** error messages as Owner History for missing/invalid dates.

**Success Response (200):** Same shape as Owner History (see **5.2**), with `filters` including `clubId`. Bookings include populated `clubId` (name) when present.

---

## Security & Isolation

- **JWT:** Stores `role` and (for club_owner) `clubId`.  
- **Owner actions:** Yard and booking operations are scoped to `req.user.clubId`.  
- **Cross-club:** Owner A cannot modify Owner B’s data → `403` or `404`.

---

## Quick Reference – All APIs

| # | Method | URL | Auth | Step |
|---|--------|-----|------|------|
| 1 | POST | `/auth/register` | — | 1 |
| 2 | POST | `/auth/login` | — | 2 |
| 3 | GET | `/owner/club` | club_owner | 3 |
| 4 | PUT | `/owner/club` | club_owner | 4 |
| 5 | POST | `/owner/yard` | club_owner | 5 |
| 6 | GET | `/owner/yards` | club_owner | 6 |
| 7 | PUT | `/owner/yard/:id` | club_owner | 7 |
| 8 | DELETE | `/owner/yard/:id` | club_owner | 8 |
| 9 | POST | `/booking` | club_owner, super_admin | 9 |
| 10 | PUT | `/booking/:id` | club_owner, super_admin | 10 |
| — | PUT | `/booking/:id/cancel` | club_owner, super_admin | — |
| 11 | PUT | `/booking/:id/settlement` | club_owner, super_admin | 11 |
| 12 | GET | `/booking/my-bookings` | user, club_owner, super_admin | 12 |
| 13 | GET | `/owner/bookings` | club_owner | 13 |
| 14 | GET | `/owner/history` | club_owner | 14 |
| 15 | GET | `/admin/clubs` | super_admin | 15 |
| 16 | PUT | `/admin/club/:id` | super_admin, club_owner | 16 |
| — | DELETE | `/admin/club/:id` | super_admin | — |
| — | GET | `/admin/yards?clubId=` | super_admin | — |
| — | PUT | `/admin/yard/:id` | super_admin | — |
| 17 | DELETE | `/admin/yard/:id` | super_admin, club_owner | 17 |
| 18 | GET | `/admin/bookings` | super_admin | 18 |
| 19 | GET | `/admin/history` | super_admin | 19 |
| 20 | GET | `/analytics/bookings` | club_owner, super_admin, admin | 20 |
| 21 | GET | `/analytics/trends` | club_owner, super_admin, admin | 21 |

---

## Analytics APIs

### 20. GET `/analytics/bookings` - Booking Analytics

**Roles:** `club_owner`, `super_admin`, `admin`

**Description:** Get comprehensive booking analytics and income statistics for a specified date range.

**Query Parameters:**
- **`startDate`** (required): Start date in YYYY-MM-DD format
- **`endDate`** (required): End date in YYYY-MM-DD format  
- **`clubId`** (optional): Filter by specific club (admins/super_admins only)

**Response:**

```json
{
  "success": true,
  "data": {
    "dateRange": {
      "startDate": "2024-01-01",
      "endDate": "2024-12-31"
    },
    "totalBookings": 150,
    "totalIncome": 16500,
    "bookingStatusCounts": {
      "confirmed": 140,
      "cancelled": 10
    },
    "paymentStatusCounts": {
      "pending": 20,
      "paid": 125,
      "failed": 5
    },
    "settlementCounts": {
      "settled": 120,
      "unsettled": 30
    },
    "advancePaymentCounts": {
      "withAdvance": 80,
      "withoutAdvance": 70
    },
    "incomeBreakdown": {
      "advancePayments": 5000,
      "settlementPayments": 10000,
      "totalCollected": 15000,
      "pendingAmount": 1500,
      "addOnRevenue": 2000  // ✅ NEW - Total add-on revenue across all bookings
    },
    "yardWiseStats": [
      {
        "yardId": "yard_id_here",
        "yardName": "Box 1",
        "totalBookings": 75,
        "totalIncome": 8250,
        "confirmedBookings": 70,
        "cancelledBookings": 5,
        "settledBookings": 60,
        "pendingBookings": 15,
        "paidBookings": 62,
        "averageBookingValue": 110,
        "advancePayments": 2500,
        "settlementPayments": 5000,
        "totalCollected": 7500,
        "pendingAmount": 750,
        "withAdvancePayments": 40,
        "withoutAdvancePayments": 35,
        "addOnRevenue": 1500,  // ✅ NEW - Total add-on revenue for this yard
        "addOnCount": 25           // ✅ NEW - Number of bookings with add-ons
      }
    ],
    "totalAdvanceAmount": 100,  // ✅ NEW - Total advance payments across all yards
    "averageBookingValue": 110,
    "settlementRate": 80,
    "cancellationRate": 6.67
  }
}
```

**Key Metrics Explained:**
- **totalBookings**: All bookings within date range
- **totalIncome**: Final amount after discounts (totalAmount - negotiatedDiscount)
- **bookingStatusCounts**: Confirmed vs cancelled bookings
- **paymentStatusCounts**: Payment status distribution
- **settlementCounts**: Settled vs unsettled bookings
- **advancePaymentCounts**: Bookings with/without advance payments
- **incomeBreakdown**: Detailed payment analysis
- **yardWiseStats**: **NEW** - Per-yard (court) statistics with:
  - **yardId**: Unique identifier for the yard/court
  - **yardName**: Display name of the yard/court
  - **totalBookings**: Number of bookings for this yard
  - **totalIncome**: Total income generated by this yard (with multi-yard booking income distributed equally)
  - **confirmedBookings**: Confirmed bookings count
  - **cancelledBookings**: Cancelled bookings count
  - **settledBookings**: Bookings with completed settlement
  - **pendingBookings**: Pending payment bookings
  - **paidBookings**: Fully paid bookings
  - **averageBookingValue**: Average income per booking for this yard
  - **advancePayments**: Total advance payments received by this yard
  - **settlementPayments**: Total settlement payments received by this yard
  - **totalCollected**: Total amount collected (advance + settlement) by this yard
  - **pendingAmount**: Amount pending to be collected by this yard
  - **withAdvancePayments**: Number of bookings with advance payments for this yard
  - **withoutAdvancePayments**: Number of bookings without advance payments for this yard
  - **addOnRevenue**: Total add-on revenue for this yard
  - **addOnCount**: Number of bookings with add-ons for this yard
- **totalAdvanceAmount**: **NEW** - Total advance payments across all yards
- **averageBookingValue**: Average income per booking (overall)
- **settlementRate**: Percentage of bookings that are settled
- **cancellationRate**: Percentage of bookings that are cancelled
- **addOnRevenue**: Total add-on revenue across all bookings

**Add-on Services Support:**
- **Add-on Revenue Tracking**: Additional services (water, food, equipment, etc.) are tracked per yard
- **Multi-yard Distribution**: When multiple yards are booked with add-ons, both yard revenue and add-on revenue are divided equally among all selected yards
- **Detailed Breakdown**: Complete visibility into add-on performance across all yards

**Multi-Yard Booking Income Distribution:**
When multiple yards are booked in a single booking (e.g., Box 1 + Box 2), the total income is automatically divided equally among all selected yards and reflected in their individual statistics.

---

### 21. GET `/analytics/trends` - Daily Booking Trends

**Roles:** `club_owner`, `super_admin`, `admin`

**Description:** Get day-by-day booking trends and statistics for a specified date range.

**Query Parameters:**
- **`startDate`** (required): Start date in YYYY-MM-DD format
- **`endDate`** (required): End date in YYYY-MM-DD format
- **`clubId`** (optional): Filter by specific club (admins/super_admins only)

**Response:**

```json
{
  "success": true,
  "data": {
    "dateRange": {
      "startDate": "2024-01-01",
      "endDate": "2024-01-07"
    },
    "dailyStats": [
      {
        "date": "2024-01-01",
        "totalBookings": 25,
        "totalIncome": 2750,
        "confirmedBookings": 24,
        "cancelledBookings": 1,
        "settledBookings": 20,
        "paidBookings": 22,
        "yardWiseStats": [
          {
            "yardId": "yard_id_here",
            "yardName": "Box 1",
            "totalBookings": 15,
            "totalIncome": 1650,
            "confirmedBookings": 14,
            "cancelledBookings": 1,
            "settledBookings": 12,
            "paidBookings": 13,
            "advancePayments": 825,
            "settlementPayments": 825,
            "totalCollected": 1650,
            "pendingAmount": 0,
            "withAdvancePayments": 8,
            "withoutAdvancePayments": 7,
            "addOnRevenue": 825,      // ✅ NEW - Add-on revenue for this yard
            "addOnCount": 8            // ✅ NEW - Add-on count
          },
          {
            "yardId": "yard_id_here",
            "yardName": "Box 2",
            "totalBookings": 10,
            "totalIncome": 1100,
            "confirmedBookings": 10,
            "cancelledBookings": 0,
            "settledBookings": 8,
            "paidBookings": 9,
            "advancePayments": 550,
            "settlementPayments": 550,
            "totalCollected": 1100,
            "pendingAmount": 0,
            "withAdvancePayments": 5,
            "withoutAdvancePayments": 5
          }
        ],
        "bookings": [
          {
            "bookingId": "booking_id_here",
            "userName": "John Doe",
            "mobileNumber": "1234567890",
            "start_time": "10:00",
            "end_time": "12:00",
            "yards": [
              {
                "yardId": "yard_id_here",
                "yardName": "Box 1"
              },
              {
                "yardId": "yard_id_here", 
                "yardName": "Box 2"
              }
            ],
            "totalAmount": 200,
            "bookingStatus": "confirmed",
            "paymentStatus": "pending",
            "settlementDone": false,
            "advancePaymentReceived": false
          }
        ],
        "totalAdvanceAmount": 2500,  // ✅ NEW - Total advance payments for this date
        "totalAddOnRevenue": 1375   // ✅ NEW - Total add-on revenue for this date
      }
    ]
  }
}
```

**Use Cases:**
- Track daily booking patterns
- Identify peak booking days
- Monitor revenue trends over time
- Analyze booking status changes by day
- Compare performance across different periods
- **NEW**: View yard-wise daily statistics for each court/box
- **NEW**: Access detailed booking information for each day including:
  - Customer details (name, mobile)
  - Time slots and duration
  - Multiple yard bookings with income distribution
  - Payment and settlement status
  - Individual yard assignments

**Enhanced Features:**
- **Yard-wise Daily Stats**: Each day includes per-yard breakdown of bookings, income, and status counts
- **Detailed Booking List**: Complete booking information for transparency and detailed analysis
- **Multi-yard Support**: Proper income distribution when multiple courts are booked simultaneously

**Error Responses:**

```json
// Missing dates
{
  "success": false,
  "message": "startDate and endDate are required (YYYY-MM-DD format)"
}

// Invalid date format
{
  "success": false,
  "message": "Invalid date format. Use YYYY-MM-DD"
}

// Start date after end date
{
  "success": false,
  "message": "startDate must be before or equal to endDate"
}
```

---

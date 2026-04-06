# Super Admin – Access, APIs & Postman Guide

This document describes the **Super Admin** role: full system access, all APIs with request/response examples, and how to call them from **Postman**.

---

## Base URL & Authentication

| Item | Value |
|------|--------|
| **Base URL** | `http://localhost:4000/api` |
| **Auth** | Bearer token in header: `Authorization: Bearer <token>` |
| **Role** | `super_admin` (only this role can use admin-only endpoints) |

All protected endpoints require a valid JWT. Get the token by calling **Login** (see [How to call APIs in Postman](#how-to-call-apis-in-postman) below).

---

## Super Admin – Access & Permissions Summary

The Super Admin has **full access and control** over the entire system.

### 1. Club Management

| Action | Description | API |
|--------|-------------|-----|
| **View all clubs** | List every club in the system | `GET /admin/clubs` |
| **Edit club details** | Update name, address, city, state, isActive | `PUT /admin/club/:id` |
| **Delete clubs** | Remove a club (only if it has no yards) | `DELETE /admin/club/:id` |
| **Activate / Deactivate clubs** | Turn a club on/off | `PUT /admin/club/:id` with `isActive: true/false` |

### 2. Yard Management

| Action | Description | API |
|--------|-------------|-----|
| **View all yards (club-wise)** | List yards for a selected club; optional date for slot availability | `GET /admin/clubs/:clubId/yards` or `GET /admin/yards?clubId=<id>&date=YYYY-MM-DD` |
| **Edit yard details** | Update name, gameType, pricePerHour, isActive | `PUT /admin/yard/:id` |
| **Delete yards** | Remove a yard | `DELETE /admin/yard/:id` |

### 3. Booking Management

| Action | Description | API |
|--------|-------------|-----|
| **Select club → show yards** | All yards under that club (with optional date-wise slots) | `GET /admin/clubs/:clubId/yards` or `GET /admin/yards?clubId=...&date=...` |
| **Select date → date-wise yard booking slots** | Bookings for a date (optionally by club or yard) | `GET /admin/bookings?date=YYYY-MM-DD&clubId=...&yardId=...` |
| **Select yard → all booking details** | Bookings for a specific yard | `GET /admin/bookings?yardId=<yardId>` |
| **Booking history** | All bookings (optionally filtered) | `GET /admin/bookings` or with `clubId`, `date`, `yardId` |
| **Edit bookings** | Update payment/status/time/addOns | `PUT /booking/:id` |
| **Delete bookings** | Not implemented (use cancel instead) | — |
| **Cancel bookings** | Set status to cancelled | `PUT /booking/:id/cancel` |
| **Create booking** | Create on behalf of a club | `POST /booking` |

### 4. Reports & Revenue

| Action | Description | API |
|--------|-------------|-----|
| **Club-wise booking history** | History filtered by club and date range | `GET /admin/history?clubId=<id>&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` |
| **Club-wise revenue reports** | Same history API returns totals, payment breakdown, yard-wise summary | `GET /admin/history?clubId=<id>&start_date=...&end_date=...` |

### 5. Subscription Management

| Action | Description | API |
|--------|-------------|-----|
| **Record subscription** | Select club, monthly or yearly, enter price; store which month/year subscription received | `POST /admin/subscription` |
| **List subscriptions** | View all clubs’ subscriptions with type, period (month/year), price; filter by club, type, year, month | `GET /admin/subscriptions?clubId=&subscriptionType=&periodYear=&periodMonth=` |

---

## All Super Admin APIs – Request & Response

### Authentication (get token first)

You must **login** as a user with role `super_admin` to get the JWT used in all requests below.

#### POST `/auth/login`

- **URL:** `POST {{baseUrl}}/auth/login`
- **Auth:** None
- **Body (JSON):**

```json
{
  "email": "superadmin@example.com",
  "password": "YourPassword"
}
```

- **Success (200):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "...",
      "name": "Super Admin",
      "email": "superadmin@example.com",
      "role": "super_admin",
      "assignedShops": []
    }
  }
}
```

Copy the `data.token` value and use it in the **Authorization** header for all other requests.

---

### 1. Club Management

#### 1.1 GET all clubs

- **URL:** `GET {{baseUrl}}/admin/clubs`
- **Auth:** Bearer (super_admin)
- **Query:** None

**Success (200):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "64a1b2c3d4e5f6789012345",
      "name": "Elite Sports Club",
      "ownerId": "64a1b2c3d4e5f6789012346",
      "address": "123 Main St",
      "city": "New York",
      "state": "NY",
      "isActive": true,
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

---

#### 1.2 PUT update club (edit / activate / deactivate)

- **URL:** `PUT {{baseUrl}}/admin/club/:id`
- **Auth:** Bearer (super_admin)
- **Params:** `id` = club `_id`
- **Body (JSON):** Any of: `name`, `address`, `city`, `state`, `isActive`

**Example – Edit details:**

```json
{
  "name": "Elite Sports Club Updated",
  "address": "456 New St",
  "city": "Boston",
  "state": "MA"
}
```

**Example – Deactivate club:**

```json
{
  "isActive": false
}
```

**Example – Activate club:**

```json
{
  "isActive": true
}
```

**Success (200):**

```json
{
  "success": true,
  "data": {
    "_id": "64a1b2c3d4e5f6789012345",
    "name": "Elite Sports Club Updated",
    "ownerId": "...",
    "address": "456 New St",
    "city": "Boston",
    "state": "MA",
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Errors:**  
- `400` – Empty body  
- `404` – Club not found  

---

#### 1.3 DELETE club

- **URL:** `DELETE {{baseUrl}}/admin/club/:id`
- **Auth:** Bearer (super_admin)
- **Params:** `id` = club `_id`

**Success (200):**

```json
{
  "success": true,
  "message": "Club deleted successfully"
}
```

**Errors:**  
- `400` – Club has yards (delete all yards first)  
- `404` – Club not found  

---

### 2. Yard Management

#### 2.1 GET yards by club (club-wise, optional date for slots)

- **URL:** `GET {{baseUrl}}/admin/clubs/:clubId/yards` **or** `GET {{baseUrl}}/admin/yards?clubId=<clubId>`
- **Optional:** `?date=YYYY-MM-DD` for that day’s booked slots per yard
- **Auth:** Bearer (super_admin)

**Example (path style):**  
`GET {{baseUrl}}/admin/clubs/699c45d5f3de6010669cce04/yards`

**Example (query style with date):**  
`GET {{baseUrl}}/admin/yards?clubId=64a1b2c3d4e5f6789012345&date=2024-02-20`

**Success (200):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "64a1b2c3d4e5f6789012347",
      "clubId": "64a1b2c3d4e5f6789012345",
      "name": "Cricket Yard 1",
      "gameType": "Cricket",
      "pricePerHour": 500,
      "isActive": true,
      "bookedSlots": [
        {
          "start_time": "09:00",
          "end_time": "10:00",
          "bookingDate": "2024-02-20T00:00:00.000Z",
          "date": "2024-02-20"
        }
      ],
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

**Errors:**  
- `400` – Missing `clubId` or invalid `date`  
- `404` – Club not found  

---

#### 2.2 PUT update yard (edit yard details)

- **URL:** `PUT {{baseUrl}}/admin/yard/:id`
- **Auth:** Bearer (super_admin)
- **Params:** `id` = yard `_id`
- **Body (JSON):** Any of: `name`, `gameType`, `pricePerHour`, `isActive`

**Example:**

```json
{
  "name": "Cricket Yard 1 - Premium",
  "pricePerHour": 600,
  "isActive": true
}
```

**Success (200):**

```json
{
  "success": true,
  "data": {
    "_id": "...",
    "clubId": "...",
    "name": "Cricket Yard 1 - Premium",
    "gameType": "Cricket",
    "pricePerHour": 600,
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Errors:**  
- `400` – Empty body  
- `404` – Yard not found  

---

#### 2.3 DELETE yard

- **URL:** `DELETE {{baseUrl}}/admin/yard/:id`
- **Auth:** Bearer (super_admin)
- **Params:** `id` = yard `_id`

**Success (200):**

```json
{
  "success": true,
  "message": "Yard deleted successfully"
}
```

**Errors:**  
- `403` – Unauthorized (e.g. club_owner and not their yard)  
- `404` – Yard not found  

---

### 3. Booking Management

#### 3.1 GET all bookings (with optional filters)

- **URL:** `GET {{baseUrl}}/admin/bookings`
- **Auth:** Bearer (super_admin)
- **Query (all optional):**

| Param    | Description |
|----------|-------------|
| `clubId` | Filter by club |
| `date`   | Filter by booking date (YYYY-MM-DD) – date-wise slots |
| `yardId` | Filter by yard (single yard’s bookings) |

**Examples:**

- All bookings:  
  `GET {{baseUrl}}/admin/bookings`
- By club:  
  `GET {{baseUrl}}/admin/bookings?clubId=64a1b2c3d4e5f6789012345`
- By date:  
  `GET {{baseUrl}}/admin/bookings?date=2024-02-20`
- By club + date:  
  `GET {{baseUrl}}/admin/bookings?clubId=64a1b2c3d4e5f6789012345&date=2024-02-20`
- By yard:  
  `GET {{baseUrl}}/admin/bookings?yardId=64a1b2c3d4e5f6789012347`

**Success (200):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "userId": { "_id": "...", "name": "John", "email": "john@example.com" },
      "clubId": { "_id": "...", "name": "Elite Sports Club" },
      "yardId": { "_id": "...", "name": "Cricket Yard 1", "gameType": "Cricket" },
      "yardIds": [{ "_id": "...", "name": "Cricket Yard 1", "gameType": "Cricket" }],
      "start_time": "09:00",
      "end_time": "10:00",
      "bookingDate": "2024-02-20T00:00:00.000Z",
      "userName": "John Doe",
      "mobileNumber": "9876543210",
      "yardBreakdown": [{ "yardId": "...", "yardName": "Cricket Yard 1", "amount": 500 }],
      "originalAmount": 500,
      "totalAmount": 500,
      "negotiatedDiscount": 0,
      "advancePaymentReceived": true,
      "advancePaymentOnline": 200,
      "advancePaymentCash": 100,
      "paymentStatus": "pending",
      "bookingStatus": "confirmed",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

**Error:**  
- `400` – Invalid `date` format (use YYYY-MM-DD)  

---

#### 3.2 POST create booking

- **URL:** `POST {{baseUrl}}/booking`
- **Auth:** Bearer (super_admin)
- **Body (JSON):** Same as in main API guide (yardIds or yardId, clubId, start_time, end_time, bookingDate, userName, mobileNumber, optional price, negotiatedAmount, advance fields).

**Success (201):** Returns `success`, `booking`, `originalAmount`, `totalAmount`, etc. (see main API_GUIDE.md).

---

#### 3.3 PUT update booking

- **URL:** `PUT {{baseUrl}}/booking/:id`
- **Auth:** Bearer (super_admin)
- **Params:** `id` = booking `_id`
- **Body (JSON):** e.g. `paymentStatus`, `bookingStatus`, `start_time`, `end_time`, `addOns`

**Success (200):** Returns updated booking in `data`.

---

#### 3.4 PUT cancel booking

- **URL:** `PUT {{baseUrl}}/booking/:id/cancel`
- **Auth:** Bearer (super_admin)
- **Params:** `id` = booking `_id`
- **Body:** None

**Success (200):**

```json
{
  "success": true,
  "message": "Booking cancelled",
  "data": { "_id": "...", "bookingStatus": "cancelled", ... }
}
```

---

### 4. Reports & Revenue (History)

#### GET admin history (club-wise booking history & revenue)

- **URL:** `GET {{baseUrl}}/admin/history`
- **Auth:** Bearer (super_admin)
- **Query:**

| Param        | Required | Description |
|-------------|----------|-------------|
| `start_date` | Yes     | YYYY-MM-DD  |
| `end_date`   | No      | YYYY-MM-DD (range end) |
| `clubId`     | No      | Filter by club (omit for all clubs) |
| `yardId`     | No      | Filter by yard |

**Examples:**

- All clubs, from a date:  
  `GET {{baseUrl}}/admin/history?start_date=2024-02-01`
- Date range:  
  `GET {{baseUrl}}/admin/history?start_date=2024-02-01&end_date=2024-02-28`
- Club-wise:  
  `GET {{baseUrl}}/admin/history?start_date=2024-02-01&end_date=2024-02-28&clubId=64a1b2c3d4e5f6789012345`

**Success (200):**

```json
{
  "success": true,
  "filters": {
    "start_date": "2024-02-01",
    "end_date": "2024-02-28",
    "yardId": null,
    "clubId": "64a1b2c3d4e5f6789012345"
  },
  "totalBookings": 10,
  "totalAmount": 15000,
  "paymentBreakdown": {
    "cashBookings": 4,
    "onlineBookings": 3,
    "mixedBookings": 3
  },
  "yardWise": [
    {
      "yardId": "...",
      "yardName": "Cricket Yard 1",
      "totalBookings": 5,
      "totalAmount": 7500,
      "paymentBreakdown": { "cash": 2, "online": 2, "mixed": 1 }
    }
  ],
  "bookings": [ ... ]
}
```

Use this for **club-wise booking history** and **club-wise revenue** (totals + payment breakdown + yard-wise).

**Errors:**  
- `400` – Missing or invalid `start_date` / `end_date` (use YYYY-MM-DD)  

---

## Subscription APIs (Super Admin)

### Create subscription (club-wise, monthly or yearly + price)

Record that a club has received a subscription for a given **month** (monthly) or **year** (yearly) with a price. One record per club per period.

- **URL:** `POST {{baseUrl}}/admin/subscription`
- **Auth:** Bearer (super_admin)
- **Body (JSON):**

**Monthly example:**

```json
{
  "clubId": "64a1b2c3d4e5f6789012345",
  "subscriptionType": "monthly",
  "price": 5000,
  "periodYear": 2024,
  "periodMonth": 2
}
```

**Yearly example:**

```json
{
  "clubId": "64a1b2c3d4e5f6789012345",
  "subscriptionType": "yearly",
  "price": 50000,
  "periodYear": 2024
}
```

- **clubId** (required): Club `_id`
- **subscriptionType** (required): `"monthly"` or `"yearly"`
- **price** (required): Non-negative number
- **periodYear** (required): Year (e.g. `2024`)
- **periodMonth** (required for monthly only): Month 1–12 (e.g. `2` for February). Omit for yearly.

**Success (201):**

```json
{
  "success": true,
  "data": {
    "_id": "...",
    "clubId": { "_id": "...", "name": "Elite Sports Club" },
    "subscriptionType": "monthly",
    "price": 5000,
    "periodYear": 2024,
    "periodMonth": 2,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Errors:**  
- `400` – Missing/invalid body; club not found; period already has a subscription for this club  
- `404` – Club not found  

---

### List subscriptions (admin panel: club, type, which month/year, price)

List all subscription records. Use for admin panel: show club name, subscription type (monthly/yearly), which month or which year, and price. Optional filters: club, type, year, month.

- **URL:** `GET {{baseUrl}}/admin/subscriptions`
- **Auth:** Bearer (super_admin)
- **Query (all optional):** `clubId`, `subscriptionType` (`monthly`|`yearly`), `periodYear`, `periodMonth`

**Examples:**

- All: `GET {{baseUrl}}/admin/subscriptions`
- One club: `GET {{baseUrl}}/admin/subscriptions?clubId=64a1b2c3d4e5f6789012345`
- Only yearly: `GET {{baseUrl}}/admin/subscriptions?subscriptionType=yearly`
- One year: `GET {{baseUrl}}/admin/subscriptions?periodYear=2024`

**Success (200):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "clubId": {
        "_id": "...",
        "name": "Elite Sports Club",
        "address": "123 Main St",
        "city": "New York",
        "state": "NY"
      },
      "subscriptionType": "monthly",
      "price": 5000,
      "periodYear": 2024,
      "periodMonth": 2,
      "periodLabel": "2024-02 (Feb)",
      "createdAt": "...",
      "updatedAt": "..."
    },
    {
      "_id": "...",
      "clubId": { "_id": "...", "name": "City Club" },
      "subscriptionType": "yearly",
      "price": 50000,
      "periodYear": 2024,
      "periodMonth": 0,
      "periodLabel": "Year 2024",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

- **periodLabel**: Human-readable period (e.g. `"2024-02 (Feb)"` for monthly, `"Year 2024"` for yearly) for display in admin panel.

---

## How to Call APIs in Postman

### Step 1: Set base URL

1. Create an **Environment** (e.g. “E-Management”).
2. Add variable:  
   - **Variable:** `baseUrl`  
   - **Value:** `http://localhost:4000/api`  
3. Add variable:  
   - **Variable:** `token`  
   - **Value:** leave empty (you’ll set it after login).

### Step 2: Login and save token

1. **New Request** → Method: **POST**.
2. URL: `{{baseUrl}}/auth/login`.
3. **Body** → **raw** → **JSON**:
   ```json
   {
     "email": "superadmin@example.com",
     "password": "YourActualPassword"
   }
   ```
4. Send request.
5. From the response, copy the value of `data.token`.
6. In the Environment, set **token** = that value (or use a script to set it automatically, see below).

**Optional – Auto-save token:**  
In the Login request’s **Tests** tab, add:

```javascript
var json = pm.response.json();
if (json.data && json.data.token) {
  pm.environment.set("token", json.data.token);
}
```

### Step 3: Use token on all other requests

For every **admin and booking** request:

1. Open the request.
2. Go to **Authorization**.
3. Type: **Bearer Token**.
4. Token: `{{token}}`.

Or in **Headers** add:

- Key: `Authorization`  
- Value: `Bearer {{token}}`

### Step 4: Call Super Admin APIs in order

| Order | What to do | Method | URL |
|-------|------------|--------|-----|
| 1 | Login | POST | `{{baseUrl}}/auth/login` |
| 2 | List clubs | GET | `{{baseUrl}}/admin/clubs` |
| 3 | Pick a club id, list its yards | GET | `{{baseUrl}}/admin/clubs/<club_id>/yards` or `{{baseUrl}}/admin/yards?clubId=<club_id>` |
| 4 | (Optional) Yards with date slots | GET | `{{baseUrl}}/admin/clubs/<club_id>/yards?date=2024-02-20` |
| 5 | All bookings (or with filters) | GET | `{{baseUrl}}/admin/bookings` or `?clubId=...&date=...&yardId=...` |
| 6 | Update club | PUT | `{{baseUrl}}/admin/club/<club_id>` |
| 7 | Deactivate club | PUT | `{{baseUrl}}/admin/club/<club_id>` body: `{"isActive":false}` |
| 8 | Edit yard | PUT | `{{baseUrl}}/admin/yard/<yard_id>` |
| 9 | Delete yard | DELETE | `{{baseUrl}}/admin/yard/<yard_id>` |
| 10 | Delete club (only if no yards) | DELETE | `{{baseUrl}}/admin/club/<club_id>` |
| 11 | Create booking | POST | `{{baseUrl}}/booking` |
| 12 | Update booking | PUT | `{{baseUrl}}/booking/<booking_id>` |
| 13 | Cancel booking | PUT | `{{baseUrl}}/booking/<booking_id>/cancel` |
| 14 | Club-wise history / revenue | GET | `{{baseUrl}}/admin/history?start_date=2024-02-01&end_date=2024-02-28&clubId=<club_id>` |

Use the **Params** or **Query** section in Postman to add `clubId`, `date`, `yardId`, `start_date`, `end_date` as needed.

---

## How It Works – Workflow

1. **Club management**  
   Super Admin calls `GET /admin/clubs` to see all clubs. They can **edit** (PUT club), **activate/deactivate** (PUT club with `isActive`), or **delete** (DELETE club) after removing all yards.

2. **Yard management**  
   After choosing a club, Super Admin calls `GET /admin/clubs/:clubId/yards` (or `GET /admin/yards?clubId=<id>`) to see all yards for that club. Optional `date` returns **date-wise yard booking slots** (`bookedSlots`). They can **delete** yards with `DELETE /admin/yard/:id`.

3. **Booking management**  
   - **By club:** `GET /admin/bookings?clubId=<id>`  
   - **By date:** `GET /admin/bookings?date=YYYY-MM-DD`  
   - **By yard:** `GET /admin/bookings?yardId=<id>`  
   Combine filters as needed. For a single booking: **view** (in list), **edit** (`PUT /booking/:id`), **cancel** (`PUT /booking/:id/cancel`). **Create** via `POST /booking`.

4. **Reports & revenue**  
   `GET /admin/history?start_date=...&end_date=...` gives totals and payment breakdown. Add `clubId` for **club-wise** booking history and revenue; response includes `totalBookings`, `totalAmount`, `paymentBreakdown`, `yardWise`.

---

## Quick Reference – Super Admin Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/auth/login` | Get JWT (use in Authorization header) |
| GET | `/admin/clubs` | View all clubs |
| PUT | `/admin/club/:id` | Edit club / Activate / Deactivate |
| DELETE | `/admin/club/:id` | Delete club (no yards) |
| GET | `/admin/clubs/:clubId/yards` or `/admin/yards?clubId=&date=` | View yards (club-wise; optional date slots) |
| PUT | `/admin/yard/:id` | Edit yard |
| DELETE | `/admin/yard/:id` | Delete yard |
| GET | `/admin/bookings?clubId=&date=&yardId=` | View bookings (all or filtered) |
| POST | `/booking` | Create booking |
| PUT | `/booking/:id` | Edit booking |
| PUT | `/booking/:id/cancel` | Cancel booking |
| GET | `/admin/history?start_date=&end_date=&clubId=&yardId=` | Reports & revenue (club-wise optional) |
| POST | `/admin/subscription` | Record club subscription (monthly/yearly + price) |
| GET | `/admin/subscriptions?clubId=&subscriptionType=&periodYear=&periodMonth=` | List subscriptions (club, type, month/year, price) |

All except **Login** require header: **Authorization: Bearer &lt;token&gt;**.

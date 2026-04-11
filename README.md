# 🍽️ DineIn — Production-Grade QR-Based Restaurant Ordering System

A full-stack restaurant ordering system with OTP login, QR code table identification, real-time kitchen updates, live order tracking, and payment integration.

---

## 🚀 Quick Start

### 1. Environment Setup
```bash
# Server environment
cd server
cp .env.example .env
# Fill in: MONGO_URI, JWT_SECRET, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET

# Client environment (optional)
cd ../client
cp .env.example .env  # if needed
```

### 2. Install Dependencies & Seed Data
```bash
# Server
cd server
npm install
npm run seed  # Creates menu items, tables, customers, and generates QR codes

# Client
cd ../client
npm install
```

### 3. Generate QR Codes for Tables
```bash
cd server
node utils/qrGenerator.js  # Generates QR codes for all tables
```

### 4. Start Services
```bash
# Terminal 1: Server
cd server && npm run dev

# Terminal 2: Client
cd client && npm run dev
```

---

## 🔐 Authentication System

### Customer Flow (OTP-Based)
1. **Table Entry**: Scan QR code or enter table number
2. **OTP Login**: Enter phone → receive SMS OTP → verify
3. **Session**: JWT token with table + customer binding
4. **Ordering**: Authenticated access to menu and cart

### Staff Accounts
| Role     | Email                       | Password    | Access              |
|----------|-----------------------------|-------------|---------------------|
| Admin    | admin@restaurant.com        | admin123    | Full admin panel    |
| Kitchen  | kitchen@restaurant.com      | kitchen123  | Kitchen display     |
| Cashier  | cashier@restaurant.com      | cashier123  | Orders & payments   |

---

## 📱 Customer Journey

### 1. Table Identification
- **QR Code**: Contains `restaurantId` and `tableId`
- **Manual Entry**: Type table number (e.g., T1, 001)
- **Route**: `/order/:restaurantId/:tableId`

### 2. OTP Authentication
- Enter 10-digit phone number
- Receive 6-digit OTP via SMS
- Session created with 4-hour expiry
- Cart persists across session

### 3. Menu & Ordering
- Browse categorized menu
- Add items to cart (synced with backend)
- Review order with tax calculation
- Place order (server validates prices)

### 4. Order Tracking
- Real-time status updates via Socket.io
- Payment integration (Razorpay)
- Order history in "My Orders"

---

## 🏗️ System Architecture

### Database Schema
```javascript
// Customer (mobile-based)
{
  phone: "+919876543210",
  name: "John Doe",
  otp: "hashed_otp",
  otpExpiry: Date,
  isVerified: true
}

// Session (table + customer binding)
{
  tableId: ObjectId,
  customerId: ObjectId,
  sessionToken: "jwt_token",
  cart: [...],
  expiresAt: Date
}

// Order (enhanced)
{
  customerId: ObjectId,
  sessionId: ObjectId,
  tableId: ObjectId,
  status: "placed|confirmed|preparing|ready|served|completed"
}
```

### API Endpoints
```javascript
// Customer Auth
POST /api/auth/customer/send-otp
POST /api/auth/customer/verify-otp
GET  /api/auth/customer/me

// Menu & Cart
GET  /api/menu/:restaurantId
POST /api/cart/sync
GET  /api/cart

// Orders
POST /api/orders
GET  /api/orders/session/:sessionId
GET  /api/orders/:id

// Tables
GET  /api/tables/public/:id  // QR verification
```

---

## 🔧 Production Considerations

### Security
- OTP rate limiting (3 attempts per 5 min)
- JWT tokens with short expiry (4 hours)
- Server-side price validation
- Input sanitization and validation

### Performance
- Redis for OTP storage (recommended)
- Database indexing on frequently queried fields
- Image CDN for menu photos
- Socket.io clustering for multiple servers

### Scalability
- Multi-restaurant support via `restaurantId`
- Horizontal scaling with load balancer
- Database sharding by restaurant
- CDN for static assets

### Monitoring
- Error logging with Winston
- Performance monitoring
- Order analytics dashboard
- Real-time metrics

---

## 🧪 Testing the System

### 1. Generate QR Code for Table T1
```bash
# QR contains: {"restaurantId":"default","tableId":"table_id_here"}
# URL format: http://localhost:5173/?restaurantId=default&tableId=TABLE_ID
```

### 2. Customer Flow
1. Visit table URL or scan QR
2. Enter phone: `9876543210`
3. Enter OTP: `123456` (check console for mock OTP)
4. Browse menu, add items
5. Place order
6. Track order status

### 3. Admin Panel
- Login: `admin@restaurant.com` / `admin123`
- View live orders
- Update order status
- Manage menu items

---

## 📋 Features Checklist

- ✅ QR code table identification
- ✅ OTP SMS authentication
- ✅ Session-based cart persistence
- ✅ Real-time order tracking
- ✅ Kitchen display system
- ✅ Payment integration
- ✅ Admin dashboard
- ✅ Mobile-responsive UI
- ✅ Rate limiting & security
- ✅ Multi-restaurant support
- ✅ Order analytics

---

## 🔮 Future Enhancements

- Push notifications for order updates
- Table reservation system
- Customer loyalty program
- Multi-language support
- Offline ordering capability
- Integration with POS systems
- Advanced analytics & reporting

---

## 🏗️ Architecture

```
client/ (React + Vite + Tailwind)
├── pages/
│   ├── Home.jsx           — Menu with QR table detection
│   ├── OrderSummary.jsx   — Cart + order placement (server-side total)
│   ├── OrderTracking.jsx  — Live status + Razorpay payment
│   ├── Kitchen.jsx        — KDS: Kanban board for kitchen
│   ├── Admin.jsx          — Dashboard: orders, menu, analytics
│   └── Login.jsx          — Staff login
├── hooks/
│   ├── useSocket.js       — Socket.io hooks (order tracking, kitchen, menu)
│   └── useAuth.js         — JWT auth context
└── context/
    └── CartContext.jsx    — Persistent cart (localStorage + tax calc)

server/ (Node.js + Express + MongoDB)
├── models/
│   ├── MenuItem.js        — Menu with stock tracking
│   ├── Order.js           — Full order lifecycle + status history
│   ├── Table.js           — Table management + QR
│   ├── User.js            — Staff with bcrypt passwords
│   └── Payment.js         — Payment records + refunds
├── routes/
│   ├── auth.js            — Login / register / me
│   ├── menu.js            — CRUD + availability toggle (admin protected)
│   ├── orders.js          — Place + track + update + analytics
│   ├── tables.js          — Table management
│   └── payments.js        — Razorpay + cash + webhooks
├── middleware/
│   └── auth.js            — JWT verify + role-based authorization
└── seed/
    ├── seedData.js        — Menu items
    └── seedAdmin.js       — Staff accounts
```

---

## 🔄 Key Production Improvements

| Issue (old) | Fix (new) |
|---|---|
| No auth on `/admin` | JWT-protected routes with role-based access |
| Client-sent total trusted | Server recalculates total from DB prices |
| Cart lost on refresh | Cart persisted in localStorage with tax breakdown |
| No real-time updates | Socket.io rooms: kitchen, order tracking, menu |
| No table/session tracking | tableId from QR URL → stored in Order |
| No order number | Auto-incrementing `orderNumber` per restaurant |
| Simple status toggle | Full status history with timestamps + transition guards |
| No payment | Razorpay integration with signature verification |
| No kitchen view | Full KDS with Kanban columns and urgency timer |
| No analytics | MongoDB aggregation: revenue, top items, avg order |

---

## 💳 Razorpay Setup

1. Create account at [razorpay.com](https://razorpay.com)
2. Get test keys from Dashboard → Settings → API Keys
3. Add to `server/.env`:
```
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```
4. Add Razorpay script to `client/index.html`:
```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```
> Without real keys, the system runs in **mock payment mode** for development.

---

## 📡 Socket.io Events

| Event              | Room              | Direction        | Payload                    |
|--------------------|-------------------|------------------|----------------------------|
| `new_order`        | `kitchen:R1`      | Server → Kitchen | Full order object          |
| `status_changed`   | `order:ID`        | Server → Customer| `{ orderId, status }`     |
| `item_availability`| `restaurant:R1`   | Server → Menu    | `{ itemId, available }`   |
| `payment_confirmed`| `order:ID`        | Server → Customer| `{ orderId, status }`     |
| `order_updated`    | `admin:R1`        | Server → Admin   | Full updated order         |

---

## 🔒 Security

- JWT tokens with 7-day expiry
- Role-based route protection (admin, kitchen, waiter, cashier)
- Rate limiting: 200 req/15min (API), 20 req/15min (auth)
- Helmet.js security headers
- Server-side total recalculation (client total ignored)
- Razorpay HMAC signature verification
- Idempotent webhook processing

---

## 🌐 Production Deployment

| Service  | Recommended          | Notes                     |
|----------|----------------------|---------------------------|
| Frontend | Vercel / Netlify     | Free tier works           |
| Backend  | Railway / Render     | Free tier works           |
| Database | MongoDB Atlas M10    | ~₹2,000/month             |
| Redis    | Upstash              | Free tier for sessions    |
| Media    | Cloudinary           | Free tier for images      |
| Payments | Razorpay             | 2% transaction fee        |

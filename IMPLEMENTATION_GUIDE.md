# Restaurant Ordering System - Complete Enhancement Guide

## 🎯 Overview

This document provides a comprehensive guide to the newly enhanced restaurant ordering system with session management, order linking, bill generation, and integrated payment processing.

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Backend APIs](#backend-apis)
4. [Frontend Components](#frontend-components)
5. [User Workflows](#user-workflows)
6. [Installation & Setup](#installation--setup)
7. [Configuration](#configuration)
8. [Features](#features)
9. [Testing](#testing)

---

## 🏗️ Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + Vite)                     │
├─────────────────────────────────────────────────────────────────┤
│  SessionContext | CartContext | AuthContext                     │
│  Components: OrderList, Bill, PaymentComponent                  │
│  Pages: Home, MyOrders, OrderSummary, OrderTracking            │
└─────────────────────────────────────────────────────────────────┘
                            ↕ API Calls
┌─────────────────────────────────────────────────────────────────┐
│                  BACKEND (Node.js + Express)                    │
├─────────────────────────────────────────────────────────────────┤
│  Routes: /sessions, /orders, /bills, /payments                  │
│  Real-time: Socket.io for kitchen & admin updates               │
│  Database: MongoDB (Sessions, Bills, Orders, etc.)              │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Login
   ↓
Session Created (SessionId + Token)
   ↓
Browse Menu & Add Items to Cart
   ↓
Place Order (linked to Session)
   ↓
User Details Auto-filled (Name + Phone stored)
   ↓
Order Saved in DB + Linked to Session
   ↓
User can Place Multiple Orders (all linked via sessionId)
   ↓
Generate Bill (merge multiple orders)
   ↓
Process Payment (Cash/UPI/Razorpay)
   ↓
Print Bill
   ↓
Session Ends
```

---

## 📊 Database Schema

### 1. **Session Model**

```javascript
{
  _id: ObjectId,
  sessionToken: String (unique),
  tableId: String,
  restaurantId: String,
  customerId: ObjectId (ref: Customer),
  
  // User Details - Auto-fill for future orders
  customerName: String,
  phone: String,
  
  // Linked Orders & Bills
  orderIds: [ObjectId],
  billIds: [ObjectId],
  
  // Cart State
  cart: [{
    itemId: ObjectId,
    name: String,
    price: Number,
    quantity: Number
  }],
  
  isActive: Boolean,
  expiresAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### 2. **Bill Model**

```javascript
{
  _id: ObjectId,
  billNumber: Number (auto-incremented),
  restaurantId: String,
  sessionId: ObjectId (ref: Session),
  customerId: ObjectId (ref: Customer),
  
  // Link Multiple Orders
  orderIds: [ObjectId],
  
  // Customer Info
  customerName: String,
  phone: String,
  tableNumber: String,
  
  // Items & Financial Details
  items: [{
    itemId: ObjectId,
    name: String,
    price: Number,
    quantity: Number,
    totalPrice: Number
  }],
  
  itemsTotal: Number,
  subtotal: Number,
  discount: Number,
  discountPercentage: Number,
  tax: Number,
  serviceCharge: Number,
  packagingCharges: Number,
  grandTotal: Number,
  
  // Payment Info
  paymentStatus: String (pending|paid|partial|refunded),
  paymentMethod: String (cash|upi|razorpay|card|wallet),
  paymentId: String,
  razorpayOrderId: String,
  razorpayPaymentId: String,
  paidAmount: Number,
  remainingAmount: Number,
  
  // Bill Status
  billStatus: String (generated|displayed|printed|completed),
  
  // Print Tracking
  printedAt: Date,
  printCount: Number,
  
  statusHistory: [{
    status: String,
    timestamp: Date,
    by: String
  }],
  
  createdAt: Date,
  updatedAt: Date
}
```

### 3. **Order Model (Enhanced)**

```javascript
{
  _id: ObjectId,
  // NEW: Link to Bill
  billId: ObjectId (ref: Bill),
  
  // Session Management
  sessionId: String,
  restaurantId: String,
  tableId: String,
  
  // Customer Info
  customerId: ObjectId,
  customerName: String,
  phone: String,
  
  // Items
  items: [{
    itemId: ObjectId,
    name: String,
    price: Number,
    quantity: Number,
    status: String (pending|preparing|ready)
  }],
  
  // Pricing
  subtotal: Number,
  tax: Number,
  discount: Number,
  total: Number,
  
  // Status Management
  status: String,
  paymentStatus: String,
  paymentMethod: String,
  
  // Razorpay Integration
  razorpayOrderId: String,
  razorpayPaymentId: String,
  
  statusHistory: [{...}],
  createdAt: Date
}
```

---

## 🔌 Backend APIs

### Session Management

#### Create Session
```
POST /api/sessions/create
Body: {
  tableId: String,
  restaurantId: String (default: "default"),
  customerName: String,
  phone: String
}
Response: {
  sessionToken: String,
  sessionId: ObjectId,
  restaurantId: String,
  tableId: String
}
```

#### Save User Details
```
PUT /api/sessions/:sessionId/user-details
Body: {
  customerName: String,
  phone: String,
  customerId: ObjectId (optional)
}
Response: {
  sessionId: ObjectId,
  customerName: String,
  phone: String,
  message: "User details updated successfully"
}
```

#### Check Existing User
```
POST /api/sessions/check-existing-user
Body: {
  phone: String,
  restaurantId: String
}
Response: {
  exists: Boolean,
  sessionId: ObjectId (if exists),
  customerName: String (if exists),
  message: String
}
```

#### Get Session Orders
```
GET /api/sessions/:sessionId/orders
Response: [Order, Order, ...]
```

#### Extend Session
```
PUT /api/sessions/:sessionId/extend
Response: {
  sessionId: ObjectId,
  expiresAt: Date,
  message: "Session extended"
}
```

#### End Session
```
PUT /api/sessions/:sessionId/end
Response: { message: "Session ended" }
```

---

### Bill Management

#### Create Bill
```
POST /api/bills/create
Body: {
  sessionId: ObjectId,
  orderIds: [ObjectId, ...],
  discount: Number (optional),
  discountPercentage: Number (optional),
  serviceCharge: Number (optional),
  packagingCharges: Number (optional)
}
Response: {
  billId: ObjectId,
  billNumber: Number,
  customerName: String,
  items: [...],
  itemsTotal: Number,
  grandTotal: Number,
  paymentStatus: String
}
```

#### Get Bill Details
```
GET /api/bills/:billId
Response: {
  _id: ObjectId,
  billNumber: Number,
  customerName: String,
  phone: String,
  items: [...],
  grandTotal: Number,
  paymentStatus: String,
  ...
}
```

#### Get Bills for Session
```
GET /api/bills/session/:sessionId
Response: [Bill, Bill, ...]
```

#### Apply Discount
```
PUT /api/bills/:billId/apply-discount
Body: {
  discountAmount: Number OR
  discountPercentage: Number
}
Response: {
  billId: ObjectId,
  discount: Number,
  grandTotal: Number,
  message: "Discount applied successfully"
}
```

#### Mark Bill as Printed
```
PUT /api/bills/:billId/mark-printed
Response: {
  message: "Bill marked as printed",
  printCount: Number
}
```

#### Update Payment Status
```
PUT /api/bills/:billId/update-payment
Body: {
  paymentStatus: String (paid|pending|partial|refunded),
  paymentMethod: String,
  paidAmount: Number,
  razorpayOrderId: String (optional),
  razorpayPaymentId: String (optional)
}
Response: {
  billId: ObjectId,
  paymentStatus: String,
  paidAmount: Number,
  remainingAmount: Number,
  message: "Payment updated successfully"
}
```

---

### Payment Processing

#### Create Razorpay Order (for Bill)
```
POST /api/payments/bill/create-razorpay
Body: { billId: ObjectId }
Response: {
  razorpayOrderId: String,
  amount: Number (in paise),
  currency: "INR",
  key: String,
  billDetails: {...}
}
```

#### Verify Razorpay Payment (for Bill)
```
POST /api/payments/bill/verify-razorpay
Body: {
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  billId: ObjectId
}
Response: {
  success: Boolean,
  message: "Bill payment verified"
}
```

#### Record Cash Payment
```
POST /api/payments/bill/cash
Body: {
  billId: ObjectId,
  amountReceived: Number
}
Response: {
  billId: ObjectId,
  paymentStatus: String,
  paidAmount: Number,
  remainingAmount: Number,
  message: "Cash payment recorded"
}
```

#### Process UPI Payment
```
POST /api/payments/bill/upi
Body: {
  billId: ObjectId,
  upiTransactionId: String
}
Response: {
  billId: ObjectId,
  paymentStatus: "paid",
  message: "UPI payment processed successfully"
}
```

---

## 🎨 Frontend Components

### 1. **SessionContext** (`client/src/context/SessionContext.jsx`)

Manages session and user details globally.

**Methods:**
- `createSession(tableId, restaurantId, tableNumber)` - Create new session
- `saveUserDetails(name, phone)` - Store user details
- `checkExistingUser(phone)` - Check for returning customers
- `loadPreviousUsers(phone)` - Get previous sessions
- `extendSession()` - Extend session expiry
- `endSession()` - Logout
- `clearUserDetails()` - Clear for "Change User"
- `getSessionOrders()` - Fetch session's orders

**Usage:**
```javascript
import { useSession } from '../context/SessionContext';

function MyComponent() {
  const { session, userDetails, saveUserDetails } = useSession();
  
  // Use session and methods
}
```

### 2. **OrderList Component** (`client/src/components/OrderList.jsx`)

Displays all orders for a session with selection capability.

**Props:**
- `sessionId: ObjectId` - Session to fetch orders for
- `showSelectCheckbox: Boolean` - Enable multi-select
- `selectedOrders: [ObjectId]` - Currently selected orders
- `onSelectionChange: Function` - Callback when selection changes

**Features:**
- View all orders
- Multi-select orders
- Expand order details
- Show payment status
- Expandable item list

### 3. **Bill Component** (`client/src/components/Bill.jsx`)

Displays complete bill details with print functionality.

**Props:**
- `billId: ObjectId` - Bill to display
- `onPaymentSuccess: Function` - Callback after payment
- `onClose: Function` - Close button callback

**Features:**
- Full bill formatting
- Customer information
- Itemized breakdown
- Financial summary
- Print button (A4 & thermal friendly)
- Payment button

### 4. **PaymentComponent** (`client/src/components/PaymentComponent.jsx`)

Unified payment processing interface.

**Props:**
- `billId: ObjectId` - Bill to pay for
- `grandTotal: Number` - Amount to collect
- `onPaymentSuccess: Function` - Success callback
- `onPaymentFailed: Function` - Failure callback

**Supported Methods:**
- 💵 Cash (with partial payment support)
- 📱 UPI (Google Pay, PhonePe, etc.)
- 💳 Razorpay (Card, Wallet, Online)

### 5. **Enhanced MyOrders Page** (`client/src/pages/MyOrders.jsx`)

Main order and billing interface for customers.

**Features:**
- View all orders
- Select multiple orders
- Generate combined bills
- View bill history
- Process payments
- Print bills

---

## 👤 User Workflows

### Workflow 1: First-Time User (Single Order)

```
1. User scans table QR code
2. Table verified, session created
3. User enters name & phone
4. User browses menu and adds items
5. Places order
6. Order saved with session + user details stored
7. User can view order in "My Orders"
8. Order ready → Kitchen updates status
9. User can view bill and pay
```

### Workflow 2: First-Time User (Multiple Orders)

```
1-6. Same as Workflow 1

7. User places SECOND order
   → No need to re-enter name/phone (auto-filled)
   
8. Third order placed (if needed)

9. User goes to "My Orders" → Bills tab

10. Selects all orders → "Generate Bill"
    → Bill #S001 created with ALL orders merged
    
11. Total bill shows combined items
    → Bill #S001: 3 dishes + 2 drinks = ₹450

12. Clicks "Pay Now" → Payment options

13. Payment processed → Bill marked as paid

14. Prints bill with all items
```

### Workflow 3: Returning Customer

```
1. User scans table QR code
2. Enters phone number
3. System detects existing session
4. Shows: "Welcome back, Raj! Continue as saved user?"
5. User clicks "Yes"
6. Session resumed, name/phone auto-filled
7. Can place orders immediately
8. Rest same as Workflow 2
```

### Workflow 4: Bill Generation & Payment

```
Order 1 (₹200) → Session A
Order 2 (₹150) → Session A
Order 3 (₹100) → Session A

User checks out:
1. Select all 3 orders
2. Click "Generate Bill"
3. Bill created:
   - Bill #S001
   - Items: Order 1 + Order 2 + Order 3
   - Subtotal: ₹450
   - Tax (5%): ₹22.50
   - Grand Total: ₹472.50

4. Click "Pay Now"
5. Choose payment method:
   - Cash: Pay ₹472.50
   - UPI: Scan QR/ Enter UPI ID
   - Card: Razorpay checkout
   
6. Payment confirmed
7. Print button enabled
8. User prints bill
```

### Workflow 5: Admin - View & Manage Orders

```
Admin Dashboard:
1. View all orders (grouped by session/phone)
2. Filter by status, payment, date
3. See all bills for a customer
4. Apply discounts to bills
5. Process payments (if needed)
6. Reprint bills
7. Update payment status
```

---

## 🚀 Installation & Setup

### Backend Setup

```bash
# Navigate to server
cd server

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Fill in .env
MONGO_URI=mongodb://...
JWT_SECRET=your_secret_key
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

### Frontend Setup

```bash
# Navigate to client
cd client

# Install dependencies
npm install

# Create .env file (optional)
VITE_API_URL=http://localhost:5000

# Start dev server
npm run dev
```

### Database Migration

If existing database, update Order schema:

```javascript
// Add billId field to existing orders
db.orders.updateMany({}, { $set: { billId: null } });
```

---

## ⚙️ Configuration

### Environment Variables

**Server (.env)**
```
MONGO_URI=mongodb://localhost:27017/restaurant
JWT_SECRET=your_super_secret_key_123
PORT=5000
NODE_ENV=development

# Razorpay
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=your_secret_...
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

### Session Configuration

In `SessionContext.jsx`:
```javascript
// Session expiry time (adjust as needed)
const expiryTime = 4 * 60 * 60 * 1000; // 4 hours

// Modify in `createSession`:
expiresAt: () => new Date(Date.now() + expiryTime)
```

### Bill Tax & Charges

In `routes/bills.js`:
```javascript
// Default tax rate (5%)
const tax = Math.round(afterDiscount * 0.05);

// Modify as needed for your restaurant
```

---

## ✨ Features

### Session Management
- ✅ Auto-fill user details (name + phone)
- ✅ Session persistence
- ✅ "Continue as saved user" option
- ✅ Session expiry (4 hours default)
- ✅ Multiple sessions per user

### Order Management
- ✅ Every order linked to session
- ✅ Place multiple orders
- ✅ All orders linked via sessionId
- ✅ Order history in MyOrders
- ✅ Real-time status updates

### Bill Generation
- ✅ Merge multiple orders into one bill
- ✅ Auto-calculate totals
- ✅ Apply discounts (amount or %)
- ✅ Add service charges & packaging
- ✅ Tax calculation
- ✅ Bill numbering (auto-increment)
- ✅ Bill status tracking

### Payment Processing
- ✅ Cash payment with change calculation
- ✅ UPI integration
- ✅ Razorpay integration (card, wallet)
- ✅ Partial payment support
- ✅ Payment status tracking
- ✅ Multiple payment methods

### Bill Printing
- ✅ Print-friendly formatting
- ✅ A4 page compatible
- ✅ Thermal printer friendly
- ✅ Print count tracking
- ✅ Timestamp on printed bills
- ✅ QR code for payment (optional)

### Admin Features
- ✅ View all orders by customer
- ✅ Manage bills
- ✅ Update payment status
- ✅ Apply discounts
- ✅ Reprint bills
- ✅ Generate reports

### Real-time Updates (Socket.io)
- ✅ Bill payment notifications
- ✅ Order status updates
- ✅ Kitchen order updates
- ✅ Admin dashboard refresh

---

## 🧪 Testing

### Test Session Creation

```bash
curl -X POST http://localhost:5000/api/sessions/create \
  -H "Content-Type: application/json" \
  -d '{
    "tableId": "table_1",
    "restaurantId": "default",
    "customerName": "John Doe",
    "phone": "9876543210"
  }'
```

### Test Bill Creation

```bash
curl -X POST http://localhost:5000/api/bills/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "sessionId": "SESSION_ID",
    "orderIds": ["ORDER_1", "ORDER_2"],
    "discount": 50
  }'
```

### Test Cash Payment

```bash
curl -X POST http://localhost:5000/api/payments/bill/cash \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "billId": "BILL_ID",
    "amountReceived": 500
  }'
```

---

## 📱 Frontend Integration

### Update OrderSummary

The OrderSummary page should use SessionContext:

```javascript
const { userDetails, saveUserDetails } = useSession();

// Pre-fill name and phone
const [customerInfo, setCustomerInfo] = useState({
  name: userDetails.name || '',
  phone: userDetails.phone || ''
});

// On order placement, save details
await saveUserDetails(customerInfo.name, customerInfo.phone);
```

### Update Login Flow

After OTP verification:

```javascript
const { createSession, saveUserDetails } = useSession();

// Create session
const session = await createSession(tableId, restaurantId, tableNumber);

// If customer already has details, restore them
if (existingCustomer) {
  await saveUserDetails(existingCustomer.name, existingCustomer.phone);
}
```

---

## 🎓 Best Practices

1. **Session Management**
   - Always validate sessionToken before processing orders
   - Auto-extend session when user is active
   - Clear session on logout

2. **Bill Generation**
   - Recalculate totals on server (security)
   - Store itemized breakdown in bill
   - Never trust client-side calculations

3. **Payment Processing**
   - Always verify Razorpay signature
   - Update bill and orders atomically
   - Log all payment attempts

4. **Printing**
   - Test with different printers
   - Provide both A4 and thermal formats
   - Include timestamp and bill number

5. **User Experience**
   - Show loading states
   - Provide confirmation before charging
   - Allow cancellation at any step
   - Offer "Change User" option

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Session expires | Extend via `/sessions/{id}/extend` endpoint |
| Bill not linking orders | Check orderIds array in Bill model |
| Payment fails | Verify Razorpay keys and webhook setup |
| Print format broken | Check CSS media queries, test browser print preview |
| Orders not appearing | Verify sessionId matches in database |

---

## 📞 Support & Maintenance

For issues or feature requests:
1. Check the API endpoints documentation
2. Verify database schema
3. Review Socket.io connections in browser console
4. Check server logs for errors

---

## 📄 License

This implementation is provided as-is for restaurant ordering systems.

---

**Last Updated:** April 2026  
**Version:** 2.0 (Enhanced with Sessions, Bills, and Payments)

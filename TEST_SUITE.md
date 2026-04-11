# Complete Test Suite - Restaurant App

**Test Date:** April 9, 2026
**Backend:** http://localhost:5000
**Frontend:** http://localhost:5174
**Status:** Running

---

## Test 1: OTP Login Flow ✅ TESTING

### Step 1.1: Send OTP
```bash
curl -X POST http://localhost:5000/api/auth/customer/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210", "restaurantId": "default"}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "OTP sent to phone",
  "sessionId": "..."
}
```

**Result:** ⏳

---

### Step 1.2: Verify OTP (Use "111111" for testing)
```bash
curl -X POST http://localhost:5000/api/auth/customer/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210", 
    "otp": "111111",
    "restaurantId": "default",
    "tableId": "TABLE_001"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "token": "JWT_TOKEN_HERE",
  "customer": {
    "phone": "9876543210",
    "name": "..."
  },
  "session": {
    "sessionId": "...",
    "customerId": "..."
  }
}
```

**Result:** ⏳

---

## Test 2: Order Placement with Phone ✅ CRITICAL

### Step 2.1: Get Menu Items
```bash
curl http://localhost:5000/api/menu \
  -H "Authorization: Bearer JWT_TOKEN_FROM_TEST_1"
```

**Expected:** Array of menu items with `_id` values

**Result:** ⏳

---

### Step 2.2: Place Order with Name & Phone
```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer JWT_TOKEN_FROM_TEST_1" \
  -d '{
    "items": [
      {
        "itemId": "ITEM_ID_FROM_TEST_2.1",
        "quantity": 1,
        "price": 250
      }
    ],
    "customerName": "John Doe",
    "phone": "9876543210",
    "notes": "No onions"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "orderId": "ORDER_ID_1",
  "status": "placed",
  "phone": "9876543210"
}
```

**Critical Validations:**
- ✅ Phone is accepted from request body
- ✅ Phone is stored in order document
- ✅ No "phone path required" error
- ✅ No "customer not found" error

**Result:** ⏳

---

## Test 3: Session Persistence ✅ IMPORTANT

### Step 3.1: Check Session (after placing order)
```bash
curl http://localhost:5000/api/sessions/me \
  -H "Authorization: Bearer JWT_TOKEN_FROM_TEST_1"
```

**Expected Response:**
```json
{
  "session": {
    "customerName": "John Doe",
    "phone": "9876543210",
    "orderIds": ["ORDER_ID_1"]
  }
}
```

**Critical Validations:**
- ✅ Phone stored in session
- ✅ Customer name stored in session
- ✅ Order ID added to orderIds array

**Result:** ⏳

---

### Step 3.2: Place Second Order (Should Auto-fill Phone)
On the frontend OrderSummary page:
1. Click "Place Another Order"
2. Check if Name and Phone fields are auto-filled
3. Change quantity of another item
4. Submit without changing phone

```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer JWT_TOKEN_FROM_TEST_1" \
  -d '{
    "items": [
      {
        "itemId": "DIFFERENT_ITEM_ID",
        "quantity": 2,
        "price": 150
      }
    ],
    "customerName": "John Doe",
    "phone": "9876543210"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "orderId": "ORDER_ID_2",
  "status": "placed",
  "phone": "9876543210"
}
```

**Critical Validations:**
- ✅ Fields auto-filled from session
- ✅ Same phone used for second order
- ✅ Order ID_2 added to session.orderIds

**Result:** ⏳

---

## Test 4: Multi-Order Checkout ✅ 

### Step 4.1: Create Bill from Multiple Orders
```bash
curl -X POST http://localhost:5000/api/bills \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer JWT_TOKEN_FROM_TEST_1" \
  -d '{
    "orderIds": ["ORDER_ID_1", "ORDER_ID_2"]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "billId": "BILL_ID_1",
  "totalAmount": 550,
  "items": [
    {"name": "Item1", "quantity": 1, "price": 250},
    {"name": "Item2", "quantity": 2, "price": 150}
  ]
}
```

**Result:** ⏳

---

### Step 4.2: Get Bill Details
```bash
curl http://localhost:5000/api/bills/BILL_ID_1 \
  -H "Authorization: Bearer JWT_TOKEN_FROM_TEST_1"
```

**Expected Response:**
```json
{
  "bill": {
    "billId": "BILL_ID_1",
    "customerName": "John Doe",
    "phone": "9876543210",
    "orderIds": ["ORDER_ID_1", "ORDER_ID_2"],
    "items": [...],
    "totalAmount": 550,
    "status": "pending"
  }
}
```

**Result:** ⏳

---

## Test 5: Payment Processing ✅

### Step 5.1: Process Payment (Cash)
```bash
curl -X POST http://localhost:5000/api/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer JWT_TOKEN_FROM_TEST_1" \
  -d '{
    "billId": "BILL_ID_1",
    "method": "cash",
    "amount": 550
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "paymentId": "PAY_ID_1",
  "status": "completed",
  "amount": 550
}
```

**Result:** ⏳

---

### Step 5.2: Verify Bill Status Changed
```bash
curl http://localhost:5000/api/bills/BILL_ID_1 \
  -H "Authorization: Bearer JWT_TOKEN_FROM_TEST_1"
```

**Expected Response:**
```json
{
  "bill": {
    "status": "paid",
    "paymentStatus": "completed",
    "paymentId": "PAY_ID_1"
  }
}
```

**Result:** ⏳

---

## Test 6: End-to-End Frontend Testing

### Test 6.1: Complete Flow via UI
1. **Open** http://localhost:5174
2. **Scan QR or Enter Table** TABLE_001
3. **Do OTP Login** with phone 9999999999
4. **Place First Order**
   - Select 2-3 items
   - Verify name/phone fields exist
   - Submit order
5. **Verify Order Confirmation**
   - Check order appears in "My Orders"
   - Verify order ID is displayed
6. **Place Second Order**
   - Check if name/phone auto-filled
   - Select different items
   - Submit
7. **Go to Cart**
   - Select both orders
   - Generate bill
8. **Process Payment**
   - Choose payment method
   - Complete payment
   - Print bill

**Status:** ⏳

---

## Test 7: Error Handling

### Test 7.1: Missing Phone (Should Fail)
```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer JWT_TOKEN_FROM_TEST_1" \
  -d '{
    "items": [{"itemId": "ITEM_ID", "quantity": 1}],
    "customerName": "Test User"
  }'
```

**Expected:** ❌ Error: "Phone number required"

**Result:** ⏳

---

### Test 7.2: Invalid Phone Format (Frontend Should Catch)
On frontend OrderSummary:
1. Enter name: "Test"
2. Enter phone: "123" (too short)
3. Try to submit

**Expected:** ❌ Frontend validation error shown

**Result:** ⏳

---

### Test 7.3: Missing Customer Name
```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer JWT_TOKEN_FROM_TEST_1" \
  -d '{
    "items": [{"itemId": "ITEM_ID", "quantity": 1}],
    "phone": "9876543210"
  }'
```

**Expected:** ❌ Error: "Customer name required"

**Result:** ⏳

---

## Test Summary Template

```
✅ Passed: X/9
⚠️ Failed: Y/9
❌ Errors: Z/9

Critical Issues Found:
- Issue 1
- Issue 2

Warnings:
- Warning 1
- Warning 2

Notes:
- Observation 1
- Observation 2
```

---

## Quick Reference: Test Data

### Phone Numbers
- Existing Customer: 9876543210
- New Customer: 9999999999
- Test: 9111111111

### Test OTP Code
- All: 111111

### Test Items (Get from /api/menu)
- Prepare IDs after first call to GET /api/menu

### Tables
- TABLE_001
- TABLE_002
- TABLE_003

---

## Test Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| /api/auth/customer/send-otp | POST | Send OTP to phone |
| /api/auth/customer/verify-otp | POST | Verify OTP & create session |
| /api/menu | GET | Get menu items |
| /api/orders | POST | Place order (CRITICAL) |
| /api/sessions/me | GET | Check session state |
| /api/bills | POST | Create bill from orders |
| /api/bills/:billId | GET | Get bill details |
| /api/payments | POST | Process payment |
| /api/customers/me | GET | Get current customer |

---

**Next Step:** Begin Test 1.1 - Send OTP

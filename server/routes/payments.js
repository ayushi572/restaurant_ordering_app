const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const { authenticate, authorize } = require("../middleware/auth");

const getRazorpay = () => {
  const Razorpay = require("razorpay");
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
};

// POST create Razorpay order
router.post("/create-order", async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.paymentStatus === "paid") return res.status(400).json({ error: "Order already paid" });

    // If Razorpay keys are not configured, return mock response for development
    if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === "YOUR_KEY_ID") {
      return res.json({
        razorpayOrderId: `mock_order_${Date.now()}`,
        amount: order.total * 100,
        currency: "INR",
        key: "mock_key",
        orderDetails: { customerName: order.customerName, phone: order.phone, total: order.total }
      });
    }

    const razorpay = getRazorpay();
    const razorpayOrder = await razorpay.orders.create({
      amount: order.total * 100,
      currency: "INR",
      receipt: orderId,
      notes: { tableNumber: order.tableNumber, restaurantId: order.restaurantId }
    });

    order.razorpayOrderId = razorpayOrder.id;
    order.paymentStatus = "pending";
    await order.save();

    res.json({
      razorpayOrderId: razorpayOrder.id,
      amount: order.total * 100,
      currency: "INR",
      key: process.env.RAZORPAY_KEY_ID,
      orderDetails: { customerName: order.customerName, phone: order.phone, total: order.total }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST verify payment signature
router.post("/verify", async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = req.body;

    // Mock verification for development
    if (!process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET === "YOUR_KEY_SECRET") {
      const order = await Order.findById(orderId);
      if (!order) return res.status(404).json({ error: "Order not found" });
      order.paymentStatus = "paid";
      order.paymentId = razorpayPaymentId || "mock_payment_id";
      order.paymentMethod = "razorpay";
      order.status = "completed";
      order.statusHistory.push({ status: "completed", by: "payment_gateway" });
      await order.save();
      await Payment.create({ orderId, amount: order.total, method: "razorpay", status: "success", gatewayPaymentId: razorpayPaymentId || "mock", paidAt: new Date() });
      const io = req.app.get("io");
      io.to(`order:${orderId}`).emit("payment_confirmed", { orderId, status: "paid" });
      io.to(`admin:${order.restaurantId}`).emit("payment_done", { orderId, total: order.total });
      return res.json({ success: true, message: "Payment verified" });
    }

    // Real verification
    const body = razorpayOrderId + "|" + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      return res.status(400).json({ error: "Payment verification failed. Signature mismatch." });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.paymentStatus = "paid";
    order.paymentId = razorpayPaymentId;
    order.paymentMethod = "razorpay";
    order.status = "completed";
    order.statusHistory.push({ status: "completed", by: "payment_gateway" });
    await order.save();

    await Payment.create({
      orderId,
      restaurantId: order.restaurantId,
      amount: order.total,
      method: "razorpay",
      status: "success",
      gatewayOrderId: razorpayOrderId,
      gatewayPaymentId: razorpayPaymentId,
      gatewaySignature: razorpaySignature,
      paidAt: new Date()
    });

    const io = req.app.get("io");
    io.to(`order:${orderId}`).emit("payment_confirmed", { orderId, status: "paid" });
    io.to(`admin:${order.restaurantId}`).emit("payment_done", { orderId, total: order.total });

    res.json({ success: true, message: "Payment verified successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST cash payment — cashier/admin
router.post("/cash", authenticate, authorize(["admin", "cashier"]), async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.paymentStatus = "paid";
    order.paymentMethod = "cash";
    order.status = "completed";
    order.statusHistory.push({ status: "completed", by: req.user.name || "cashier" });
    await order.save();

    await Payment.create({ orderId, restaurantId: order.restaurantId, amount: order.total, method: "cash", status: "success", paidAt: new Date() });

    const io = req.app.get("io");
    io.to(`order:${orderId}`).emit("payment_confirmed", { orderId, status: "paid" });
    io.to(`admin:${order.restaurantId}`).emit("payment_done", { orderId, total: order.total });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST webhook — called by Razorpay for backup
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (secret) {
      const signature = req.headers["x-razorpay-signature"];
      const digest = crypto.createHmac("sha256", secret).update(req.body).digest("hex");
      if (digest !== signature) return res.status(400).json({ error: "Invalid webhook signature" });
    }

    const event = JSON.parse(req.body);
    if (event.event === "payment.captured") {
      const paymentId = event.payload.payment.entity.id;
      const razorpayOrderId = event.payload.payment.entity.order_id;
      const existing = await Payment.findOne({ gatewayPaymentId: paymentId });
      if (!existing) {
        const order = await Order.findOne({ razorpayOrderId });
        if (order && order.paymentStatus !== "paid") {
          order.paymentStatus = "paid";
          order.paymentId = paymentId;
          order.status = "completed";
          await order.save();
          await Payment.create({ orderId: order._id, restaurantId: order.restaurantId, amount: order.total, method: "razorpay", status: "success", gatewayOrderId: razorpayOrderId, gatewayPaymentId: paymentId, paidAt: new Date() });
        }
      }
    }
    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/payments/bill/create-razorpay
 * Create a Razorpay order for a bill
 */
router.post("/bill/create-razorpay", async (req, res) => {
  try {
    const { billId } = req.body;
    const Bill = require("../models/Bill");
    const bill = await Bill.findById(billId);

    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    if (bill.paymentStatus === "paid") {
      return res.status(400).json({ error: "Bill already paid" });
    }

    // If Razorpay keys not configured, return mock
    if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === "YOUR_KEY_ID") {
      return res.json({
        razorpayOrderId: `mock_bill_${Date.now()}`,
        amount: bill.grandTotal * 100,
        currency: "INR",
        key: "mock_key",
        billDetails: {
          billNumber: bill.billNumber,
          customerName: bill.customerName,
          phone: bill.phone,
          grandTotal: bill.grandTotal
        }
      });
    }

    const razorpay = getRazorpay();
    const razorpayOrder = await razorpay.orders.create({
      amount: bill.grandTotal * 100,
      currency: "INR",
      receipt: billId.toString(),
      notes: {
        billNumber: bill.billNumber,
        restaurantId: bill.restaurantId,
        type: "bill"
      }
    });

    bill.razorpayOrderId = razorpayOrder.id;
    await bill.save();

    res.json({
      razorpayOrderId: razorpayOrder.id,
      amount: bill.grandTotal * 100,
      currency: "INR",
      key: process.env.RAZORPAY_KEY_ID,
      billDetails: {
        billNumber: bill.billNumber,
        customerName: bill.customerName,
        phone: bill.phone,
        grandTotal: bill.grandTotal
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/payments/bill/verify-razorpay
 * Verify Razorpay payment for a bill
 */
router.post("/bill/verify-razorpay", async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, billId } = req.body;
    const Bill = require("../models/Bill");

    // Mock verification
    if (!process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET === "YOUR_KEY_SECRET") {
      const bill = await Bill.findById(billId);
      if (!bill) return res.status(404).json({ error: "Bill not found" });

      bill.paymentStatus = "paid";
      bill.razorpayPaymentId = razorpayPaymentId || "mock_payment_id";
      bill.paymentMethod = "razorpay";
      bill.paidAmount = bill.grandTotal;
      bill.remainingAmount = 0;
      bill.billStatus = "completed";
      bill.statusHistory.push({ status: "payment_verified", by: "razorpay" });

      await bill.save();

      // Update linked orders
      if (bill.orderIds && bill.orderIds.length > 0) {
        await Order.updateMany(
          { _id: { $in: bill.orderIds } },
          {
            paymentStatus: "paid",
            paymentMethod: "razorpay",
            razorpayOrderId: razorpayOrderId,
            razorpayPaymentId: razorpayPaymentId
          }
        );
      }

      return res.json({ success: true, message: "Payment verified" });
    }

    // Real verification
    const body = razorpayOrderId + "|" + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      return res.status(400).json({ error: "Payment verification failed" });
    }

    const bill = await Bill.findById(billId);
    if (!bill) return res.status(404).json({ error: "Bill not found" });

    bill.paymentStatus = "paid";
    bill.razorpayPaymentId = razorpayPaymentId;
    bill.paymentMethod = "razorpay";
    bill.paidAmount = bill.grandTotal;
    bill.remainingAmount = 0;
    bill.billStatus = "completed";
    bill.statusHistory.push({ status: "payment_verified", by: "razorpay" });

    await bill.save();

    // Update linked orders
    if (bill.orderIds && bill.orderIds.length > 0) {
      await Order.updateMany(
        { _id: { $in: bill.orderIds } },
        {
          paymentStatus: "paid",
          paymentMethod: "razorpay",
          razorpayOrderId: razorpayOrderId,
          razorpayPaymentId: razorpayPaymentId
        }
      );
    }

    res.json({ success: true, message: "Bill payment verified" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/payments/bill/cash
 * Record cash payment for a bill
 */
router.post("/bill/cash", async (req, res) => {
  try {
    const { billId, amountReceived } = req.body;
    const Bill = require("../models/Bill");

    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    const paidAmount = amountReceived || bill.grandTotal;
    bill.paymentStatus = paidAmount >= bill.grandTotal ? "paid" : "partial";
    bill.paymentMethod = "cash";
    bill.paidAmount = paidAmount;
    bill.remainingAmount = Math.max(0, bill.grandTotal - paidAmount);

    if (bill.paymentStatus === "paid") {
      bill.billStatus = "completed";
    }

    bill.statusHistory.push({
      status: `payment_${bill.paymentStatus}_cash`,
      by: "cashier"
    });

    await bill.save();

    // Update linked orders
    if (bill.orderIds && bill.orderIds.length > 0) {
      await Order.updateMany(
        { _id: { $in: bill.orderIds } },
        {
          paymentStatus: bill.paymentStatus,
          paymentMethod: "cash"
        }
      );
    }

    const io = req.app.get("io");
    io.to(`admin:${bill.restaurantId}`).emit("bill_payment_received", {
      billId: bill._id,
      billNumber: bill.billNumber,
      paymentStatus: bill.paymentStatus,
      paidAmount: bill.paidAmount
    });

    res.json({
      billId: bill._id,
      paymentStatus: bill.paymentStatus,
      paidAmount: bill.paidAmount,
      remainingAmount: bill.remainingAmount,
      message: "Cash payment recorded"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/payments/bill/upi
 * Process UPI payment for a bill
 */
router.post("/bill/upi", async (req, res) => {
  try {
    const { billId, upiTransactionId } = req.body;
    const Bill = require("../models/Bill");

    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    bill.paymentStatus = "paid";
    bill.paymentMethod = "upi";
    bill.paymentId = upiTransactionId;
    bill.paidAmount = bill.grandTotal;
    bill.remainingAmount = 0;
    bill.billStatus = "completed";
    bill.statusHistory.push({ status: "payment_verified_upi", by: "system" });

    await bill.save();

    // Update linked orders
    if (bill.orderIds && bill.orderIds.length > 0) {
      await Order.updateMany(
        { _id: { $in: bill.orderIds } },
        {
          paymentStatus: "paid",
          paymentMethod: "upi",
          paymentId: upiTransactionId
        }
      );
    }

    const io = req.app.get("io");
    io.to(`admin:${bill.restaurantId}`).emit("bill_payment_received", {
      billId: bill._id,
      billNumber: bill.billNumber,
      paymentStatus: "paid",
      paymentMethod: "upi"
    });

    res.json({
      billId: bill._id,
      paymentStatus: "paid",
      message: "UPI payment processed successfully"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

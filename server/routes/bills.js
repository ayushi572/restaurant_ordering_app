const express = require("express");
const router = express.Router();
const Bill = require("../models/Bill");
const Order = require("../models/Order");
const Session = require("../models/Session");
const MenuItem = require("../models/MenuItem");
const { authenticate, authorize, optionalAuth } = require("../middleware/auth");

/**
 * POST /api/bills/create
 * Create a bill from one or more orders - OPTIMIZED
 * Parallel queries, batch operations, no sequential await chains
 */
router.post("/create", async (req, res) => {
  try {
    const { sessionId, orderIds, discount = 0, discountPercentage = 0, serviceCharge = 0, packagingCharges = 0, restaurantId = "default" } = req.body;

    if (!sessionId || !orderIds || orderIds.length === 0) {
      return res.status(400).json({ error: "Session ID and at least one order ID required" });
    }

    // Parallel queries - fetch both session and orders at the same time
    const [session, orders] = await Promise.all([
      Session.findById(sessionId).lean(),
      Order.find({ _id: { $in: orderIds } }).lean()
    ]);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (orders.length !== orderIds.length) {
      return res.status(404).json({ error: "Some orders not found" });
    }

    // Aggregate items in a single pass
    const itemsMap = new Map();
    let itemsTotal = 0;

    orders.forEach(order => {
      order.items.forEach(item => {
        const itemKey = item.itemId.toString();
        if (!itemsMap.has(itemKey)) {
          itemsMap.set(itemKey, {
            itemId: item.itemId,
            name: item.name,
            price: item.price,
            quantity: 0,
            totalPrice: 0
          });
        }
        const existing = itemsMap.get(itemKey);
        existing.quantity += item.quantity;
        existing.totalPrice = existing.price * existing.quantity;
        itemsTotal = Math.round((itemsTotal + existing.price * item.quantity) * 100) / 100;
      });
    });

    const items = Array.from(itemsMap.values());

    // Calculate totals
    const subtotal = itemsTotal;
    const finalDiscount = discountPercentage > 0 ? Math.round(subtotal * (discountPercentage / 100)) : discount;
    const afterDiscount = subtotal - finalDiscount;
    const tax = Math.round(afterDiscount * 0.05);
    const grandTotal = afterDiscount + tax + serviceCharge + packagingCharges;

    const firstOrder = orders[0];

    const bill = new Bill({
      restaurantId,
      sessionId,
      customerId: session.customerId,
      orderIds: orderIds.map(id => typeof id === "string" ? id : id.toString()),
      customerName: firstOrder.customerName,
      phone: firstOrder.phone,
      tableNumber: firstOrder.tableNumber,
      items,
      itemsTotal,
      subtotal,
      discount: finalDiscount,
      discountPercentage,
      tax,
      serviceCharge,
      packagingCharges,
      grandTotal,
      remainingAmount: grandTotal
    });

    await bill.save();

    // Batch update session and orders with bulkWrite - no sequential awaits
    const bulkOps = [
      {
        updateOne: {
          filter: { _id: sessionId },
          update: {
            $addToSet: { billIds: bill._id },
            $set: { updatedAt: new Date() }
          }
        }
      },
      {
        updateMany: {
          filter: { _id: { $in: orderIds } },
          update: {
            $set: { billId: bill._id, updatedAt: new Date() }
          }
        }
      }
    ];

    await Promise.all([
      Session.bulkWrite(bulkOps[0]),
      Order.bulkWrite([bulkOps[1]])
    ]);

    res.json({
      billId: bill._id,
      billNumber: bill.billNumber,
      customerName: bill.customerName,
      phone: bill.phone,
      items: bill.items,
      itemsTotal: bill.itemsTotal,
      subtotal: bill.subtotal,
      discount: bill.discount,
      tax: bill.tax,
      serviceCharge: bill.serviceCharge,
      packagingCharges: bill.packagingCharges,
      grandTotal: bill.grandTotal,
      paymentStatus: bill.paymentStatus,
      createdAt: bill.createdAt
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/bills/generate
 * Auto-generate bill from all completed orders in a session - OPTIMIZED
 * Parallel queries, single pass aggregation, batch updates
 */
router.post("/generate", async (req, res) => {
  try {
    const { sessionId, restaurantId = "default" } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "Session ID required" });
    }

    // Parallel queries
    const [session, orders] = await Promise.all([
      Session.findById(sessionId).lean(),
      Order.find({
        sessionId,
        status: "completed",
        billId: null
      }).lean()
    ]);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (orders.length === 0) {
      return res.status(400).json({ error: "No completed orders available for billing" });
    }

    const orderIds = orders.map(order => order._id);

    // Single-pass aggregation using Map for O(1) lookups
    const itemsMap = new Map();
    let itemsTotal = 0;

    orders.forEach(order => {
      order.items.forEach(item => {
        const itemKey = item.itemId.toString();
        if (!itemsMap.has(itemKey)) {
          itemsMap.set(itemKey, {
            itemId: item.itemId,
            name: item.name,
            price: item.price,
            quantity: 0,
            totalPrice: 0
          });
        }
        const existing = itemsMap.get(itemKey);
        existing.quantity += item.quantity;
        existing.totalPrice = existing.price * existing.quantity;
        itemsTotal = Math.round((itemsTotal + existing.price * item.quantity) * 100) / 100;
      });
    });

    const items = Array.from(itemsMap.values());

    // Calculate totals
    const subtotal = itemsTotal;
    const tax = Math.round(subtotal * 0.05);
    const grandTotal = subtotal + tax;

    const firstOrder = orders[0];

    const bill = new Bill({
      restaurantId,
      sessionId,
      customerId: session.customerId,
      orderIds: orderIds.map(id => typeof id === "string" ? id : id.toString()),
      customerName: firstOrder.customerName,
      phone: firstOrder.phone,
      tableNumber: firstOrder.tableNumber,
      items,
      itemsTotal,
      subtotal,
      discount: 0,
      discountPercentage: 0,
      tax,
      serviceCharge: 0,
      packagingCharges: 0,
      grandTotal,
      remainingAmount: grandTotal
    });

    await bill.save();

    // Batch update - parallel operations
    await Promise.all([
      Session.updateOne(
        { _id: sessionId },
        {
          $addToSet: { billIds: bill._id },
          $set: { updatedAt: new Date() }
        }
      ),
      Order.updateMany(
        { _id: { $in: orderIds } },
        {
          $set: { billId: bill._id, updatedAt: new Date() }
        }
      )
    ]);

    res.json({
      billId: bill._id,
      billNumber: bill.billNumber,
      customerName: bill.customerName,
      phone: bill.phone,
      items: bill.items,
      itemsTotal: bill.itemsTotal,
      subtotal: bill.subtotal,
      discount: bill.discount,
      tax: bill.tax,
      serviceCharge: bill.serviceCharge,
      packagingCharges: bill.packagingCharges,
      grandTotal: bill.grandTotal,
      paymentStatus: bill.paymentStatus,
      createdAt: bill.createdAt
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/bills/:billId
 * Get full bill details - OPTIMIZED with lean() and selective field population
 */
router.get("/:billId", async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.billId)
      .select("-statusHistory") // Exclude heavy statusHistory for retrieval, only include if needed
      .lean();

    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    res.json(bill);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/bills/session/:sessionId
 * Get all bills for a session - OPTIMIZED
 */
router.get("/session/:sessionId", async (req, res) => {
  try {
    const bills = await Bill.find({ sessionId: req.params.sessionId })
      .select("billNumber customerName phone tableNumber itemsTotal grandTotal paymentStatus billStatus createdAt")
      .sort({ createdAt: -1 })
      .lean();

    res.json(bills);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PUT /api/bills/:billId/print
 * Mark bill as printed
 */
router.put("/:billId/print", async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.billId).lean();
    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    const updatedBill = await Bill.findByIdAndUpdate(
      req.params.billId,
      {
        $set: { printedAt: new Date(), billStatus: "printed" },
        $inc: { printCount: 1 },
        $push: { statusHistory: { status: "printed", by: "user", timestamp: new Date() } }
      },
      { new: true, lean: true }
    );

    res.json({ message: "Bill marked as printed", printCount: updatedBill.printCount });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PUT /api/bills/:billId/mark-printed
 * Mark bill as printed (legacy endpoint)
 */
router.put("/:billId/mark-printed", async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.billId).lean();
    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    const updatedBill = await Bill.findByIdAndUpdate(
      req.params.billId,
      {
        $set: { printedAt: new Date(), billStatus: "printed" },
        $inc: { printCount: 1 },
        $push: { statusHistory: { status: "printed", by: "user", timestamp: new Date() } }
      },
      { new: true, lean: true }
    );

    res.json({ message: "Bill marked as printed", printCount: updatedBill.printCount });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PUT /api/bills/:billId/update-payment
 * Update payment status and method
 */
router.put("/:billId/update-payment", async (req, res) => {
  try {
    const { paymentStatus, paymentMethod, paidAmount, razorpayOrderId, razorpayPaymentId } = req.body;
    const bill = await Bill.findById(req.params.billId);

    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    if (paymentStatus) {
      bill.paymentStatus = paymentStatus;
    }
    if (paymentMethod) {
      bill.paymentMethod = paymentMethod;
    }
    if (paidAmount) {
      bill.paidAmount = paidAmount;
      bill.remainingAmount = Math.max(0, bill.grandTotal - paidAmount);

      if (bill.paidAmount >= bill.grandTotal) {
        bill.paymentStatus = "paid";
        bill.billStatus = "completed";
      }
    }
    if (razorpayOrderId) {
      bill.razorpayOrderId = razorpayOrderId;
    }
    if (razorpayPaymentId) {
      bill.razorpayPaymentId = razorpayPaymentId;
    }

    bill.statusHistory.push({
      status: `payment_${paymentStatus}`,
      by: "admin"
    });

    await bill.save();

    // Update linked orders to reflect payment status
    if (bill.orderIds && bill.orderIds.length > 0) {
      await Order.updateMany(
        { _id: { $in: bill.orderIds } },
        {
          paymentStatus: bill.paymentStatus,
          paymentMethod: bill.paymentMethod,
          razorpayOrderId: bill.razorpayOrderId,
          razorpayPaymentId: bill.razorpayPaymentId
        }
      );
    }

    res.json({
      billId: bill._id,
      paymentStatus: bill.paymentStatus,
      paymentMethod: bill.paymentMethod,
      paidAmount: bill.paidAmount,
      remainingAmount: bill.remainingAmount,
      message: "Payment updated successfully"
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/bills/phone/:phone
 * Get bills by phone number (for customers and admin)
 */
router.get("/phone/:phone", async (req, res) => {
  try {
    const { restaurantId = "default" } = req.query;

    const bills = await Bill.find({
      phone: req.params.phone,
      restaurantId
    }).sort({ createdAt: -1 });

    res.json(bills);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/bills
 * Get all bills (admin endpoint)
 * Supports filtering by status, payment status, date range
 */
router.get("/", async (req, res) => {
  try {
    const { restaurantId = "default", billStatus, paymentStatus, startDate, endDate } = req.query;

    const filter = { restaurantId };

    if (billStatus) filter.billStatus = billStatus;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const bills = await Bill.find(filter)
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(bills);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PUT /api/bills/:billId/apply-discount
 * Apply discount to a bill
 */
router.put("/:billId/apply-discount", async (req, res) => {
  try {
    const { discountAmount, discountPercentage } = req.body;
    const bill = await Bill.findById(req.params.billId);

    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    let newDiscount = bill.discount;

    if (discountPercentage) {
      newDiscount = Math.round(bill.subtotal * (discountPercentage / 100));
      bill.discountPercentage = discountPercentage;
    } else if (discountAmount) {
      newDiscount = discountAmount;
      bill.discountPercentage = Math.round((discountAmount / bill.subtotal) * 100);
    }

    bill.discount = newDiscount;
    const afterDiscount = bill.subtotal - newDiscount;
    bill.tax = Math.round(afterDiscount * 0.05);
    bill.grandTotal = afterDiscount + bill.tax + bill.serviceCharge + bill.packagingCharges;
    bill.remainingAmount = bill.grandTotal - bill.paidAmount;

    await bill.save();

    res.json({
      billId: bill._id,
      discount: bill.discount,
      discountPercentage: bill.discountPercentage,
      tax: bill.tax,
      grandTotal: bill.grandTotal,
      message: "Discount applied successfully"
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

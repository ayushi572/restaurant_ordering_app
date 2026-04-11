const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const MenuItem = require("../models/MenuItem");
const { authenticate, authorize } = require("../middleware/auth");

// POST place order — customer (with session auth)
router.post("/", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: "Authentication required" });

    const Session = require("../models/Session");
    const session = await Session.findOne({ sessionToken: token, isActive: true });
    if (!session) return res.status(401).json({ error: "Invalid session" });

    const { items, customerName, phone } = req.body;

    if (!items || items.length === 0) return res.status(400).json({ error: "No items in order" });
    if (!customerName) return res.status(400).json({ error: "Customer name required" });

    // Get table info
    const Table = require("../models/Table");
    const table = await Table.findById(session.tableId);
    if (!table) return res.status(400).json({ error: "Table not found" });

    // Validate items and recalculate total server-side
    const validatedItems = [];
    let subtotal = 0;
    for (const orderItem of items) {
      const menuItem = await MenuItem.findById(orderItem.itemId);
      if (!menuItem) return res.status(400).json({ error: `Item not found: ${orderItem.itemId}` });
      if (!menuItem.available) return res.status(400).json({ error: `Item is currently unavailable: ${menuItem.name}` });

      const itemTotal = menuItem.price * orderItem.quantity;
      subtotal += itemTotal;
      validatedItems.push({
        itemId: menuItem._id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: orderItem.quantity,
        notes: orderItem.notes || "",
        status: "pending"
      });

      // Decrement stock if tracked
      if (menuItem.stock && menuItem.stock.tracked) {
        menuItem.stock.quantity = Math.max(0, menuItem.stock.quantity - orderItem.quantity);
        if (menuItem.stock.quantity === 0) {
          menuItem.available = false;
          const io = req.app.get("io");
          io.to(`restaurant:${session.restaurantId}`).emit("item_availability", {
            itemId: menuItem._id,
            available: false
          });
        }
        await menuItem.save();
      }
    }

    const tax = Math.round(subtotal * 0.05);
    const total = subtotal + tax;
    const estimatedReadyAt = new Date(Date.now() + 20 * 60 * 1000);

    // Use phone from session first, fall back to request body
    const customerPhone = session.phone || phone || '';

    const order = new Order({
      restaurantId: session.restaurantId,
      tableId: session.tableId,
      tableNumber: table.number,
      sessionId: session._id.toString(),
      customerId: session.customerId || null,
      items: validatedItems,
      subtotal,
      tax,
      discount: 0,
      total,
      customerName,
      phone: customerPhone,
      status: "placed",
      estimatedReadyAt
    });

    await order.save();

    // Clear cart from session
    session.cart = [];
    await session.save();

    // Emit to kitchen and admin
    const io = req.app.get("io");
    io.to(`kitchen:${session.restaurantId}`).emit("new_order", order);
    io.to(`admin:${session.restaurantId}`).emit("new_order", order);

    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET all orders — staff/admin
router.get("/", authenticate, authorize(["admin", "kitchen", "waiter", "cashier"]), async (req, res) => {
  try {
    const { status, tableId, date } = req.query;
    const filter = { restaurantId: req.user.restaurantId };

    if (status) {
      const statuses = status.split(",");
      filter.status = { $in: statuses };
    }
    if (tableId) filter.tableId = tableId;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single order by ID — public (customer tracks order)
router.get("/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET orders by session — customer
router.get("/session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const Session = require("../models/Session");

    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });

    const orders = await Order.find({ sessionId })
      .sort({ createdAt: -1 })
      .populate('customerId', 'phone name');

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET analytics — admin only
router.get("/analytics/summary", authenticate, authorize(["admin"]), async (req, res) => {
  try {
    const { period = "today" } = req.query;
    const restaurantId = req.user.restaurantId;

    let startDate = new Date();
    if (period === "today") startDate.setHours(0, 0, 0, 0);
    else if (period === "week") startDate.setDate(startDate.getDate() - 7);
    else if (period === "month") startDate.setMonth(startDate.getMonth() - 1);

    const [summary] = await Order.aggregate([
      { $match: { restaurantId, status: { $in: ["completed", "served"] }, createdAt: { $gte: startDate } } },
      { $group: { _id: null, revenue: { $sum: "$total" }, count: { $sum: 1 }, avgOrder: { $avg: "$total" } } }
    ]);

    const topItems = await Order.aggregate([
      { $match: { restaurantId, createdAt: { $gte: startDate } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.name", count: { $sum: "$items.quantity" }, revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    const statusCounts = await Order.aggregate([
      { $match: { restaurantId, createdAt: { $gte: startDate } } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    res.json({
      summary: summary || { revenue: 0, count: 0, avgOrder: 0 },
      topItems,
      statusCounts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update order status — staff/admin
router.put("/:id", authenticate, authorize(["admin", "kitchen", "waiter", "cashier"]), async (req, res) => {
  try {
    const { status, cancelReason } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (status === "cancelled" && !["placed", "confirmed"].includes(order.status)) {
      return res.status(400).json({ error: "Order can only be cancelled before preparation starts" });
    }

    order.status = status;
    if (cancelReason) order.cancelReason = cancelReason;
    order.statusHistory.push({
      status,
      by: req.user.name || req.user.role,
      timestamp: new Date()
    });

    await order.save();

    const io = req.app.get("io");
    io.to(`order:${order._id}`).emit("status_changed", {
      orderId: order._id,
      status,
      estimatedReadyAt: order.estimatedReadyAt
    });
    io.to(`admin:${order.restaurantId}`).emit("order_updated", order);

    if (status === "ready") {
      io.to(`kitchen:${order.restaurantId}`).emit("order_ready", {
        orderId: order._id,
        tableNumber: order.tableNumber,
        orderNumber: order.orderNumber
      });
    }

    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
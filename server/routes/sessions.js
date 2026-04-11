const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Session = require("../models/Session");
const Customer = require("../models/Customer");
const Order = require("../models/Order");
const { optionalAuth } = require("../middleware/auth");

/**
 * POST /api/sessions/create
 * Create a new session for a user (called after table verification)
 * Returns: { sessionToken, sessionId }
 */
router.post("/create", async (req, res) => {
  try {
    const { tableId, restaurantId = "default", customerName = "", phone = "", customerId } = req.body;

    if (!tableId) {
      return res.status(400).json({ error: "Table ID is required" });
    }

    const sessionToken = crypto.randomBytes(32).toString("hex");

    const session = new Session({
      restaurantId,
      tableId,
      sessionToken,
      customerName,
      phone,
      customerId: customerId || null
    });

    await session.save();

    res.json({
      sessionToken,
      sessionId: session._id,
      restaurantId,
      tableId
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/sessions/:sessionId
 * Get session details
 */
router.get("/:sessionId", async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId)
      .populate("customerId", "name phone");

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json({
      sessionId: session._id,
      restaurantId: session.restaurantId,
      tableId: session.tableId,
      customerName: session.customerName,
      phone: session.phone,
      customerId: session.customerId?._id,
      isActive: session.isActive,
      expiresAt: session.expiresAt
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/sessions/token/:sessionToken
 * Validate session by token
 */
router.get("/token/:sessionToken", async (req, res) => {
  try {
    const session = await Session.findOne({
      sessionToken: req.params.sessionToken,
      isActive: true,
      expiresAt: { $gt: new Date() }
    }).populate("customerId", "name phone");

    if (!session) {
      return res.status(404).json({ error: "Invalid or expired session" });
    }

    res.json({
      sessionId: session._id,
      restaurantId: session.restaurantId,
      tableId: session.tableId,
      customerName: session.customerName,
      phone: session.phone,
      customerId: session.customerId?._id
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PUT /api/sessions/:sessionId/user-details
 * Store/update user details in session (name and phone)
 * This allows auto-fill for future orders
 */
router.put("/:sessionId/user-details", async (req, res) => {
  try {
    const { customerName, phone, customerId } = req.body;

    const session = await Session.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (customerName) session.customerName = customerName;
    if (phone) session.phone = phone;
    if (customerId) session.customerId = customerId;

    await session.save();

    res.json({
      sessionId: session._id,
      customerName: session.customerName,
      phone: session.phone,
      message: "User details updated successfully"
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PUT /api/sessions/:sessionId/extend
 * Extend session expiry time
 */
router.put("/:sessionId/extend", async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Extend by 4 hours
    session.expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
    await session.save();

    res.json({
      sessionId: session._id,
      expiresAt: session.expiresAt,
      message: "Session extended"
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PUT /api/sessions/:sessionId/end
 * End session (user clears session/logs out)
 */
router.put("/:sessionId/end", async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    session.isActive = false;
    session.expiresAt = new Date(); // Expire immediately
    await session.save();

    res.json({ message: "Session ended" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/sessions/:sessionId/orders
 * Get all orders for a session
 */
router.get("/:sessionId/orders", async (req, res) => {
  try {
    const orders = await Order.find({
      sessionId: req.params.sessionId
    }).sort({ createdAt: -1 });

    if (!orders) {
      return res.json([]);
    }

    res.json(orders);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/sessions/check-existing-user
 * Check if a phone number exists and return session details for auto-fill
 * This is called before login to offer "Continue as [name]?" option
 */
router.post("/check-existing-user", async (req, res) => {
  try {
    const { phone, restaurantId = "default" } = req.body;

    if (!phone) {
      return res.status(400).json({ error: "Phone number required" });
    }

    // Find the most recent session for this phone
    const session = await Session.findOne(
      {
        phone,
        restaurantId,
        isActive: true
      },
      null,
      { sort: { createdAt: -1 } }
    );

    if (session) {
      return res.json({
        exists: true,
        sessionId: session._id,
        customerName: session.customerName,
        phone: session.phone,
        message: `Welcome back, ${session.customerName}!`
      });
    }

    res.json({
      exists: false,
      message: "No previous session found"
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/sessions/phone/:phone
 * Search for sessions by phone number (for admin)
 */
router.get("/phone/:phone", async (req, res) => {
  try {
    const { restaurantId = "default" } = req.query;

    const sessions = await Session.find({
      phone: req.params.phone,
      restaurantId
    }).sort({ createdAt: -1 });

    if (!sessions || sessions.length === 0) {
      return res.json([]);
    }

    res.json(sessions);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

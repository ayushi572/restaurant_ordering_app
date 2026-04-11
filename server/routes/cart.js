const express = require("express");
const router = express.Router();
const Session = require("../models/Session");

// POST /api/cart/sync - Sync cart with session
router.post("/sync", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: "Authentication required" });

    const session = await Session.findOne({ sessionToken: token, isActive: true });
    if (!session) return res.status(401).json({ error: "Invalid session" });

    const { cart } = req.body;
    session.cart = cart || [];
    await session.save();

    res.json({ message: "Cart synced successfully", cart: session.cart });
  } catch (err) {
    res.status(500).json({ error: "Failed to sync cart" });
  }
});

// GET /api/cart - Get cart from session
router.get("/", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: "Authentication required" });

    const session = await Session.findOne({ sessionToken: token, isActive: true });
    if (!session) return res.status(401).json({ error: "Invalid session" });

    res.json({ cart: session.cart });
  } catch (err) {
    res.status(500).json({ error: "Failed to get cart" });
  }
});

module.exports = router;
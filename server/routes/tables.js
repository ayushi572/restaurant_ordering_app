const express = require("express");
const router = express.Router();
const Table = require("../models/Table");
const { authenticate, authorize } = require("../middleware/auth");

// GET table by ID or number — public (for QR verification and manual entry)
router.get("/public/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    const { restaurantId = "default" } = req.query;

    console.log('Table lookup request:', { identifier, restaurantId });

    let table;

    // Try to find by ObjectId first (for QR codes)
    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
      table = await Table.findOne({ _id: identifier, restaurantId });
      console.log('ObjectId lookup result:', table ? 'found' : 'not found');
    }

    // If not found or not an ObjectId, try finding by table number
    if (!table) {
      table = await Table.findOne({ number: identifier, restaurantId });
      console.log('Number lookup result:', table ? 'found' : 'not found');
    }

    if (!table) {
      console.log('Table not found for:', { identifier, restaurantId });
      return res.status(404).json({ error: "Table not found" });
    }

    console.log('Table found:', { number: table.number, id: table._id });
    res.json({
      id: table._id,
      number: table.number,
      capacity: table.capacity,
      status: table.status
    });
  } catch (err) {
    console.error("Table lookup error:", err);
    res.status(500).json({ error: "Failed to verify table" });
  }
});

// GET all tables — staff/admin
router.get("/", authenticate, authorize(["admin", "waiter", "cashier"]), async (req, res) => {
  try {
    const tables = await Table.find({ restaurantId: req.user.restaurantId }).sort({ number: 1 });
    res.json(tables);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create table — admin only
router.post("/", authenticate, authorize(["admin"]), async (req, res) => {
  try {
    const { number, capacity } = req.body;
    const restaurantId = req.user.restaurantId;

    const table = new Table({
      restaurantId,
      number,
      capacity: capacity || 4
    });
    await table.save();

    // Generate QR code
    const { generateSingleQR } = require("../utils/qrGenerator");
    const qrCode = await generateSingleQR(restaurantId, table._id.toString());
    table.qrCode = qrCode;
    await table.save();

    res.json(table);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH update table status
router.patch("/:id/status", authenticate, authorize(["admin", "waiter"]), async (req, res) => {
  try {
    const { status, sessionId } = req.body;
    const table = await Table.findByIdAndUpdate(
      req.params.id,
      { status, currentSessionId: sessionId || "" },
      { new: true }
    );
    if (!table) return res.status(404).json({ error: "Table not found" });
    const io = req.app.get("io");
    io.to(`admin:${table.restaurantId}`).emit("table_updated", table);
    res.json(table);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE table — admin only
router.delete("/:id", authenticate, authorize(["admin"]), async (req, res) => {
  try {
    await Table.findByIdAndDelete(req.params.id);
    res.json({ message: "Table deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

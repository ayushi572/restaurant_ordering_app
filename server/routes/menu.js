const express = require("express");
const router = express.Router();
const MenuItem = require("../models/MenuItem");
const { authenticate, authorize } = require("../middleware/auth");

// GET all menu items (public — used by customer menu)
router.get("/", async (req, res) => {
  try {
    const { restaurantId = "default", category } = req.query;
    const filter = { restaurantId };
    if (category) filter.category = category;
    const items = await MenuItem.find(filter).sort({ category: 1, sortOrder: 1, name: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET categories
router.get("/categories", async (req, res) => {
  try {
    const { restaurantId = "default" } = req.query;
    const cats = await MenuItem.distinct("category", { restaurantId, available: true });
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single item
router.get("/:id", async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add new menu item — admin only
router.post("/", authenticate, authorize(["admin"]), async (req, res) => {
  try {
    const item = new MenuItem({ ...req.body, restaurantId: req.user.restaurantId });
    await item.save();
    // Notify all menu clients of update
    const io = req.app.get("io");
    io.to(`restaurant:${req.user.restaurantId}`).emit("menu_updated", { action: "added", item });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update menu item — admin only
router.put("/:id", authenticate, authorize(["admin"]), async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ error: "Item not found" });
    const io = req.app.get("io");
    io.to(`restaurant:${item.restaurantId}`).emit("menu_updated", { action: "updated", item });
    // If availability changed, emit specific event
    if (req.body.available !== undefined) {
      io.to(`restaurant:${item.restaurantId}`).emit("item_availability", {
        itemId: item._id,
        available: item.available
      });
    }
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH toggle availability quickly — admin or kitchen
router.patch("/:id/availability", authenticate, authorize(["admin", "kitchen"]), async (req, res) => {
  try {
    const { available } = req.body;
    const item = await MenuItem.findByIdAndUpdate(req.params.id, { available }, { new: true });
    if (!item) return res.status(404).json({ error: "Item not found" });
    const io = req.app.get("io");
    io.to(`restaurant:${item.restaurantId}`).emit("item_availability", { itemId: item._id, available });
    res.json({ success: true, item });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE menu item — admin only
router.delete("/:id", authenticate, authorize(["admin"]), async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: "Item not found" });
    const io = req.app.get("io");
    io.to(`restaurant:${item.restaurantId}`).emit("menu_updated", { action: "deleted", itemId: req.params.id });
    res.json({ message: "Item deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

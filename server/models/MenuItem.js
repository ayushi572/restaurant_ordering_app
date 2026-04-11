const mongoose = require("mongoose");

const MenuItemSchema = new mongoose.Schema({
  restaurantId: { type: String, default: "default" },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  image: { type: String, default: "" },
  description: { type: String, default: "" },
  available: { type: Boolean, default: true },
  stock: {
    tracked: { type: Boolean, default: false },
    quantity: { type: Number, default: 0 },
    threshold: { type: Number, default: 5 },
    unit: { type: String, default: "portions" }
  },
  preparationTime: { type: Number, default: 15 }, // minutes
  isVeg: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

MenuItemSchema.index({ restaurantId: 1, category: 1, available: 1 });

module.exports = mongoose.model("MenuItem", MenuItemSchema);

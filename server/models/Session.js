const mongoose = require("mongoose");
const crypto = require("crypto");

const SessionSchema = new mongoose.Schema({
  restaurantId: { type: String, default: "default" },
  tableId: { type: String, required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  sessionToken: { type: String, required: true, unique: true },
  
  // User Details - Store name and phone for auto-fill
  customerName: { type: String, default: "" },
  phone: { type: String, default: "" },
  
  isActive: { type: Boolean, default: true },
  cart: [{
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem" },
    name: String,
    price: Number,
    quantity: Number,
    notes: { type: String, default: "" }
  }],
  
  // Order History - Link all orders for this session
  orderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
  billIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Bill" }],
  
  expiresAt: { type: Date, default: () => new Date(Date.now() + 4 * 60 * 60 * 1000) } // 4 hours
}, { timestamps: true });

SessionSchema.index({ sessionToken: 1 });
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-expire sessions
SessionSchema.index({ tableId: 1, isActive: 1 });
SessionSchema.index({ phone: 1, restaurantId: 1 }); // For quick lookup by phone

module.exports = mongoose.model("Session", SessionSchema);
const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  restaurantId: { type: String, default: "default" },
  tableId: { type: String, default: "" },
  tableNumber: { type: String, default: "" },
  sessionId: { type: String, default: "" },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  billId: { type: mongoose.Schema.Types.ObjectId, ref: "Bill", default: null }, // Link to bill
  orderNumber: { type: Number },
  items: [{
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem" },
    name: String,
    price: Number,
    quantity: Number,
    notes: { type: String, default: "" },
    status: { type: String, default: "pending", enum: ["pending", "preparing", "ready"] }
  }],
  subtotal: { type: Number, required: true },
  tax: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  total: { type: Number, required: true },
  customerName: { type: String, required: true },
  phone: { type: String, required: true },
  status: {
    type: String,
    default: "placed",
    enum: ["placed", "confirmed", "preparing", "ready", "served", "completed", "cancelled", "payment_pending", "payment_failed"]
  },
  paymentStatus: { type: String, default: "pending", enum: ["pending", "paid", "refunded", "failed"] },
  paymentMethod: { type: String, default: "", enum: ["", "razorpay", "cash", "upi"] },
  paymentId: { type: String, default: "" },
  razorpayOrderId: { type: String, default: "" },
  razorpayPaymentId: { type: String, default: "" },
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    by: { type: String, default: "system" }
  }],
  estimatedReadyAt: { type: Date },
  cancelReason: { type: String, default: "" }
}, { timestamps: true });

// Auto-increment orderNumber per restaurant
OrderSchema.pre("save", async function(next) {
  if (this.isNew) {
    const lastOrder = await this.constructor.findOne(
      { restaurantId: this.restaurantId },
      { orderNumber: 1 },
      { sort: { orderNumber: -1 } }
    );
    this.orderNumber = lastOrder ? lastOrder.orderNumber + 1 : 1;
    this.statusHistory.push({ status: "placed", by: "customer" });
  }
  next();
});

OrderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
OrderSchema.index({ tableId: 1, status: 1 });
OrderSchema.index({ sessionId: 1 });
OrderSchema.index({ billId: 1 });
OrderSchema.index({ phone: 1, restaurantId: 1 });

module.exports = mongoose.model("Order", OrderSchema);

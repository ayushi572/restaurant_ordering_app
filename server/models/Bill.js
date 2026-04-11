const mongoose = require("mongoose");

const BillSchema = new mongoose.Schema({
  restaurantId: { type: String, default: "default" },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "Session", required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  
  // Link multiple orders into one bill
  orderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true }],
  
  // Bill Details
  billNumber: { type: Number },
  customerName: { type: String, required: true },
  phone: { type: String, required: true },
  tableNumber: { type: String },
  
  // Itemized breakdown
  items: [{
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem" },
    name: String,
    price: Number,
    quantity: Number,
    totalPrice: Number
  }],
  
  // Financial Summary
  itemsTotal: { type: Number, required: true },
  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  discountPercentage: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  serviceCharge: { type: Number, default: 0 },
  packagingCharges: { type: Number, default: 0 },
  grandTotal: { type: Number, required: true },
  
  // Payment Information
  paymentStatus: {
    type: String,
    default: "pending",
    enum: ["pending", "paid", "partial", "refunded"]
  },
  paymentMethod: {
    type: String,
    default: "",
    enum: ["", "cash", "upi", "razorpay", "card", "wallet"]
  },
  paymentId: { type: String, default: "" },
  razorpayOrderId: { type: String, default: "" },
  razorpayPaymentId: { type: String, default: "" },
  paidAmount: { type: Number, default: 0 },
  remainingAmount: { type: Number, default: 0 },
  
  // Bill Status
  billStatus: {
    type: String,
    default: "generated",
    enum: ["generated", "displayed", "printed", "completed", "cancelled"]
  },
  
  // Notes and Metadata
  notes: { type: String, default: "" },
  printedAt: { type: Date, default: null },
  printCount: { type: Number, default: 0 },
  
  // Timeline
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    by: { type: String, default: "system" }
  }]
}, { timestamps: true });

// Auto-increment billNumber per restaurant - optimized with indexed query
BillSchema.pre("save", async function(next) {
  if (this.isNew) {
    const lastBill = await this.constructor.findOne(
      { restaurantId: this.restaurantId },
      { billNumber: 1 },
      { sort: { billNumber: -1 } }
    ).lean();
    // Uses index: { restaurantId: 1, billNumber: 1, createdAt: -1 }
    this.billNumber = lastBill ? lastBill.billNumber + 1 : 1;
    this.statusHistory.push({ status: "generated", by: "system" });
  }
  next();
});

// Optimized indexes for fastest queries
BillSchema.index({ restaurantId: 1, billNumber: -1 }); // Fastest bill number increment lookup
BillSchema.index({ restaurantId: 1, billStatus: 1, createdAt: -1 }); // Filter by status
BillSchema.index({ sessionId: 1, createdAt: -1 }); // Bills by session
BillSchema.index({ customerId: 1, createdAt: -1 }); // Bills by customer
BillSchema.index({ phone: 1, restaurantId: 1, createdAt: -1 }); // Phone lookup
BillSchema.index({ paymentStatus: 1, createdAt: -1 }); // Payment status queries
BillSchema.index({ billStatus: 1 }); // For status filtering

module.exports = mongoose.model("Bill", BillSchema);

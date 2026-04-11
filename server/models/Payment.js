const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  restaurantId: { type: String, default: "default" },
  amount: { type: Number, required: true },
  method: { type: String, default: "razorpay", enum: ["razorpay", "cash", "upi"] },
  status: { type: String, default: "pending", enum: ["pending", "success", "failed", "refunded"] },
  gatewayOrderId: { type: String, default: "" },
  gatewayPaymentId: { type: String, default: "" },
  gatewaySignature: { type: String, default: "" },
  refundId: { type: String, default: "" },
  refundAmount: { type: Number, default: 0 },
  paidAt: { type: Date },
  notes: { type: String, default: "" }
}, { timestamps: true });

PaymentSchema.index({ orderId: 1 });
PaymentSchema.index({ gatewayOrderId: 1 });

module.exports = mongoose.model("Payment", PaymentSchema);

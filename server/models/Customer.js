const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema({
  restaurantId: { type: String, default: "default" },
  phone: { type: String, required: true, unique: true },
  name: { type: String, default: "" },
  otp: { type: String, default: "" },
  otpExpiry: { type: Date, default: null },
  isVerified: { type: Boolean, default: false },
  lastLogin: { type: Date, default: Date.now },
  deviceId: { type: String, default: "" } // For session tracking
}, { timestamps: true });

CustomerSchema.index({ phone: 1, restaurantId: 1 }, { unique: true });
CustomerSchema.index({ otpExpiry: 1 }, { expireAfterSeconds: 0 }); // Auto-expire OTP

module.exports = mongoose.model("Customer", CustomerSchema);
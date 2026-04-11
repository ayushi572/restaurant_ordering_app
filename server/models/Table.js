const mongoose = require("mongoose");

const TableSchema = new mongoose.Schema({
  restaurantId: { type: String, default: "default" },
  number: { type: String, required: true },
  capacity: { type: Number, default: 4 },
  status: { type: String, default: "free", enum: ["free", "occupied", "reserved"] },
  currentSessionId: { type: String, default: "" },
  qrCode: { type: String, default: "" }
}, { timestamps: true });

TableSchema.index({ restaurantId: 1, number: 1 }, { unique: true });

module.exports = mongoose.model("Table", TableSchema);

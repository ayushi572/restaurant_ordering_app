const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.set("io", io);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: "*" }));
app.use(express.json());

// Development: Disable rate limiting for easier testing
// const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10000, message: { error: "Too many requests." } });
// const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, message: { error: "Too many auth attempts." } });
// app.use("/api/", apiLimiter);
// app.use("/api/auth/", authLimiter);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("MongoDB error:", err));

io.on("connection", (socket) => {
  socket.on("join_kitchen", ({ restaurantId }) => {
    socket.join(`kitchen:${restaurantId}`);
  });
  socket.on("track_order", async ({ orderId }) => {
    socket.join(`order:${orderId}`);
    // Send current status to the client
    try {
      const Order = require("./models/Order");
      const order = await Order.findById(orderId);
      if (order) {
        socket.emit("status_changed", { orderId, status: order.status, estimatedReadyAt: order.estimatedReadyAt });
      }
    } catch (err) {
      console.error("Error fetching order status:", err);
    }
  });
  socket.on("join_restaurant", ({ restaurantId }) => {
    socket.join(`restaurant:${restaurantId}`);
  });
  socket.on("join_admin", ({ restaurantId }) => {
    socket.join(`admin:${restaurantId}`);
  });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/auth", require("./routes/customerAuth"));
app.use("/api/sessions", require("./routes/sessions"));
app.use("/api/menu", require("./routes/menu"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/tables", require("./routes/tables"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/cart", require("./routes/cart"));
app.use("/api/bills", require("./routes/bills"));

app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = { io };

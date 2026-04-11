const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Customer = require("../models/Customer");
const Session = require("../models/Session");
const Table = require("../models/Table");
const otpService = require("../services/otpService");
const { JWT_SECRET } = require("../middleware/auth");

// Rate limiting middleware (basic)
const otpRequests = new Map();
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes
const MAX_OTP_REQUESTS = 3;

const checkRateLimit = (phone) => {
  const now = Date.now();
  const requests = otpRequests.get(phone) || [];

  // Clean old requests
  const validRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);

  if (validRequests.length >= MAX_OTP_REQUESTS) {
    return false;
  }

  validRequests.push(now);
  otpRequests.set(phone, validRequests);
  return true;
};

// POST /api/auth/customer/send-otp
// router.post("/customer/send-otp", async (req, res) => {
//   try {
//     const { phone, restaurantId = "default" } = req.body;

//     if (!phone || !/^[\+]?[1-9][\d]{9,14}$/.test(phone)) {
//       return res.status(400).json({ error: "Valid phone number required" });
//     }

//     if (!checkRateLimit(phone)) {
//       return res.status(429).json({ error: "Too many OTP requests. Try again later." });
//     }

//     const otp = otpService.generateOTP();
//     await otpService.sendOTP(phone, otp);

//     // Create or update customer record
//     let customer = await Customer.findOne({ phone, restaurantId });
//     if (!customer) {
//       customer = new Customer({ phone, restaurantId });
//     }
//     customer.otp = otpService.hashOTP(otp);
//     customer.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
//     await customer.save();

//     // DEVELOPMENT MODE: Include OTP in response for testing
//     const isDevelopment = process.env.NODE_ENV !== 'production';
//     const response = {
//       message: "OTP sent successfully",
//       expiresIn: 300
//     };

//     if (isDevelopment) {
//       response.testOtp = otp; // Only in development
//       response.message += " (Check server console for OTP)";
//     }

//     res.json(response);
//   } catch (err) {
//     console.error("Send OTP error:", err);
//     res.status(500).json({ error: "Failed to send OTP" });
//   }
// });

router.post("/customer/send-otp", async (req, res) => {
  try {
    const { phone, restaurantId = "default" } = req.body;

    if (!phone || !/^[\+]?[1-9][\d]{9,14}$/.test(phone)) {
      return res.status(400).json({ error: "Valid phone number required" });
    }

    if (!checkRateLimit(phone)) {
      return res.status(429).json({ error: "Too many OTP requests. Try again later." });
    }

    const otp = otpService.generateOTP();

    // ── Step 1: Save to DB FIRST before sending SMS ───────────────────────
    let customer = await Customer.findOne({ phone, restaurantId });
    if (!customer) {
      customer = new Customer({ phone, restaurantId });
    }
    customer.otp       = otpService.hashOTP(otp);
    customer.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await customer.save();

    // ── Step 2: Send SMS via MSG91 ────────────────────────────────────────
    if (process.env.NODE_ENV === "production") {
      const axios = require("axios");

      // Format number — MSG91 needs 12 digits: 919876543210
      const digits = phone.replace(/\D/g, "");
      const mobile = digits.length === 10 ? `91${digits}` : digits;

      const result = await axios.post(
        "https://control.msg91.com/api/v5/otp",
        {
          authkey:     process.env.MSG91_AUTH_KEY,
          template_id: process.env.MSG91_TEMPLATE_ID,
          mobile:      mobile,
          otp:         otp,
        },
        { headers: { "Content-Type": "application/json" } }
      );

      console.log("MSG91 response:", result.data);

      if (result.data.type !== "success") {
        console.error("MSG91 error:", result.data);
        return res.status(500).json({ 
          error: `SMS failed: ${result.data.message || "Unknown MSG91 error"}` 
        });
      }

    } else {
      // Development: print OTP to Render/terminal logs
      console.log(`\n📱 DEV OTP for ${phone}: ${otp}\n`);
    }

    // ── Step 3: Send response ─────────────────────────────────────────────
    const response = {
      message:   "OTP sent successfully",
      expiresIn: 300,
    };

    // Only include OTP in response body in development
    if (process.env.NODE_ENV !== "production") {
      response.testOtp = otp;
    }

    res.json(response);

  } catch (err) {
    console.error("Send OTP error:", err.message);
    res.status(500).json({ error: err.message || "Failed to send OTP" });
  }
});

// POST /api/auth/customer/verify-otp
router.post("/customer/verify-otp", async (req, res) => {
  try {
    const { phone, otp, tableId, restaurantId = "default" } = req.body;

    if (!phone || !otp || !tableId) {
      return res.status(400).json({ error: "Phone, OTP, and tableId required" });
    }

    // Verify OTP
    if (!otpService.verifyOTP(phone, otp)) {
      return res.status(401).json({ error: "Invalid or expired OTP" });
    }

    // Get or create customer
    let customer = await Customer.findOne({ phone, restaurantId });
    if (!customer) {
      // Auto-create customer on first login
      customer = new Customer({
        phone,
        restaurantId,
        isVerified: true,
        lastLogin: new Date()
      });
    } else {
      customer.isVerified = true;
      customer.lastLogin = new Date();
    }
    await customer.save();

    // Check if table exists (handle both ObjectId and table number)
    let table;
    if (tableId.match(/^[0-9a-fA-F]{24}$/)) {
      // It's an ObjectId
      table = await Table.findOne({ _id: tableId, restaurantId });
    } else {
      // It's a table number
      table = await Table.findOne({ number: tableId, restaurantId });
    }

    if (!table) {
      return res.status(404).json({ error: "Table not found" });
    }

    // Use the actual ObjectId for session creation
    const actualTableId = table._id.toString();

    // Create session
    const sessionToken = jwt.sign(
      { customerId: customer._id, tableId: actualTableId, restaurantId },
      JWT_SECRET,
      { expiresIn: "4h" }
    );

    const session = new Session({
      restaurantId,
      tableId: actualTableId,
      customerId: customer._id,
      sessionToken,
      customerName: customer.name || "", // Store customer name if available
      phone: customer.phone // Store phone in session for easy access
    });
    await session.save();

    // Update table status
    table.status = "occupied";
    table.currentSessionId = session._id.toString();
    await table.save();

    res.json({
      token: sessionToken,
      customer: {
        id: customer._id,
        phone: customer.phone,
        name: customer.name
      },
      session: {
        sessionId: session._id,
        sessionToken: session.sessionToken,
        tableId: table._id,
        tableNumber: table.number,
        restaurantId: restaurantId,
        customerId: customer._id
      }
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ error: "Failed to verify OTP" });
  }
});

// POST /api/auth/customer/logout
router.post("/customer/logout", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: "No token provided" });

    const session = await Session.findOne({ sessionToken: token });
    if (session) {
      session.isActive = false;
      await session.save();

      // Check if any active sessions for this table
      const activeSessions = await Session.countDocuments({
        tableId: session.tableId,
        isActive: true
      });

      if (activeSessions === 0) {
        await Table.findByIdAndUpdate(session.tableId, {
          status: "free",
          currentSessionId: ""
        });
      }
    }

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ error: "Logout failed" });
  }
});

// GET /api/auth/customer/me - Get current session info
router.get("/customer/me", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: "No token provided" });

    const session = await Session.findOne({ sessionToken: token, isActive: true })
      .populate('customerId', 'phone name')
      .populate('tableId', 'number capacity');

    if (!session) return res.status(401).json({ error: "Invalid session" });

    res.json({
      customer: session.customerId,
      table: session.tableId,
      session: {
        id: session._id,
        cart: session.cart
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get session info" });
  }
});

module.exports = router;
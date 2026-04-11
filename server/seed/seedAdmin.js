const mongoose = require("mongoose");
const User = require("../models/User");
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => { console.error(err); process.exit(1); });

const seed = async () => {
  try {
    // Create default admin
    const existing = await User.findOne({ email: "admin@restaurant.com" });
    if (existing) {
      console.log("Admin already exists — skipping.");
      console.log("⚠️  To update password, delete the admin user first.");
    } else {
      await User.create({
        name: "Admin",
        email: "admin@restaurant.com",
        password: "RestaurantAdmin#2024!Secure",
        role: "admin",
        restaurantId: "default"
      });
      console.log("✅ Admin created:");
      console.log("   Email: admin@restaurant.com");
      console.log("   Password: RestaurantAdmin#2024!Secure");
    }

    // Create kitchen staff
    const kitchenExists = await User.findOne({ email: "kitchen@restaurant.com" });
    if (!kitchenExists) {
      await User.create({
        name: "Kitchen Staff",
        email: "kitchen@restaurant.com",
        password: "KitchenStaff#2024!Access",
        role: "kitchen",
        restaurantId: "default"
      });
      console.log("✅ Kitchen user created:");
      console.log("   Email: kitchen@restaurant.com");
      console.log("   Password: KitchenStaff#2024!Access");
    }

    // Create cashier
    const cashierExists = await User.findOne({ email: "cashier@restaurant.com" });
    if (!cashierExists) {
      await User.create({
        name: "Cashier",
        email: "cashier@restaurant.com",
        password: "CashierRole#2024!Secure",
        role: "cashier",
        restaurantId: "default"
      });
      console.log("✅ Cashier created:");
      console.log("   Email: cashier@restaurant.com");
      console.log("   Password: CashierRole#2024!Secure");
    }

    console.log("\n✅ All staff accounts ready.");
  } catch (err) {
    console.error("Seed error:", err.message);
  } finally {
    process.exit();
  }
};

seed();

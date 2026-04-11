const mongoose = require("mongoose");
const MenuItem = require("../models/MenuItem");
const Customer = require("../models/Customer");
const Table = require("../models/Table");
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => { console.error(err); process.exit(1); });

const menuData = [
  { name: "Margherita Pizza", price: 250, category: "Pizza", isVeg: true, image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400", description: "Classic pizza with tomato sauce, mozzarella, and fresh basil" },
  { name: "Pepperoni Pizza", price: 300, category: "Pizza", isVeg: false, image: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400", description: "Pizza topped with pepperoni slices and mozzarella cheese" },
  { name: "Chicken Burger", price: 180, category: "Burgers", isVeg: false, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400", description: "Juicy chicken patty with lettuce, tomato, and mayo" },
  { name: "Veg Burger", price: 140, category: "Burgers", isVeg: true, image: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=400", description: "Crispy veggie patty with fresh veggies and cheese" },
  { name: "Caesar Salad", price: 150, category: "Salads", isVeg: true, image: "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400", description: "Fresh romaine lettuce with Caesar dressing and croutons" },
  { name: "Greek Salad", price: 170, category: "Salads", isVeg: true, image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400", description: "Mediterranean salad with feta cheese and olives" },
  { name: "Chocolate Lava Cake", price: 130, category: "Desserts", isVeg: true, image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400", description: "Warm chocolate cake with a gooey center, served with ice cream" },
  { name: "Ice Cream Sundae", price: 100, category: "Desserts", isVeg: true, image: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400", description: "Vanilla ice cream with chocolate syrup, nuts and cherry" },
  { name: "Masala Chai", price: 40, category: "Beverages", isVeg: true, image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400", description: "Traditional Indian spiced tea with ginger and cardamom" },
  { name: "Fresh Lime Soda", price: 60, category: "Beverages", isVeg: true, image: "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400", description: "Refreshing lime soda, sweet or salted" },
];

const seed = async () => {
  try {
    // Clear existing data
    await MenuItem.deleteMany({ restaurantId: "default" });
    await Customer.deleteMany({ restaurantId: "default" });
    await Table.deleteMany({ restaurantId: "default" });

    // Seed menu items
    await MenuItem.insertMany(menuData.map(d => ({
      ...d,
      restaurantId: "default",
      available: true,
      stock: { tracked: true, quantity: Math.floor(Math.random() * 50) + 10 }
    })));

    // Seed customers
    const customers = [
      { phone: "+919876543210", name: "John Doe", restaurantId: "default" },
      { phone: "+919876543211", name: "Jane Smith", restaurantId: "default" }
    ];
    await Customer.insertMany(customers);

    // Seed tables
    const tables = [];
    for (let i = 1; i <= 10; i++) {
      tables.push({
        restaurantId: "default",
        number: `T${i}`,
        capacity: 4,
        status: "free"
      });
    }
    await Table.insertMany(tables);

    // Generate QR codes
    const { generateQRCodes } = require("../utils/qrGenerator");
    await generateQRCodes();

    console.log(`Seeded ${menuData.length} menu items, ${customers.length} customers, and ${tables.length} tables successfully.`);
    console.log("QR codes generated for all tables.");
  } catch (err) {
    console.error("Seeding error:", err.message);
  } finally {
    process.exit();
  }
};

seed();

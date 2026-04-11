const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function deleteOldAccounts() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const deleted = await User.deleteMany({ email: { $in: ['admin@restaurant.com', 'kitchen@restaurant.com', 'cashier@restaurant.com'] } });
    console.log('✅ Deleted old accounts:', deleted.deletedCount);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deleteOldAccounts();

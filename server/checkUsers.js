const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const users = await User.find({ email: { $in: ['admin@restaurant.com', 'kitchen@restaurant.com', 'cashier@restaurant.com'] } });
    console.log('Users in database:');
    users.forEach(u => {
      console.log('- Email:', u.email, '| Role:', u.role, '| isActive:', u.isActive);
    });
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkUsers();

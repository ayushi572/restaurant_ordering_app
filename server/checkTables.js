const mongoose = require('mongoose');
const Table = require('./models/Table');
require('dotenv').config();

async function checkTables() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const tables = await Table.find({restaurantId: 'default'});
    console.log('Tables in database:');
    tables.forEach(table => {
      console.log(`- Number: ${table.number}, ID: ${table._id}`);
    });
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkTables();
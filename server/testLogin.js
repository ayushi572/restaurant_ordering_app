const axios = require('axios');

async function testLogin() {
  try {
    const response = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@restaurant.com',
      password: 'RestaurantAdmin#2024!Secure'
    });
    console.log('✅ Login successful:', response.data);
  } catch (error) {
    console.log('❌ Login error:', error.response?.data || error.message);
  }
}

testLogin();

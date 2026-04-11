import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useSession } from '../context/SessionContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const OrderSummary = () => {
  const { items, subtotal, tax, grandTotal, clearCart } = useCart();
  const navigate = useNavigate();
  const { session, userDetails, isInitialized } = useSession();
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Wait for SessionContext to initialize
    if (!isInitialized) {
      return;
    }

    // Check authentication
    const token = localStorage.getItem('customerToken');
    if (!token || !session.sessionId) {
      navigate('/login');
      return;
    }

    // Pre-fill customer info if available
    if (userDetails.name || userDetails.phone) {
      setCustomerInfo({ 
        name: userDetails.name || '', 
        phone: userDetails.phone || '' 
      });
    }
  }, [navigate, session.sessionId, userDetails.name, isInitialized]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerInfo.name) {
      setError('Please enter your name');
      return;
    }
    if (!customerInfo.phone || customerInfo.phone.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('customerToken');
      const orderData = {
        items: items.map(item => ({
          itemId: item._id,
          name: item.name,
          quantity: item.quantity,
          notes: item.notes || ''
        })),
        customerName: customerInfo.name,
        phone: customerInfo.phone
      };

      const res = await axios.post(`${API_URL}/api/orders`, orderData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      clearCart();
      navigate(`/track/${res.data._id}`, { state: { order: res.data } });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) return (
    <div className="min-h-screen bg-gradient-to-br from-orange-950 via-red-900 to-orange-900 flex items-center justify-center">
      <div className="text-center text-white">
        <div className="text-5xl mb-4">🛒</div>
        <h2 className="text-2xl font-bold mb-4">Your cart is empty</h2>
        <button onClick={() => navigate('/menu')} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg">
          Back to Menu
        </button>
      </div>
    </div>
  );

  // Show loading while SessionContext initializes
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-950 via-red-900 to-orange-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin h-12 w-12 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-xl">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-950 via-red-900 to-orange-900 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <motion.div
          className="bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-white/10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Order Summary</h2>

          {session.tableNumber && (
            <div className="bg-orange-500/20 border border-orange-400/30 rounded-lg px-4 py-2 text-orange-200 text-sm mb-5 text-center">
              🪑 Dine-in — Table {session.tableNumber}
            </div>
          )}

          {/* Items */}
          <div className="space-y-3 mb-5">
            {items.map(item => (
              <div key={item._id} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                <img
                  src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'}
                  alt={item.name}
                  className="w-14 h-14 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <p className="text-white font-medium">{item.name}</p>
                  <p className="text-gray-300 text-sm">₹{item.price} × {item.quantity}</p>
                </div>
                <span className="text-orange-300 font-semibold">₹{item.price * item.quantity}</span>
              </div>
            ))}
          </div>

          {/* Bill breakdown */}
          <div className="bg-white/5 rounded-lg p-4 mb-5 space-y-2 text-sm">
            <div className="flex justify-between text-gray-300"><span>Subtotal</span><span>₹{subtotal}</span></div>
            <div className="flex justify-between text-gray-300"><span>GST (5%)</span><span>₹{tax}</span></div>
            <div className="flex justify-between text-white font-bold text-lg pt-2 border-t border-white/20">
              <span>Total</span><span>₹{grandTotal}</span>
            </div>
          </div>

          {/* Customer info form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-white/80 text-sm mb-1">Your Name</label>
              <input
                type="text"
                value={customerInfo.name}
                onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                className="w-full p-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/20 focus:outline-none focus:border-orange-400"
                placeholder="Enter your name"
                required
              />
            </div>
            <div>
              <label className="block text-white/80 text-sm mb-1">Phone Number</label>
              <input
                type="tel"
                value={customerInfo.phone}
                onChange={e => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                className="w-full p-3 rounded-lg bg-white/10 text-white placeholder-gray-400 border border-white/20 focus:outline-none focus:border-orange-400"
                placeholder="10-digit mobile number"
                maxLength={10}
                required
              />
            </div>

            {error && <div className="text-red-400 text-sm text-center bg-red-400/10 rounded-lg p-2">{error}</div>}

            <motion.button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white py-3 rounded-lg font-semibold transition-colors"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              {loading ? 'Placing Order...' : `Place Order · ₹${grandTotal}`}
            </motion.button>
          </form>

          <button
            onClick={() => navigate('/menu')}
            className="w-full mt-3 text-gray-400 hover:text-white text-sm py-2 transition-colors"
          >
            ← Back to Menu
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default OrderSummary;

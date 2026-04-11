import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import CategoryTabs from '../components/CategoryTabs';
import MenuItemCard from '../components/MenuItemCard';
import { useMenuSocket } from '../hooks/useSocket';
import { useCart } from '../context/CartContext';
import { useSession } from '../context/SessionContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Home = () => {
  const navigate = useNavigate();
  const { session, isInitialized } = useSession();
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { removeUnavailable, loadCartFromBackend } = useCart();

  // Check authentication after SessionContext initializes
  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    const token = localStorage.getItem('customerToken');
    
    if (!token || !session.sessionId) {
      navigate('/login');
      return;
    }

    // Set axios default header
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    // Load cart from backend
    loadCartFromBackend();
  }, [navigate, loadCartFromBackend, isInitialized, session.sessionId]);

  const restaurantId = session.restaurantId || 'default';
  const tableId = session.tableId || '';
  const tableNumber = session.tableNumber || '';

  // Real-time menu updates via socket
  useMenuSocket(
    restaurantId,
    ({ itemId, available }) => {
      setMenuItems(prev => prev.map(item =>
        item._id === itemId ? { ...item, available } : item
      ));
      // If item became unavailable, remove from cart
      if (!available) removeUnavailable(itemId);
    },
    ({ action, item, itemId }) => {
      if (action === 'added') setMenuItems(prev => [...prev, item]);
      else if (action === 'updated') setMenuItems(prev => prev.map(i => i._id === item._id ? item : i));
      else if (action === 'deleted') setMenuItems(prev => prev.filter(i => i._id !== itemId));
    }
  );

  useEffect(() => {
    if (!isInitialized) return;
    fetchMenu();
  }, [isInitialized, restaurantId]);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${API_URL}/api/menu?restaurantId=${restaurantId}`);
      setMenuItems(res.data);
      const cats = [...new Set(res.data.map(i => i.category))];
      setCategories(cats);
    } catch (err) {
      console.error('Menu load failed:', err);
      const message = err.response?.data?.error || err.message || 'Failed to load menu. Please refresh.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = activeCategory === 'All'
    ? menuItems
    : menuItems.filter(i => i.category === activeCategory);

  // Show loading while SessionContext initializes
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-950 via-red-900 to-orange-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🍽️</div>
          <div className="text-white text-xl animate-pulse">Initializing...</div>
        </div>
      </div>
    );
  }

  // Verify session is available
  if (!session.sessionId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-950 via-red-900 to-orange-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-xl">Session not found. Please login again.</p>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-orange-950 via-red-900 to-orange-900 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">🍽️</div>
        <div className="text-white text-xl animate-pulse">Loading menu...</div>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-orange-950 via-red-900 to-orange-900 flex items-center justify-center">
      <div className="text-center text-white">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-xl mb-4">{error}</p>
        <button onClick={fetchMenu} className="bg-orange-500 hover:bg-orange-600 px-6 py-2 rounded-lg">Retry</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-950 via-red-900 to-orange-900">
      <Header tableId={tableId} tableNumber={tableNumber} />

      {tableId && (
        <motion.div
          className="max-w-7xl mx-auto px-4 pt-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="bg-orange-500/20 border border-orange-400/30 rounded-lg px-4 py-2 text-orange-200 text-sm flex items-center gap-2">
            <span>🪑</span>
            <span>Table <strong>{tableId}</strong> — Dine-in session active</span>
          </div>
        </motion.div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        <motion.h2
          className="text-3xl font-bold text-white mb-6 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Our Menu
        </motion.h2>

        <CategoryTabs categories={categories} activeCategory={activeCategory} onCategoryChange={setActiveCategory} />

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {filteredItems.map((item, index) => (
            <motion.div
              key={item._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <MenuItemCard item={item} />
            </motion.div>
          ))}
        </motion.div>

        {filteredItems.length === 0 && (
          <div className="text-center text-white/70 text-xl mt-12">No items in this category</div>
        )}
      </div>
    </div>
  );
};

export default Home;

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';
import CartSidebar from './CartSidebar';

const Header = ({ tableId, tableNumber }) => {
  const { items } = useCart();
  const navigate = useNavigate();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <>
      <motion.header
        className="bg-black/30 backdrop-blur-md shadow-lg sticky top-0 z-30 border-b border-white/10"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍽️</span>
            <div>
              <h1 className="text-xl font-bold text-white leading-none">DineIn</h1>
              {tableId && (
                <p className="text-orange-300 text-xs">Table {tableNumber || tableId}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => navigate('/my-orders')}
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              📋 My Orders
            </motion.button>
            <motion.button
              onClick={() => setIsCartOpen(true)}
              className="relative bg-orange-500 hover:bg-orange-600 text-white p-3 rounded-full transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              🛒
              {itemCount > 0 && (
                <motion.span
                  className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  key={itemCount}
                >
                  {itemCount}
                </motion.span>
              )}
            </motion.button>
          </div>
        </div>
      </motion.header>
      <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
};

export default Header;

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';

const CartSidebar = ({ isOpen, onClose }) => {
  const { items, subtotal, tax, grandTotal, removeItem, addItem, clearCart } = useCart();
  const navigate = useNavigate();
  const [isClearing, setIsClearing] = useState(false);
  const [updatingItems, setUpdatingItems] = useState(new Set());

  const handleCheckout = () => {
    onClose();
    navigate('/order-summary');
  };

  const handleClearCart = useCallback(() => {
    if (isClearing) return;
    setIsClearing(true);
    clearCart();
    setTimeout(() => setIsClearing(false), 300);
  }, [clearCart, isClearing]);

  const handleAddItem = useCallback((item) => {
    if (updatingItems.has(item._id)) return;
    setUpdatingItems(prev => new Set(prev).add(item._id));
    addItem(item);
    setTimeout(() => {
      setUpdatingItems(prev => {
        const next = new Set(prev);
        next.delete(item._id);
        return next;
      });
    }, 200);
  }, [addItem, updatingItems]);

  const handleRemoveItem = useCallback((itemId) => {
    if (updatingItems.has(itemId)) return;
    setUpdatingItems(prev => new Set(prev).add(itemId));
    removeItem(itemId);
    setTimeout(() => {
      setUpdatingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }, 200);
  }, [removeItem, updatingItems]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/60 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 h-full w-80 bg-gray-900 border-l border-white/10 shadow-2xl z-50 flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
          >
            <div className="flex justify-between items-center p-5 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">Your Cart</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
            </div>

            {items.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <div className="text-4xl mb-3">🛒</div>
                  <p>Your cart is empty</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {items.map(item => {
                    const isItemUpdating = updatingItems.has(item._id);
                    return (
                      <div key={item._id} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                        <img
                          src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'}
                          alt={item.name}
                          className="w-12 h-12 object-cover rounded-lg flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{item.name}</p>
                          <p className="text-orange-300 text-sm">₹{item.price}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => handleRemoveItem(item._id)}
                            disabled={isItemUpdating}
                            className="w-6 h-6 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded flex items-center justify-center text-sm transition-opacity"
                          >
                            −
                          </button>
                          <span className="text-white text-sm w-5 text-center">{item.quantity}</span>
                          <button 
                            onClick={() => handleAddItem(item)}
                            disabled={isItemUpdating}
                            className="w-6 h-6 bg-orange-500/80 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded flex items-center justify-center text-sm transition-opacity"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 border-t border-white/10 space-y-3">
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-gray-400">
                      <span>Subtotal</span><span>₹{subtotal}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>GST (5%)</span><span>₹{tax}</span>
                    </div>
                    <div className="flex justify-between text-white font-bold text-base pt-1 border-t border-white/10">
                      <span>Total</span><span>₹{grandTotal}</span>
                    </div>
                  </div>
                  <button onClick={handleCheckout} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition-colors">
                    Proceed to Checkout
                  </button>
                  <button 
                    onClick={handleClearCart}
                    disabled={isClearing}
                    className="w-full text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm py-1 transition-opacity"
                  >
                    {isClearing ? 'Clearing...' : 'Clear cart'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartSidebar;


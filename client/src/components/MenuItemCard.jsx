import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useCart } from '../context/CartContext';

const MenuItemCard = ({ item }) => {
  const { items, addItem, removeItem } = useCart();
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Memoize cart item lookup to prevent unnecessary re-calculations
  const cartItem = useMemo(() => items.find(i => i._id === item._id), [items, item._id]);
  const qty = cartItem ? cartItem.quantity : 0;

  // Debounced add/remove handlers to prevent rapid clicking
  const handleAdd = useCallback(() => {
    if (isUpdating) return;
    setIsUpdating(true);
    addItem(item);
    setTimeout(() => setIsUpdating(false), 200);
  }, [addItem, item, isUpdating]);

  const handleRemove = useCallback(() => {
    if (isUpdating) return;
    setIsUpdating(true);
    removeItem(item._id);
    setTimeout(() => setIsUpdating(false), 200);
  }, [removeItem, item._id, isUpdating]);

  return (
    <motion.div
      className={`bg-white/10 backdrop-blur-md rounded-xl p-4 shadow-lg transition-all duration-300 ${!item.available ? 'opacity-50' : 'hover:shadow-xl'}`}
      whileHover={item.available ? { scale: 1.02 } : {}}
    >
      <div className="relative">
        <img
          src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400'}
          alt={item.name}
          className="w-full h-36 object-cover rounded-lg mb-3"
        />
        {!item.available && (
          <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
            <span className="text-white font-semibold text-sm bg-red-600 px-3 py-1 rounded-full">Unavailable</span>
          </div>
        )}
        {item.isVeg && (
          <span className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">🌿 Veg</span>
        )}
      </div>

      <div className="flex items-start justify-between mb-1">
        <h3 className="text-base font-semibold text-white leading-tight">{item.name}</h3>
      </div>
      <p className="text-gray-300 text-sm mb-3 line-clamp-2 min-h-[2.5rem]">{item.description}</p>

      <div className="flex justify-between items-center">
        <span className="text-xl font-bold text-orange-300">₹{item.price}</span>

        {item.available ? (
          qty === 0 ? (
            <motion.button
              onClick={handleAdd}
              disabled={isUpdating}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium text-sm transition-opacity"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Add
            </motion.button>
          ) : (
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-2 py-1">
              <button 
                onClick={handleRemove}
                disabled={isUpdating}
                className="text-white font-bold w-7 h-7 flex items-center justify-center hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-opacity"
              >
                −
              </button>
              <span className="text-white font-semibold min-w-[1.5rem] text-center">{qty}</span>
              <button 
                onClick={handleAdd}
                disabled={isUpdating}
                className="text-white font-bold w-7 h-7 flex items-center justify-center hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-opacity"
              >
                +
              </button>
            </div>
          )
        ) : (
          <span className="text-gray-400 text-sm italic">Out of stock</span>
        )}
      </div>
    </motion.div>
  );
};

export default MenuItemCard;


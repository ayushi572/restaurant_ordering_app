import React from 'react';
import { motion } from 'framer-motion';

const CategoryTabs = ({ categories, activeCategory, onCategoryChange }) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
      {['All', ...categories].map(category => (
        <motion.button
          key={category}
          onClick={() => onCategoryChange(category)}
          className={`px-4 py-2 rounded-full font-medium whitespace-nowrap text-sm transition-colors ${
            activeCategory === category
              ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
              : 'bg-white/15 text-white hover:bg-white/25'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {category}
        </motion.button>
      ))}
    </div>
  );
};

export default CategoryTabs;

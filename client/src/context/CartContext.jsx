import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const CART_KEY = 'restaurant_cart';

const cartReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find(i => i._id === action.payload._id);
      const newItems = existing
        ? state.items.map(i => i._id === action.payload._id ? { ...i, quantity: i.quantity + 1 } : i)
        : [...state.items, { ...action.payload, quantity: 1 }];
      return { ...state, items: newItems };
    }
    case 'REMOVE_ITEM': {
      const item = state.items.find(i => i._id === action.payload);
      if (!item) return state;
      const newItems = item.quantity > 1
        ? state.items.map(i => i._id === action.payload ? { ...i, quantity: i.quantity - 1 } : i)
        : state.items.filter(i => i._id !== action.payload);
      return { ...state, items: newItems };
    }
    case 'CLEAR_CART':
      return { items: [] };
    case 'LOAD_CART':
      return { items: action.payload || [] };
    case 'SYNC_CART':
      return { items: action.payload || [] };
    case 'ITEM_UNAVAILABLE': {
      const newItems = state.items.filter(i => i._id !== action.payload);
      return { ...state, items: newItems };
    }
    default:
      return state;
  }
};

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });
  const syncTimeoutRef = useRef(null);
  const isSyncingRef = useRef(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);
      if (saved) dispatch({ type: 'LOAD_CART', payload: JSON.parse(saved) });
    } catch (e) {}
  }, []);

  // Sync cart with backend when customer is logged in (debounced)
  const syncCartWithBackend = useCallback(async (cartItems) => {
    const token = localStorage.getItem('customerToken');
    if (!token || isSyncingRef.current) return;
    try {
      isSyncingRef.current = true;
      await axios.post(`${API_URL}/api/cart/sync`, { cart: cartItems }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Failed to sync cart:', error);
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  // Load cart from backend on login
  const loadCartFromBackend = useCallback(async () => {
    const token = localStorage.getItem('customerToken');
    if (!token) return;
    try {
      const response = await axios.get(`${API_URL}/api/cart`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
        params: { _t: Date.now() },
      });
      if (response.data.cart) {
        dispatch({ type: 'SYNC_CART', payload: response.data.cart });
      }
    } catch (error) {
      console.error('Failed to load cart:', error);
    }
  }, []);

  // Persist cart to localStorage and debounced sync with backend
  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(state.items));

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    const token = localStorage.getItem('customerToken');
    if (token) {
      syncTimeoutRef.current = setTimeout(() => {
        syncCartWithBackend(state.items);
      }, 500);
    }

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [state.items, syncCartWithBackend]);

  const total = state.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const subtotal = total;
  const tax = Math.round(subtotal * 0.05);
  const grandTotal = subtotal + tax;

  const addItem = useCallback(item => dispatch({ type: 'ADD_ITEM', payload: item }), []);
  const removeItem = useCallback(id => dispatch({ type: 'REMOVE_ITEM', payload: id }), []);
  const clearCart = useCallback(() => dispatch({ type: 'CLEAR_CART' }), []);
  const removeUnavailable = useCallback(itemId => dispatch({ type: 'ITEM_UNAVAILABLE', payload: itemId }), []);

  const contextValue = useMemo(() => ({
    ...state,
    total,
    subtotal,
    tax,
    grandTotal,
    addItem,
    removeItem,
    clearCart,
    removeUnavailable,
    loadCartFromBackend,
  }), [state, total, grandTotal, addItem, removeItem, clearCart, removeUnavailable, loadCartFromBackend]);

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
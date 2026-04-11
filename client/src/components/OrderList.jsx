import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const OrderList = ({ sessionId, showSelectCheckbox = false, selectedOrders = [], onSelectionChange, orders: propOrders }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  useEffect(() => {
    if (propOrders) {
      setOrders(propOrders);
      setLoading(false);
    } else {
      fetchOrders();
    }
  }, [sessionId, propOrders]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('customerToken');
      const response = await axios.get(
        `${API_URL}/api/sessions/${sessionId}/orders`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setOrders(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      setError(err.response?.data?.error || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleOrderSelect = (orderId) => {
    if (selectedOrders.includes(orderId)) {
      onSelectionChange?.(selectedOrders.filter(id => id !== orderId));
    } else {
      onSelectionChange?.([...selectedOrders, orderId]);
    }
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      'placed': 'bg-blue-500/20 text-blue-400 border-blue-400/30',
      'confirmed': 'bg-indigo-500/20 text-indigo-400 border-indigo-400/30',
      'preparing': 'bg-yellow-500/20 text-yellow-400 border-yellow-400/30',
      'ready': 'bg-green-500/20 text-green-400 border-green-400/30',
      'served': 'bg-purple-500/20 text-purple-400 border-purple-400/30',
      'completed': 'bg-green-500/20 text-green-400 border-green-400/30',
      'cancelled': 'bg-red-500/20 text-red-400 border-red-400/30'
    };
    return colors[status] || 'bg-gray-500/20 text-gray-400 border-gray-400/30';
  };

  const getPaymentStatusBadge = (status) => {
    const colors = {
      'pending': 'bg-yellow-500/20 text-yellow-400',
      'paid': 'bg-green-500/20 text-green-400',
      'failed': 'bg-red-500/20 text-red-400',
      'refunded': 'bg-blue-500/20 text-blue-400'
    };
    return colors[status] || 'bg-gray-500/20 text-gray-400';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin">
          <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <div className="text-4xl mb-3">📭</div>
        <p>No orders placed yet</p>
      </div>
    );
  }

  // Calculate totals for selected orders
  const selectedTotal = orders
    .filter(order => selectedOrders.includes(order._id))
    .reduce((sum, order) => sum + order.total, 0);

  return (
    <div className="space-y-4">
      {/* Summary for selected orders */}
      {showSelectCheckbox && selectedOrders.length > 0 && (
        <motion.div
          className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex justify-between items-center">
            <span className="text-orange-400">
              {selectedOrders.length} order(s) selected
            </span>
            <span className="text-xl font-bold text-orange-400">
              ₹{selectedTotal.toFixed(2)}
            </span>
          </div>
        </motion.div>
      )}

      {/* Orders List */}
      {orders.map((order, index) => (
        <motion.div
          key={order._id}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg overflow-hidden hover:bg-white/10 transition"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <button
            onClick={() => setExpandedOrderId(expandedOrderId === order._id ? null : order._id)}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            {/* Left side - Order info */}
            <div className="flex-1">
              <div className="flex items-center gap-3">
                {showSelectCheckbox && (
                  <input
                    type="checkbox"
                    checked={selectedOrders.includes(order._id)}
                    onChange={() => handleOrderSelect(order._id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded accent-orange-500 cursor-pointer"
                  />
                )}
                <div>
                  <h3 className="font-semibold text-white">
                    Order #{order.orderNumber}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Status badges */}
            <div className="flex items-center gap-2 mx-4">
              <span className={`text-xs px-3 py-1 rounded-full border ${getStatusBadgeColor(order.status)}`}>
                {order.status}
              </span>
              <span className={`text-xs px-2 py-1 rounded-full ${getPaymentStatusBadge(order.paymentStatus)}`}>
                {order.paymentStatus === 'paid' ? '✓ Paid' : '○ Pending'}
              </span>
            </div>

            {/* Price and toggle */}
            <div className="flex items-center gap-4">
              <div className="text-right min-w-20">
                <p className="text-lg font-bold text-orange-400">
                  ₹{order.total.toFixed(2)}
                </p>
              </div>
              <motion.div
                animate={{ rotate: expandedOrderId === order._id ? 180 : 0 }}
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </motion.div>
            </div>
          </button>

          {/* Expanded Details */}
          {expandedOrderId === order._id && (
            <motion.div
              className="bg-white/5 border-t border-white/10 p-4 space-y-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {/* Items */}
              <div className="space-y-2">
                <h4 className="font-semibold text-white text-sm">Items:</h4>
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm text-gray-300 ml-2">
                    <span>
                      {item.name} × {item.quantity}
                      {item.notes && <span className="text-xs text-gray-500 ml-1">({item.notes})</span>}
                    </span>
                    <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Breakdown */}
              <div className="border-t border-white/10 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-gray-300">
                  <span>Subtotal:</span>
                  <span>₹{order.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Tax (5%):</span>
                  <span>₹{order.tax.toFixed(2)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-green-400">
                    <span>Discount:</span>
                    <span>-₹{order.discount.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              {order.status === 'cancelled' && order.cancelReason && (
                <div className="bg-red-500/10 border border-red-400/30 rounded p-2 text-sm text-red-300">
                  <strong>Cancellation Reason:</strong> {order.cancelReason}
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      ))}
    </div>
  );
};

export default OrderList;

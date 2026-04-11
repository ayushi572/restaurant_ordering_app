import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { useKitchenSocket } from '../hooks/useSocket';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const STATUS_COLORS = {
  placed: 'border-blue-400 bg-blue-400/10',
  confirmed: 'border-purple-400 bg-purple-400/10',
  preparing: 'border-yellow-400 bg-yellow-400/10',
  ready: 'border-green-400 bg-green-400/10',
};

const getWaitMinutes = (createdAt) => Math.floor((Date.now() - new Date(createdAt)) / 60000);

const KOTCard = ({ order, onUpdateStatus }) => {
  const wait = getWaitMinutes(order.createdAt);
  const urgency = wait < 5 ? 'text-green-400' : wait < 10 ? 'text-yellow-400' : 'text-red-400';
  const borderClass = STATUS_COLORS[order.status] || 'border-gray-400 bg-gray-400/10';

  const nextStatus = { placed: 'confirmed', confirmed: 'preparing', preparing: 'ready' }[order.status];
  const nextLabel = { placed: 'Confirm', confirmed: 'Start Cooking', preparing: 'Mark Ready' }[order.status];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`bg-gray-800 rounded-xl p-4 border-l-4 shadow-lg ${borderClass}`}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-lg">#{order.orderNumber}</span>
            {order.tableNumber && (
              <span className="bg-white/10 text-white text-xs px-2 py-0.5 rounded-full">Table {order.tableNumber}</span>
            )}
          </div>
          <p className="text-gray-400 text-xs mt-0.5">{order.customerName}</p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-bold ${urgency}`}>{wait}m ago</p>
          <p className="text-gray-500 text-xs">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>

      <div className="space-y-1.5 mb-4">
        {order.items.map((item, i) => (
          <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5">
            <span className="text-white text-sm">{item.name}</span>
            <span className="text-orange-300 font-semibold text-sm">× {item.quantity}</span>
          </div>
        ))}
      </div>

      {item => item?.notes && <p className="text-yellow-300 text-xs mb-3 bg-yellow-400/10 rounded px-2 py-1">📝 {item.notes}</p>}

      {nextStatus && (
        <button
          onClick={() => onUpdateStatus(order._id, nextStatus)}
          className={`w-full py-2 rounded-lg font-semibold text-sm transition-colors ${
            nextStatus === 'ready' ? 'bg-green-500 hover:bg-green-600 text-white' :
            nextStatus === 'preparing' ? 'bg-yellow-500 hover:bg-yellow-600 text-black' :
            'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {nextLabel}
        </button>
      )}

      {order.status === 'ready' && (
        <div className="text-center text-green-400 font-semibold py-1">✅ Ready for pickup</div>
      )}
    </motion.div>
  );
};

const Kitchen = () => {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');

  const restaurantId = user?.restaurantId || 'default';

  const fetchOrders = async () => {
    try {
      const statuses = filter === 'active' ? 'placed,confirmed,preparing,ready' : 'served,completed';
      const res = await axios.get(`${API_URL}/api/orders?status=${statuses}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });
      setOrders(res.data);
    } catch (err) {
      console.error('Failed to fetch orders', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [filter]);

  // Real-time new orders via socket
  useKitchenSocket(
    restaurantId,
    (newOrder) => {
      if (filter === 'active') setOrders(prev => [newOrder, ...prev]);
    },
    (updated) => {
      setOrders(prev => prev.map(o => o._id === updated._id ? updated : o));
    }
  );

  const handleUpdateStatus = async (orderId, status) => {
    try {
      const res = await axios.put(`${API_URL}/api/orders/${orderId}`, { status }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });
      setOrders(prev => {
        if (filter === 'active' && ['served', 'completed'].includes(status)) {
          return prev.filter(o => o._id !== orderId);
        }
        return prev.map(o => o._id === orderId ? res.data : o);
      });
    } catch (err) {
      alert('Failed to update order status');
    }
  };

  const grouped = {
    placed: orders.filter(o => o.status === 'placed'),
    confirmed: orders.filter(o => o.status === 'confirmed'),
    preparing: orders.filter(o => o.status === 'preparing'),
    ready: orders.filter(o => o.status === 'ready'),
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">👨‍🍳</span>
          <div>
            <h1 className="text-xl font-bold">Kitchen Display</h1>
            <p className="text-gray-400 text-xs">Live order feed</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-gray-700 rounded-lg p-1">
            {['active', 'done'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${filter === f ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                {f === 'active' ? `Active (${orders.length})` : 'Completed'}
              </button>
            ))}
          </div>
          <button onClick={logout} className="text-gray-400 hover:text-white text-sm">Logout</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Loading orders...</div>
      ) : filter === 'active' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
          {Object.entries(grouped).map(([status, statusOrders]) => (
            <div key={status}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${status === 'placed' ? 'bg-blue-400' : status === 'confirmed' ? 'bg-purple-400' : status === 'preparing' ? 'bg-yellow-400' : 'bg-green-400'}`}></span>
                {status} ({statusOrders.length})
              </h3>
              <AnimatePresence>
                <div className="space-y-4">
                  {statusOrders.length === 0 ? (
                    <div className="text-gray-600 text-sm text-center py-8 border border-dashed border-gray-700 rounded-xl">No orders</div>
                  ) : (
                    statusOrders.map(order => (
                      <KOTCard key={order._id} order={order} onUpdateStatus={handleUpdateStatus} />
                    ))
                  )}
                </div>
              </AnimatePresence>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map(order => (
            <div key={order._id} className="bg-gray-800 rounded-xl p-4 opacity-60">
              <div className="flex justify-between mb-2">
                <span className="font-bold">#{order.orderNumber} — Table {order.tableNumber}</span>
                <span className="text-green-400 text-sm">{order.status}</span>
              </div>
              <p className="text-gray-400 text-sm">{order.items.map(i => `${i.name} ×${i.quantity}`).join(', ')}</p>
            </div>
          ))}
          {orders.length === 0 && <p className="text-gray-500 col-span-full text-center py-12">No completed orders today</p>}
        </div>
      )}
    </div>
  );
};

export default Kitchen;

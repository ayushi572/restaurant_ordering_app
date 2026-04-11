import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import Header from '../components/Header';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const MyOrders = () => {
  const [orders, setOrders] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('current');
  const [isBilling, setIsBilling] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const navigate = useNavigate();
  const socketRef = useRef(null);

  const tableId = sessionStorage.getItem('tableId') || '';
  const sessionId = sessionStorage.getItem('sessionId') || '';

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('customerToken');
      const session = JSON.parse(localStorage.getItem('session') || '{}');

      if (!token || !session.sessionId) {
        navigate('/login');
        return;
      }

      try {
        setLoading(true);
        
        // Fetch orders
        const ordersRes = await axios.get(`${API_URL}/api/orders/session/${session.sessionId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setOrders(ordersRes.data);

        // Fetch bills
        const billsRes = await axios.get(`${API_URL}/api/bills/session/${session.sessionId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setBills(billsRes.data);

      } catch (err) {
        setError('Failed to load orders and bills');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  // Set up real-time updates
  useEffect(() => {
    if (orders.length === 0) return;

    if (!socketRef.current) {
      socketRef.current = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    }
    const socket = socketRef.current;

    // Listen for status changes on all orders
    orders.forEach(order => {
      socket.emit('track_order', { orderId: order._id });
    });

    const handleStatusChange = (data) => {
      setOrders(prev => prev.map(o => 
        o._id === data.orderId ? { ...o, status: data.status, estimatedReadyAt: data.estimatedReadyAt } : o
      ));
    };

    const handlePaymentConfirmed = (data) => {
      setOrders(prev => prev.map(o => 
        o._id === data.orderId ? { ...o, isPaid: true } : o
      ));
    };

    socket.on('status_changed', handleStatusChange);
    socket.on('payment_confirmed', handlePaymentConfirmed);

    return () => {
      socket.off('status_changed', handleStatusChange);
      socket.off('payment_confirmed', handlePaymentConfirmed);
    };
  }, [orders]);

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'placed': return 'text-blue-300';
      case 'confirmed': return 'text-yellow-300';
      case 'preparing': return 'text-orange-300';
      case 'ready': return 'text-green-300';
      case 'served': return 'text-purple-300';
      case 'completed': return 'text-gray-300';
      case 'cancelled': return 'text-red-300';
      default: return 'text-gray-300';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'placed': return '📝';
      case 'confirmed': return '✅';
      case 'preparing': return '👨‍🍳';
      case 'ready': return '🎉';
      case 'served': return '🍽️';
      case 'completed': return '✨';
      case 'cancelled': return '❌';
      default: return '⏳';
    }
  };

  const handleCreateBill = async () => {
    if (!canGenerateBill) {
      const activeOrders = orders.filter(order => !order.billId && order.status !== 'cancelled');
      const completedCount = activeOrders.filter(order => order.status === 'completed').length;
      const pendingCount = activeOrders.filter(order => order.status !== 'completed').length;

      setError(`Complete all orders before generating the bill. ${completedCount}/${activeOrders.length} orders completed. ${pendingCount} orders still pending.`);
      return;
    }

    try {
      setIsBilling(true);
      setError(null);
      setSuccessMessage(null);

      const token = localStorage.getItem('customerToken');
      const session = JSON.parse(localStorage.getItem('session') || '{}');

      console.log('Attempting to generate bill for session:', session.sessionId);

      const response = await axios.post(
        `${API_URL}/api/bills/generate`,
        {
          sessionId: session.sessionId,
          restaurantId: session.restaurantId || 'default'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccessMessage(`Bill #${response.data.billNumber} created successfully!`);
      setActiveTab('bills');
      const billsRes = await axios.get(`${API_URL}/api/bills/session/${session.sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBills(billsRes.data);
      navigate(`/bill/${response.data.billId}`);
    } catch (err) {
      console.error('Bill generation error:', err.response?.data);
      setError(err.response?.data?.error || 'Failed to create bill');
    } finally {
      setIsBilling(false);
    }
  };

  const activeOrders = orders.filter(order => !order.billId && order.status !== 'cancelled');
  const completedActiveOrders = activeOrders.filter(order => order.status === 'completed').length;
  const allCompleted = activeOrders.length > 0 && completedActiveOrders === activeOrders.length;
  const canGenerateBill = allCompleted;
  const billButtonLabel = canGenerateBill ? 'Generate Bill' : 'Complete all orders to generate bill';
  const billTooltip = activeOrders.length === 0
    ? 'No active orders available for billing yet.'
    : allCompleted
      ? 'All active orders are completed and ready for billing.'
      : `Completed ${completedActiveOrders}/${activeOrders.length} active orders.`;

  const currentOrders = activeOrders;
  const orderHistory = orders.filter(order => order.billId || order.status === 'completed');

  const renderOrders = (orderList) => (
    <div className="space-y-4">
      {orderList.map((order) => (
        <motion.div
          key={order._id}
          className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
          onClick={() => navigate(`/track/${order._id}`, { state: { order } })}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-white font-semibold">Order #{order.orderNumber}</p>
              <p className="text-gray-300 text-sm">
                {new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString()}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-medium ${getStatusColor(order.status)}`}>
                {getStatusIcon(order.status)} {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </p>
              <p className="text-orange-300 font-semibold">₹{order.total}</p>
            </div>
          </div>

          <div className="space-y-1">
            {order.items.slice(0, 3).map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-white">{item.name} × {item.quantity}</span>
                <span className="text-gray-300">₹{item.price * item.quantity}</span>
              </div>
            ))}
            {order.items.length > 3 && (
              <p className="text-gray-400 text-xs">+{order.items.length - 3} more items</p>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center">
            <p className="text-gray-400 text-xs">
              Table {order.tableNumber || order.tableId}
            </p>
            <button className="text-orange-300 hover:text-orange-400 text-sm font-medium">
              Track Order →
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );

  const renderBills = () => (
    <div className="space-y-4">
      {bills.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          No bills generated yet
        </div>
      ) : (
        bills.map((bill) => (
          <motion.div
            key={bill._id}
            className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-colors"
            whileHover={{ scale: 1.02 }}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-white font-semibold">Bill #{bill.billNumber}</p>
                <p className="text-gray-300 text-sm">
                  {new Date(bill.createdAt).toLocaleDateString()} at {new Date(bill.createdAt).toLocaleTimeString()}
                </p>
              </div>
              <div className="text-right">
                <p className={`font-semibold ${bill.paymentStatus === 'paid' ? 'text-green-300' : 'text-yellow-300'}`}>
                  ₹{parseFloat(bill.grandTotal || 0).toFixed(2)}
                </p>
                <p className={`text-xs ${bill.paymentStatus === 'paid' ? 'text-green-400' : 'text-yellow-400'}`}>
                  {bill.paymentStatus?.charAt(0).toUpperCase() + bill.paymentStatus?.slice(1) || 'Pending'}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              {bill.items && bill.items.slice(0, 3).map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-white">{item.name} × {item.quantity}</span>
                  <span className="text-gray-300">₹{parseFloat(item.totalPrice || 0).toFixed(2)}</span>
                </div>
              ))}
              {bill.items && bill.items.length > 3 && (
                <p className="text-gray-400 text-xs">+{bill.items.length - 3} more items</p>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div className="text-gray-400 text-xs">
                Table {bill.tableNumber || '-'}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-gray-400 text-xs">{bill.orderIds?.length || 0} orders</div>
                <button
                  onClick={() => navigate(`/bill/${bill._id}`)}
                  className="text-sm bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-lg transition"
                >
                  View Bill
                </button>
              </div>
            </div>
          </motion.div>
        ))
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-950 via-red-900 to-orange-900 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Loading your orders...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-950 via-red-900 to-orange-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-5xl mb-4">⚠️</div>
          <p className="text-xl mb-4">{error}</p>
          <button onClick={() => navigate('/menu')} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg">
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header tableId={tableId} tableNumber={tableId} />
      <div className="min-h-screen bg-gradient-to-br from-orange-950 via-red-900 to-orange-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <motion.div
          className="bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-white/10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white">My Orders</h2>
            <p className="text-orange-300 text-sm mt-1">Track and view your dining history</p>
          </div>

          {/* Tabs */}
          <div className="flex justify-center mb-6">
            <div className="bg-white/5 rounded-lg p-1 flex">
              <button
                onClick={() => setActiveTab('current')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'current' ? 'bg-orange-500 text-white' : 'text-gray-300 hover:text-white'
                }`}
              >
                Current Orders ({currentOrders.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'history' ? 'bg-orange-500 text-white' : 'text-gray-300 hover:text-white'
                }`}
              >
                Order History ({orderHistory.length})
              </button>
              <button
                onClick={() => setActiveTab('bills')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'bills' ? 'bg-orange-500 text-white' : 'text-gray-300 hover:text-white'
                }`}
              >
                Bills ({bills.length})
              </button>
            </div>
          </div>

          {/* Content */}
          {activeTab === 'current' && (
            currentOrders.length === 0 ? (
              <div className="text-center text-white py-8">
                <div className="text-3xl mb-4">🍽️</div>
                <p className="text-gray-300">No current orders</p>
              </div>
            ) : (
              <>
                {successMessage && (
                  <div className="bg-green-500/10 border border-green-400/30 rounded-lg p-3 mb-4 text-green-200 text-sm">
                    {successMessage}
                  </div>
                )}
                {error && (
                  <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-3 mb-4 text-red-200 text-sm">
                    {error}
                  </div>
                )}
                <div className="mb-5 rounded-2xl bg-white/5 border border-white/10 p-4 text-sm text-gray-300">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">Order completion progress</p>
                      <p>{completedActiveOrders}/{activeOrders.length} orders completed</p>
                    </div>
                    <div className="text-xs text-gray-300">{billTooltip}</div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-green-400" style={{ width: `${activeOrders.length ? (completedActiveOrders / activeOrders.length) * 100 : 0}%` }} />
                  </div>
                </div>
                {renderOrders(currentOrders)}
                <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-between items-center">
                  <p className="text-gray-300 text-sm">{canGenerateBill ? 'Ready to generate bill.' : 'Generate bill after all orders are completed.'}</p>
                  <button
                    onClick={handleCreateBill}
                    disabled={!canGenerateBill || isBilling}
                    title={billTooltip}
                    className={`px-6 py-3 rounded-lg font-semibold transition text-white ${canGenerateBill && !isBilling ? 'bg-orange-600 hover:bg-orange-700' : 'bg-orange-600/50 cursor-not-allowed'}`}
                  >
                    {isBilling ? 'Generating Bill...' : billButtonLabel}
                  </button>
                </div>
              </>
            )
          )}

          {activeTab === 'history' && (
            orderHistory.length === 0 ? (
              <div className="text-center text-white py-8">
                <div className="text-3xl mb-4">📜</div>
                <p className="text-gray-300">No order history</p>
              </div>
            ) : (
              renderOrders(orderHistory)
            )
          )}

          {activeTab === 'bills' && (
            bills.length === 0 ? (
              <div className="text-center text-white py-8">
                <div className="text-3xl mb-4">💰</div>
                <p className="text-gray-300">No bills yet</p>
              </div>
            ) : (
              renderBills()
            )
          )}

          <button onClick={() => navigate('/menu')} className="w-full text-gray-400 hover:text-white text-sm py-3 mt-6 transition-colors text-center">
            ← Back to Menu
          </button>
        </motion.div>
      </div>
    </div>
    </>
  );
};

export default MyOrders;
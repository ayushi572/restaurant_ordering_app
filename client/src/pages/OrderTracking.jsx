import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useOrderTracking } from '../hooks/useSocket';
import Header from '../components/Header';
import { useSession } from '../context/SessionContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const STATUS_STEPS = [
  { key: 'placed', label: 'Order Placed', icon: '✅', desc: 'Your order has been received' },
  { key: 'confirmed', label: 'Confirmed', icon: '👨‍🍳', desc: 'Restaurant confirmed your order' },
  { key: 'preparing', label: 'Being Prepared', icon: '🍳', desc: 'The kitchen is preparing your food' },
  { key: 'ready', label: 'Ready!', icon: '🎉', desc: 'Your order is ready to be served' },
  { key: 'served', label: 'Served', icon: '🍽️', desc: 'Enjoy your meal!' },
  { key: 'completed', label: 'Completed', icon: '✨', desc: 'Thank you for dining with us!' },
];

const getStepIndex = (status) => {
  const idx = STATUS_STEPS.findIndex(s => s.key === status);
  return idx >= 0 ? idx : 0;
};

const OrderTracking = () => {
  const { orderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { session, isInitialized } = useSession();
  const [order, setOrder] = useState(location.state?.order || null);
  const [currentStatus, setCurrentStatus] = useState(order?.status || 'placed');
  const [loading, setLoading] = useState(!order);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Check authentication on mount (after initialized)
  useEffect(() => {
    if (!isInitialized) return;

    const token = localStorage.getItem('customerToken');
    if (!token || !session.sessionId) {
      navigate('/login');
      return;
    }

    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }, [isInitialized, session.sessionId, navigate]);

  useEffect(() => {
    if (!order) {
      axios.get(`${API_URL}/api/orders/${orderId}`)
        .then(res => { setOrder(res.data); setCurrentStatus(res.data.status); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [orderId]);

  // Live status updates via Socket.io
  useOrderTracking(
    orderId,
    ({ status }) => setCurrentStatus(status),
    ({ status }) => { setPaymentSuccess(true); setCurrentStatus('completed'); }
  );

  const handlePayOnline = async () => {
    setPaymentLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/payments/create-order`, { orderId });
      const { razorpayOrderId, amount, key, orderDetails } = res.data;

      if (key === 'mock_key') {
        // Development mode — simulate payment
        await axios.post(`${API_URL}/api/payments/verify`, {
          razorpayOrderId, razorpayPaymentId: 'mock_pay_' + Date.now(),
          razorpaySignature: 'mock_sig', orderId
        });
        setPaymentSuccess(true);
        setCurrentStatus('completed');
      } else {
        // Real Razorpay
        const options = {
          key, amount, currency: 'INR',
          order_id: razorpayOrderId,
          name: 'DineIn Restaurant',
          description: `Order #${order.orderNumber}`,
          prefill: { name: orderDetails.customerName, contact: order?.phone },
          handler: async (response) => {
            await axios.post(`${API_URL}/api/payments/verify`, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              orderId
            });
            setPaymentSuccess(true);
            setCurrentStatus('completed');
          }
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (err) {
      alert('Payment failed. Please try again or pay at the counter.');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Show loading while SessionContext initializes
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-950 via-red-900 to-orange-900 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Initializing session...</div>
      </div>
    );
  }

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-orange-950 via-red-900 to-orange-900 flex items-center justify-center">
      <div className="text-white text-xl animate-pulse">Loading order...</div>
    </div>
  );

  const stepIndex = getStepIndex(currentStatus);
  const isCancelled = currentStatus === 'cancelled';
  const showPayment = (currentStatus === 'served' || currentStatus === 'ready') && order?.paymentStatus !== 'paid';

  return (
    <>
      <Header tableId={order?.tableId} tableNumber={order?.tableNumber} />
      <div className="min-h-screen bg-gradient-to-br from-orange-950 via-red-900 to-orange-900 py-8">
        <div className="max-w-lg mx-auto px-4">
          <motion.div
            className="bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-white/10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white">Live Order Tracking</h2>
            {order && <p className="text-orange-300 text-sm mt-1">Order #{order.orderNumber} • Table {order.tableNumber || order.tableId}</p>}
          </div>

          {isCancelled ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">❌</div>
              <p className="text-white font-semibold text-lg">Order Cancelled</p>
              {order?.cancelReason && <p className="text-gray-300 text-sm mt-2">{order.cancelReason}</p>}
            </div>
          ) : (
            <div className="space-y-1 mb-8">
              {STATUS_STEPS.map((step, i) => {
                const isDone = i < stepIndex;
                const isCurrent = i === stepIndex;
                const isPending = i > stepIndex;
                return (
                  <div key={step.key} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <motion.div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 border-2 ${
                          isDone ? 'bg-orange-500 border-orange-500' :
                          isCurrent ? 'bg-orange-500/30 border-orange-400' :
                          'bg-white/5 border-white/20'
                        }`}
                        animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                        transition={{ repeat: Infinity, duration: 2 }}
                      >
                        {isDone ? '✓' : step.icon}
                      </motion.div>
                      {i < STATUS_STEPS.length - 1 && (
                        <div className={`w-0.5 h-8 mt-1 ${isDone ? 'bg-orange-500' : 'bg-white/15'}`} />
                      )}
                    </div>
                    <div className="pt-2">
                      <p className={`font-medium text-sm ${isCurrent ? 'text-orange-300' : isDone ? 'text-white' : 'text-white/40'}`}>
                        {step.label}
                        {isCurrent && <span className="ml-2 text-xs bg-orange-500/30 text-orange-300 px-2 py-0.5 rounded-full">Current</span>}
                      </p>
                      {isCurrent && <p className="text-gray-400 text-xs mt-0.5">{step.desc}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Order items */}
          {order && (
            <div className="bg-white/5 rounded-lg p-4 mb-4 space-y-2">
              <p className="text-white/60 text-xs uppercase tracking-wide mb-2">Your Order</p>
              {order.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-white">{item.name} × {item.quantity}</span>
                  <span className="text-orange-300">₹{item.price * item.quantity}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-white/10 flex justify-between text-white font-semibold">
                <span>Total</span><span>₹{order.total}</span>
              </div>
            </div>
          )}

          {/* Payment section */}
          <AnimatePresence>
            {showPayment && !paymentSuccess && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-green-500/20 border border-green-400/30 rounded-lg p-4 mb-4"
              >
                <p className="text-green-300 font-semibold text-center mb-3">🎉 Your food is ready! Time to pay.</p>
                <button
                  onClick={handlePayOnline}
                  disabled={paymentLoading}
                  className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white py-3 rounded-lg font-semibold"
                >
                  {paymentLoading ? 'Processing...' : `Pay ₹${order?.total} Online`}
                </button>
                <p className="text-gray-400 text-xs text-center mt-2">or ask for the bill at the counter</p>
              </motion.div>
            )}
            {paymentSuccess && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-green-500/20 border border-green-400/30 rounded-lg p-4 mb-4 text-center"
              >
                <p className="text-green-300 font-semibold">✅ Payment Successful! Thank you!</p>
              </motion.div>
            )}
          </AnimatePresence>

          <button onClick={() => navigate('/menu')} className="w-full text-gray-400 hover:text-white text-sm py-2 transition-colors text-center">
            ← Back to Menu
          </button>
        </motion.div>
      </div>
    </div>
    </>
  );
};

export default OrderTracking;

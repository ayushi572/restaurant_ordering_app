import React, { useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const PaymentComponent = ({ billId, grandTotal, onPaymentSuccess, onPaymentFailed }) => {
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [amountReceived, setAmountReceived] = useState('');
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  // Load Razorpay script
  React.useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setRazorpayLoaded(true);
    document.head.appendChild(script);
  }, []);

  /**
   * Handle Cash Payment
   */
  const handleCashPayment = async () => {
    try {
      setLoading(true);
      setError(null);

      const amount = parseFloat(amountReceived) || grandTotal;

      const response = await axios.post(
        `${API_URL}/api/payments/bill/cash`,
        { billId, amountReceived: amount },
        { headers: { Authorization: `Bearer ${localStorage.getItem('customerToken')}` } }
      );

      setSuccessMessage(`Payment recorded! Remaining: ₹${response.data.remainingAmount.toFixed(2)}`);
      setTimeout(() => {
        onPaymentSuccess?.(response.data);
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process cash payment');
      onPaymentFailed?.();
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle UPI Payment
   */
  const handleUPIPayment = async () => {
    try {
      setLoading(true);
      setError(null);

      // In a real app, this would integrate with UPI payment gateway
      // For now, we'll show a mock transaction ID input
      const upiTransactionId = `UPI${Date.now()}`;

      const response = await axios.post(
        `${API_URL}/api/payments/bill/upi`,
        { billId, upiTransactionId },
        { headers: { Authorization: `Bearer ${localStorage.getItem('customerToken')}` } }
      );

      setSuccessMessage('UPI Payment processed successfully!');
      setTimeout(() => {
        onPaymentSuccess?.(response.data);
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process UPI payment');
      onPaymentFailed?.();
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle Razorpay Payment
   */
  const handleRazorpayPayment = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!razorpayLoaded) {
        throw new Error('Razorpay is not loaded');
      }

      // Create Razorpay order
      const orderResponse = await axios.post(
        `${API_URL}/api/payments/bill/create-razorpay`,
        { billId },
        { headers: { Authorization: `Bearer ${localStorage.getItem('customerToken')}` } }
      );

      const { razorpayOrderId, amount, currency, key, billDetails } = orderResponse.data;

      const options = {
        key,
        order_id: razorpayOrderId,
        amount,
        currency,
        name: 'Restaurant App',
        description: `Bill #${billDetails.billNumber}`,
        customer_id: billDetails.phone,
        prefill: {
          name: billDetails.customerName,
          contact: billDetails.phone,
          email: `${billDetails.phone}@restaurant.local`
        },
        theme: {
          color: '#ea580c'
        },
        handler: async (response) => {
          try {
            // Verify payment
            const verifyResponse = await axios.post(
              `${API_URL}/api/payments/bill/verify-razorpay`,
              {
                razorpayOrderId: response.order_id,
                razorpayPaymentId: response.payment_id,
                razorpaySignature: response.signature,
                billId
              },
              { headers: { Authorization: `Bearer ${localStorage.getItem('customerToken')}` } }
            );

            setSuccessMessage('Payment successful!');
            setTimeout(() => {
              onPaymentSuccess?.(verifyResponse.data);
            }, 1500);
          } catch (err) {
            setError('Payment verification failed');
            onPaymentFailed?.();
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            setError('Payment cancelled');
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to initiate Razorpay payment');
      onPaymentFailed?.();
    } finally {
      setLoading(false);
    }
  };

  if (successMessage) {
    return (
      <motion.div
        className="bg-green-500/20 border border-green-400/50 rounded-lg p-6 text-center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="text-4xl mb-3">✓</div>
        <p className="text-green-300 font-semibold">{successMessage}</p>
      </motion.div>
    );
  }

  if (paymentMethod === null) {
    return (
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h3 className="text-lg font-bold text-white mb-4">Select Payment Method</h3>

        <motion.button
          onClick={() => setPaymentMethod('cash')}
          className="w-full bg-blue-600/20 hover:bg-blue-600/40 border border-blue-400/50 rounded-lg p-4 text-left transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center gap-3">
            <div className="text-3xl">💵</div>
            <div>
              <h4 className="font-semibold text-white">Cash</h4>
              <p className="text-sm text-gray-400">Pay in cash at the counter</p>
            </div>
          </div>
        </motion.button>

        <motion.button
          onClick={() => setPaymentMethod('upi')}
          className="w-full bg-purple-600/20 hover:bg-purple-600/40 border border-purple-400/50 rounded-lg p-4 text-left transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center gap-3">
            <div className="text-3xl">📱</div>
            <div>
              <h4 className="font-semibold text-white">UPI</h4>
              <p className="text-sm text-gray-400">Pay using Google Pay, PhonePe, etc.</p>
            </div>
          </div>
        </motion.button>

        <motion.button
          onClick={() => setPaymentMethod('razorpay')}
          className="w-full bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-400/50 rounded-lg p-4 text-left transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center gap-3">
            <div className="text-3xl">💳</div>
            <div>
              <h4 className="font-semibold text-white">Card / Online</h4>
              <p className="text-sm text-gray-400">Credit, Debit, Wallet</p>
            </div>
          </div>
        </motion.button>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Back Button */}
      <button
        onClick={() => setPaymentMethod(null)}
        className="text-gray-400 hover:text-white text-sm flex items-center gap-1 mb-4"
      >
        ← Back to Methods
      </button>

      {/* Error Message */}
      {error && (
        <motion.div
          className="bg-red-500/20 border border-red-400/50 rounded-lg p-3 text-red-300 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {error}
        </motion.div>
      )}

      {/* Payment Method Specific UI */}
      {paymentMethod === 'cash' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">Amount to Pay</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                placeholder={`₹${grandTotal.toFixed(2)}`}
                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => setAmountReceived(grandTotal.toString())}
                className="bg-blue-600/40 hover:bg-blue-600/60 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                Exact
              </button>
            </div>
            {amountReceived && (
              <div className="mt-2 text-sm text-gray-300">
                {parseFloat(amountReceived) >= grandTotal ? (
                  <span className="text-green-400">✓ Amount covers the bill (Change: ₹{(parseFloat(amountReceived) - grandTotal).toFixed(2)})</span>
                ) : (
                  <span className="text-yellow-400">⚠ Partial payment (Remaining: ₹{(grandTotal - parseFloat(amountReceived)).toFixed(2)})</span>
                )}
              </div>
            )}
          </div>

          <motion.button
            onClick={handleCashPayment}
            disabled={loading || !amountReceived}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                Processing...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Confirm Cash Payment
              </>
            )}
          </motion.button>
        </div>
      )}

      {paymentMethod === 'upi' && (
        <div className="space-y-4">
          <div className="bg-purple-500/10 border border-purple-400/30 rounded-lg p-4 text-center">
            <p className="text-purple-300 mb-3">UPI ID: your-restaurant@upi</p>
            <p className="text-white font-bold text-xl">₹{grandTotal.toFixed(2)}</p>
            <p className="text-gray-400 text-sm mt-2">Scan the QR code or enter UPI ID</p>
          </div>

          <motion.button
            onClick={handleUPIPayment}
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                Processing...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 18h6m-6 0a6 6 0 01-6-6V5a6 6 0 016-6h6a6 6 0 016 6v7a6 6 0 01-6 6z" />
                </svg>
                Complete UPI Payment
              </>
            )}
          </motion.button>
        </div>
      )}

      {paymentMethod === 'razorpay' && (
        <motion.button
          onClick={handleRazorpayPayment}
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/50 text-white py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {loading ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
              Processing...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Pay ₹{grandTotal.toFixed(2)} with Razorpay
            </>
          )}
        </motion.button>
      )}
    </motion.div>
  );
};

export default PaymentComponent;

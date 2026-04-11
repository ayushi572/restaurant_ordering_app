import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useSession } from '../context/SessionContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const OTPLogin = () => {
  const navigate = useNavigate();
  const { updateSessionState, updateUserDetailsState } = useSession();
  const [step, setStep] = useState('phone'); // 'phone' or 'otp'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [testOtp, setTestOtp] = useState(''); // For development testing

  const tableId = sessionStorage.getItem('tableId');
  const tableNumber = sessionStorage.getItem('tableNumber');
  const restaurantId = sessionStorage.getItem('restaurantId') || 'default';

  console.log('OTPLogin - sessionStorage values:', {
    tableId,
    tableNumber,
    restaurantId
  });

  useEffect(() => {
    if (!tableId) {
      console.log('OTPLogin - No tableId found, redirecting to /');
      navigate('/');
      return;
    }

    // Start resend timer
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer, tableId, navigate]);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await axios.post(`${API_URL}/api/auth/customer/send-otp`, {
        phone: phone.startsWith('+91') ? phone : `+91${phone}`,
        restaurantId
      });

      setStep('otp');
      setResendTimer(60); // 60 seconds cooldown
      setTestOtp(response.data.testOtp || ''); // Store test OTP if available
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await axios.post(`${API_URL}/api/auth/customer/verify-otp`, {
        phone: phone.startsWith('+91') ? phone : `+91${phone}`,
        otp,
        tableId,
        restaurantId
      });

      // Store session data
      localStorage.setItem('customerToken', response.data.token);
      localStorage.setItem('customer', JSON.stringify(response.data.customer));
      localStorage.setItem('session', JSON.stringify(response.data.session));

      // Update session context
      updateSessionState(response.data.session);
      updateUserDetailsState(response.data.customer);

      // Set default axios header
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;

      navigate('/menu');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendTimer > 0) return;

    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/api/auth/customer/send-otp`, {
        phone: phone.startsWith('+91') ? phone : `+91${phone}`,
        restaurantId
      });
      setResendTimer(60);
      setTestOtp(response.data.testOtp || ''); // Update test OTP
      setError('');
    } catch (err) {
      setError('Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  if (!tableId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-950 via-red-900 to-orange-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-5xl mb-4">⚠️</div>
          <p className="text-xl">Table not selected</p>
          <button onClick={() => navigate('/')} className="mt-4 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-950 via-red-900 to-orange-900 flex items-center justify-center p-4">
      <motion.div
        className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/10 max-w-md w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center mb-6">
          <div className="text-4xl mb-4">📱</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {step === 'phone' ? 'Enter Your Phone' : 'Enter OTP'}
          </h2>
          <p className="text-orange-300 text-sm">
            Table {tableNumber} • Login to continue ordering
          </p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-3 mb-4">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleSendOTP}>
            <div className="mb-4">
              <label className="block text-white text-sm font-medium mb-2">
                Phone Number
              </label>
              <div className="flex">
                <span className="bg-white/10 border border-white/20 border-r-0 rounded-l-lg px-3 py-3 text-white text-sm">
                  +91
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter 10-digit number"
                  className="flex-1 bg-white/10 border border-white/20 rounded-r-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-orange-400"
                  disabled={loading}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || phone.length !== 10}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white py-3 rounded-lg font-semibold transition-colors"
            >
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP}>
            <div className="mb-4">
              <label className="block text-white text-sm font-medium mb-2">
                Enter 6-digit OTP
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-orange-400 text-center text-2xl tracking-widest"
                disabled={loading}
                maxLength={6}
              />
              <p className="text-gray-400 text-xs mt-2">
                OTP sent to +91{phone}
              </p>
              {testOtp && (
                <div className="mt-3 p-3 bg-yellow-500/20 border border-yellow-400/30 rounded-lg">
                  <p className="text-yellow-300 text-sm font-medium">
                    🔧 Development Mode: Test OTP is <span className="font-bold text-yellow-200">{testOtp}</span>
                  </p>
                  <p className="text-yellow-400 text-xs mt-1">
                    Copy this OTP to test the login flow
                  </p>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white py-3 rounded-lg font-semibold transition-colors mb-3"
            >
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
            <button
              type="button"
              onClick={handleResendOTP}
              disabled={resendTimer > 0 || loading}
              className="w-full text-gray-400 hover:text-white text-sm py-2 transition-colors disabled:opacity-50"
            >
              {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <button
            onClick={() => setStep('phone')}
            className="w-full text-gray-400 hover:text-white text-sm py-2 mt-4 transition-colors"
          >
            ← Change Phone Number
          </button>
        )}
      </motion.div>
    </div>
  );
};

export default OTPLogin;
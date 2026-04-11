import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const TableEntry = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState('qr'); // 'qr' or 'manual'
  const [tableId, setTableId] = useState('');
  const [restaurantId, setRestaurantId] = useState('default');
  const [qrInput, setQrInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if QR code data is in URL params
    const qrRestaurantId = searchParams.get('restaurantId');
    const qrTableId = searchParams.get('tableId');
    const qrData = searchParams.get('qr');

    if (qrRestaurantId && qrTableId) {
      // Direct URL parameters
      setRestaurantId(qrRestaurantId);
      setTableId(qrTableId);
      setMode('qr');
      verifyTable(qrTableId, qrRestaurantId);
    } else if (qrData) {
      // Raw QR code data (JSON string)
      try {
        const parsedData = JSON.parse(qrData);
        if (parsedData.restaurantId && parsedData.tableId) {
          setRestaurantId(parsedData.restaurantId);
          setTableId(parsedData.tableId);
          setMode('qr');
          verifyTable(parsedData.tableId, parsedData.restaurantId);
        } else {
          setError('Invalid QR code format');
        }
      } catch (err) {
        setError('Invalid QR code data');
      }
    }
  }, [searchParams]);

  const verifyTable = async (tableIdToVerify, restaurantIdToVerify) => {
    try {
      setLoading(true);
      setError('');

      console.log('Verifying table:', tableIdToVerify, 'for restaurant:', restaurantIdToVerify);
      console.log('API URL:', `${API_URL}/api/tables/public/${tableIdToVerify}`);

      // Verify table exists
      const response = await axios.get(`${API_URL}/api/tables/public/${tableIdToVerify}`, {
        params: { restaurantId: restaurantIdToVerify }
      });

      console.log('API Response:', response.data);
      console.log('Response data keys:', Object.keys(response.data));
      console.log('Response data id:', response.data.id);
      console.log('Response data number:', response.data.number);

      if (response.data && response.data.id) {
        // Store table info and proceed to login
        console.log('Storing table data:', {
          id: response.data.id,
          number: response.data.number,
          restaurantId: restaurantIdToVerify
        });
        sessionStorage.setItem('tableId', response.data.id); // Store ObjectId
        sessionStorage.setItem('restaurantId', restaurantIdToVerify);
        sessionStorage.setItem('tableNumber', response.data.number);

        console.log('Navigating to /login');
        navigate('/login');
      }
    } catch (err) {
      console.error('Table verification error:', err);
      console.error('Error response:', err.response?.data);
      setError('Invalid table. Please check the QR code or enter table number manually.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!tableId.trim()) {
      setError('Please enter a table number');
      return;
    }
    await verifyTable(tableId.trim(), restaurantId);
  };

  const handleQRSubmit = async (e) => {
    e.preventDefault();
    if (!qrInput.trim()) {
      setError('Please enter QR code data');
      return;
    }
    try {
      const parsedData = JSON.parse(qrInput.trim());
      if (parsedData.restaurantId && parsedData.tableId) {
        setRestaurantId(parsedData.restaurantId);
        setTableId(parsedData.tableId);
        setMode('qr');
        await verifyTable(parsedData.tableId, parsedData.restaurantId);
      } else {
        setError('Invalid QR code format - missing restaurantId or tableId');
      }
    } catch (err) {
      setError('Invalid QR code data. Expected JSON format like: {"restaurantId":"default","tableId":"..."}');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-950 via-red-900 to-orange-900 flex items-center justify-center p-4">
      <motion.div
        className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/10 max-w-md w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🍽️</div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to DineIn</h1>
          <p className="text-orange-300">Scan QR code or enter table number</p>
        </div>

        <div className="flex mb-6 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setMode('qr')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              mode === 'qr' ? 'bg-orange-500 text-white' : 'text-gray-300 hover:text-white'
            }`}
          >
            📱 Scan QR
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              mode === 'manual' ? 'bg-orange-500 text-white' : 'text-gray-300 hover:text-white'
            }`}
          >
            ✏️ Enter Number
          </button>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-3 mb-4">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {mode === 'qr' ? (
          <div>
            <div className="text-center mb-4">
              <div className="bg-white/5 rounded-lg p-6">
                <div className="text-4xl mb-2">📱</div>
                <p className="text-gray-300 text-sm mb-4">
                  Scan QR code or paste the data below
                </p>
                <form onSubmit={handleQRSubmit}>
                  <textarea
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    placeholder='{"restaurantId":"default","tableId":"..."}'
                    className="w-full bg-white/10 border border-white/20 rounded-lg p-3 text-white placeholder-gray-400 text-sm mb-3"
                    rows="3"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-600/50 text-white px-6 py-2 rounded-lg font-medium text-sm"
                  >
                    {loading ? 'Verifying...' : 'Verify QR Code'}
                  </button>
                </form>
              </div>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-xs">
                Or switch to manual entry
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleManualSubmit}>
            <div className="mb-4">
              <label className="block text-white text-sm font-medium mb-2">
                Table Number
              </label>
              <input
                type="text"
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
                placeholder="Enter table number (e.g., T1, 001)"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-orange-400"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white py-3 rounded-lg font-semibold transition-colors"
            >
              {loading ? 'Verifying...' : 'Continue to Login'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <p className="text-gray-400 text-xs">
            By continuing, you agree to our terms of service
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default TableEntry;
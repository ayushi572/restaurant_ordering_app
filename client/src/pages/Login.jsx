import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    console.log('Login attempt with email:', email);
    try {
      const user = await login(email, password);
      console.log('Login successful:', user);
      // Redirect based on role
      if (user.role === 'kitchen') {
        navigate('/admin/kitchen');
      } else {
        navigate('/admin/dashboard');
      }
    } catch (err) {
      console.error('Full error object:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Login failed. Check your credentials.';
      console.error('Error message:', errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🍽️</div>
          <h1 className="text-3xl font-bold text-white">DineIn Staff</h1>
          <p className="text-gray-400 mt-2">Sign in to access the dashboard</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/10">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-white/70 text-sm mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full p-3 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:border-orange-400 placeholder-gray-500"
                placeholder="admin@restaurant.com"
                required
              />
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full p-3 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:border-orange-400 placeholder-gray-500"
                placeholder="Your password"
                required
              />
            </div>

            {error && <div className="text-red-400 text-sm bg-red-400/10 rounded-lg p-3 text-center">{error}</div>}

            <motion.button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white py-3 rounded-lg font-semibold transition-colors"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </motion.button>
          </form>

          <div className="mt-5 p-3 bg-white/5 rounded-lg text-xs text-gray-400">
            <p className="font-medium text-gray-300 mb-1">First time setup:</p>
            <p>Run <code className="bg-white/10 px-1 rounded">npm run seed:admin</code> to create the default admin account.</p>
            <p className="mt-1">Default: <code className="bg-white/10 px-1 rounded">admin@restaurant.com</code> / <code className="bg-white/10 px-1 rounded">admin123</code></p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { SessionProvider } from './context/SessionContext';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Home from './pages/Home';
import TableEntry from './pages/TableEntry';
import OTPLogin from './pages/OTPLogin';
import OrderSummary from './pages/OrderSummary';
import OrderTracking from './pages/OrderTracking';
import MyOrders from './pages/MyOrders';
import BillPage from './pages/BillPage';
import Admin from './pages/Admin';
import Kitchen from './pages/Kitchen';
import Login from './pages/Login';

// Protected route wrapper
const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-900"><div className="text-white">Loading...</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" replace />;
  return children;
};

const AdminRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-900"><div className="text-white">Loading...</div></div>;
  if (!user) return <Navigate to="/admin/login" replace />;
  return <Navigate to={user.role === 'kitchen' ? '/admin/kitchen' : '/admin/dashboard'} replace />;
};

function App() {
  return (
    <AuthProvider>
      <SessionProvider>
        <CartProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<TableEntry />} />
            <Route path="/login" element={<OTPLogin />} />

            {/* Customer Routes (after login) */}
            <Route path="/menu" element={<Home />} />
            <Route path="/order-summary" element={<OrderSummary />} />
            <Route path="/track/:orderId" element={<OrderTracking />} />
            <Route path="/my-orders" element={<MyOrders />} />
            <Route path="/bill/:billId" element={<BillPage />} />

            {/* Staff Routes */}
            <Route path="/admin/login" element={<Login />} />
            <Route path="/admin" element={<AdminRedirect />} />
            <Route path="/admin/kitchen" element={
              <ProtectedRoute roles={['admin', 'kitchen']}>
                <Kitchen />
              </ProtectedRoute>
            } />
            <Route path="/admin/dashboard" element={
              <ProtectedRoute roles={['admin', 'cashier']}>
                <Admin />
              </ProtectedRoute>
            } />
          </Routes>
        </CartProvider>
      </SessionProvider>
    </AuthProvider>
  );
}

export default App;

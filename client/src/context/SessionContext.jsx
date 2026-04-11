import React, { createContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';

const SessionContext = createContext();
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const SessionProvider = ({ children }) => {
  const [session, setSession] = useState({
    sessionId: null,
    sessionToken: null,
    tableId: null,
    restaurantId: 'default',
    tableNumber: null
  });

  const [userDetails, setUserDetails] = useState({
    name: '',
    phone: ''
  });

  const [previousUsers, setPreviousUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize session from localStorage on mount
  useEffect(() => {
    const savedSession = localStorage.getItem('session');
    const savedUser = localStorage.getItem('userDetails');

    if (savedSession) {
      setSession(JSON.parse(savedSession));
    }

    if (savedUser) {
      setUserDetails(JSON.parse(savedUser));
    }

    // Load previous users by phone if available
    const savedPhone = savedUser ? JSON.parse(savedUser).phone : null;
    if (savedPhone) {
      loadPreviousUsers(savedPhone);
    }

    // Mark as initialized after loading from localStorage
    setIsInitialized(true);
  }, []);

  /**
   * Create a new session
   */
  const createSession = useCallback(async (tableId, restaurantId = 'default', tableNumber = null) => {
    try {
      setLoading(true);

      const response = await axios.post(`${API_URL}/api/sessions/create`, {
        tableId,
        restaurantId,
        tableNumber
      });

      const newSession = {
        sessionId: response.data.sessionId,
        sessionToken: response.data.sessionToken,
        tableId: response.data.tableId,
        restaurantId: response.data.restaurantId,
        tableNumber
      };

      setSession(newSession);
      localStorage.setItem('session', JSON.stringify(newSession));
      localStorage.setItem('customerToken', response.data.sessionToken);

      return newSession;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Store user details in session and localStorage
   */
  const saveUserDetails = useCallback(async (name, phone) => {
    try {
      setLoading(true);

      if (!session.sessionId) {
        throw new Error('No active session');
      }

      // Update in backend
      await axios.put(`${API_URL}/api/sessions/${session.sessionId}/user-details`, {
        customerName: name,
        phone
      });

      const userInfo = { name, phone };
      setUserDetails(userInfo);
      localStorage.setItem('userDetails', JSON.stringify(userInfo));

      // Also store in customer localStorage for backward compatibility
      localStorage.setItem('customer', JSON.stringify({ name, phone }));

      return userInfo;
    } catch (error) {
      console.error('Failed to save user details:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [session.sessionId]);

  /**
   * Update session state (for syncing after login)
   */
  const updateSessionState = useCallback((newSession) => {
    setSession(newSession);
    localStorage.setItem('session', JSON.stringify(newSession));
  }, []);

  /**
   * Update user details state (for syncing after login)
   */
  const updateUserDetailsState = useCallback((userInfo) => {
    setUserDetails(userInfo);
    localStorage.setItem('userDetails', JSON.stringify(userInfo));
    localStorage.setItem('customer', JSON.stringify(userInfo)); // backward compatibility
  }, []);

  /**
   * Check if a previous user with this phone exists
   */
  const checkExistingUser = useCallback(async (phone, restaurantId = 'default') => {
    try {
      const response = await axios.post(
        `${API_URL}/api/sessions/check-existing-user`,
        { phone, restaurantId }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to check existing user:', error);
      return { exists: false };
    }
  }, []);

  /**
   * Load previous users/sessions by phone
   */
  const loadPreviousUsers = useCallback(async (phone, restaurantId = 'default') => {
    try {
      const response = await axios.get(
        `${API_URL}/api/sessions/phone/${phone}`,
        { params: { restaurantId } }
      );

      setPreviousUsers(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to load previous users:', error);
      return [];
    }
  }, []);

  /**
   * Extend session expiry
   */
  const extendSession = useCallback(async () => {
    try {
      if (!session.sessionId) return;

      await axios.put(`${API_URL}/api/sessions/${session.sessionId}/extend`);
    } catch (error) {
      console.error('Failed to extend session:', error);
    }
  }, [session.sessionId]);

  /**
   * End session (logout)
   */
  const endSession = useCallback(async () => {
    try {
      if (session.sessionId) {
        await axios.put(`${API_URL}/api/sessions/${session.sessionId}/end`);
      }

      // Clear localStorage
      localStorage.removeItem('session');
      localStorage.removeItem('customerToken');
      localStorage.removeItem('userDetails');
      localStorage.removeItem('customer');

      setSession({
        sessionId: null,
        sessionToken: null,
        tableId: null,
        restaurantId: 'default',
        tableNumber: null
      });

      setUserDetails({ name: '', phone: '' });
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  }, [session.sessionId]);

  /**
   * Clear user details (for "Change User" button)
   */
  const clearUserDetails = useCallback(() => {
    setUserDetails({ name: '', phone: '' });
    localStorage.removeItem('userDetails');
    localStorage.removeItem('customer');
  }, []);

  /**
   * Get all orders for current session
   */
  const getSessionOrders = useCallback(async () => {
    try {
      if (!session.sessionId) return [];

      const response = await axios.get(
        `${API_URL}/api/sessions/${session.sessionId}/orders`
      );

      return response.data;
    } catch (error) {
      console.error('Failed to get session orders:', error);
      return [];
    }
  }, [session.sessionId]);

  const value = {
    // Session state
    session,
    userDetails,
    previousUsers,
    loading,
    isInitialized,

    // Session methods
    createSession,
    saveUserDetails,
    updateSessionState,
    updateUserDetailsState,
    checkExistingUser,
    loadPreviousUsers,
    extendSession,
    endSession,
    clearUserDetails,
    getSessionOrders
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = React.useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
};

export default SessionContext;

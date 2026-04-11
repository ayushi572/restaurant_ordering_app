import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

// Singleton socket instance
let socketInstance = null;

const getSocket = () => {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
  }
  return socketInstance;
};

// Hook: track a specific order's status
export const useOrderTracking = (orderId, onStatusChange, onPaymentConfirmed) => {
  useEffect(() => {
    if (!orderId) return;
    const socket = getSocket();
    socket.emit('track_order', { orderId });
    socket.on('status_changed', onStatusChange);
    if (onPaymentConfirmed) socket.on('payment_confirmed', onPaymentConfirmed);
    return () => {
      socket.off('status_changed', onStatusChange);
      if (onPaymentConfirmed) socket.off('payment_confirmed', onPaymentConfirmed);
    };
  }, [orderId]);
};

// Hook: kitchen display — listen for new orders
export const useKitchenSocket = (restaurantId, onNewOrder, onOrderUpdated) => {
  useEffect(() => {
    if (!restaurantId) return;
    const socket = getSocket();
    socket.emit('join_kitchen', { restaurantId });
    socket.on('new_order', onNewOrder);
    if (onOrderUpdated) socket.on('order_updated', onOrderUpdated);
    return () => {
      socket.off('new_order', onNewOrder);
      if (onOrderUpdated) socket.off('order_updated', onOrderUpdated);
    };
  }, [restaurantId]);
};

// Hook: menu page — listen for availability changes
export const useMenuSocket = (restaurantId, onItemAvailability, onMenuUpdated) => {
  useEffect(() => {
    if (!restaurantId) return;
    const socket = getSocket();
    socket.emit('join_restaurant', { restaurantId });
    socket.on('item_availability', onItemAvailability);
    if (onMenuUpdated) socket.on('menu_updated', onMenuUpdated);
    return () => {
      socket.off('item_availability', onItemAvailability);
      if (onMenuUpdated) socket.off('menu_updated', onMenuUpdated);
    };
  }, [restaurantId]);
};

// Hook: admin dashboard
export const useAdminSocket = (restaurantId, handlers = {}) => {
  useEffect(() => {
    if (!restaurantId) return;
    const socket = getSocket();
    socket.emit('join_admin', { restaurantId });
    socket.emit('join_kitchen', { restaurantId });
    if (handlers.onNewOrder) socket.on('new_order', handlers.onNewOrder);
    if (handlers.onOrderUpdated) socket.on('order_updated', handlers.onOrderUpdated);
    if (handlers.onPaymentDone) socket.on('payment_done', handlers.onPaymentDone);
    if (handlers.onTableUpdated) socket.on('table_updated', handlers.onTableUpdated);
    return () => {
      socket.off('new_order');
      socket.off('order_updated');
      socket.off('payment_done');
      socket.off('table_updated');
    };
  }, [restaurantId]);
};

export default getSocket;

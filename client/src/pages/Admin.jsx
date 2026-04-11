import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { useAdminSocket } from '../hooks/useSocket';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } });

const STATUS_COLORS = {
  placed: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-purple-100 text-purple-800',
  preparing: 'bg-yellow-100 text-yellow-800',
  ready: 'bg-green-100 text-green-800',
  served: 'bg-teal-100 text-teal-800',
  completed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-800',
};

// Restaurant info — update these to match your actual details
const RESTAURANT_INFO = {
  name: 'Tasty Forks',
  address: '123 Market Road, City',
  gstin: '22AAAAA0000A1Z5',
  phone: '+91 90000 00000',
  upiId: 'tastyforks@upi',
};

// ---------- BILL MODAL ----------
const BillModal = ({ order, onClose }) => {
  const billRef = useRef();

  const handlePrint = () => {
    const content = billRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=400,height=800');
    win.document.write(`
      <html>
        <head>
          <title>Bill #${order.orderNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Courier New', Courier, monospace; font-size: 12px; width: 300px; margin: auto; padding: 10px; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .row { display: flex; justify-content: space-between; margin: 2px 0; }
            .items-header { display: grid; grid-template-columns: 1fr auto auto auto; gap: 4px; font-weight: bold; margin: 4px 0; }
            .item-row { display: grid; grid-template-columns: 1fr auto auto auto; gap: 4px; margin: 3px 0; }
            .grand { font-size: 14px; font-weight: bold; }
            img { display: block; margin: 8px auto; }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const subtotal = order.subtotal || order.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = order.discount || 0;
  const taxableValue = subtotal - discount;
  const cgst = parseFloat((taxableValue * 0.025).toFixed(2));
  const sgst = parseFloat((taxableValue * 0.025).toFixed(2));
  const grandTotal = taxableValue + cgst + sgst;
  const paidAmount = order.paidAmount || 0;
  const balance = paidAmount - grandTotal;
  const billDate = new Date(order.createdAt).toLocaleString('en-IN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).replace(',', '');

  const qrData = `upi://pay?pa=${RESTAURANT_INFO.upiId}&pn=${encodeURIComponent(RESTAURANT_INFO.name)}&am=${grandTotal.toFixed(2)}&cu=INR`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}`;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Action buttons */}
        <div className="flex justify-between items-center px-4 py-3 border-b">
          <h3 className="font-semibold text-gray-700">Bill Preview</h3>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="bg-orange-500 hover:bg-orange-600 text-white text-sm px-4 py-1.5 rounded-lg font-medium"
            >
              🖨️ Print
            </button>
            <button
              onClick={onClose}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm px-3 py-1.5 rounded-lg"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Bill content */}
        <div className="p-4 overflow-y-auto max-h-[80vh]">
          <div
            ref={billRef}
            style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '12px', width: '100%' }}
          >
            {/* Header */}
            <div className="center bold" style={{ fontSize: '16px', textAlign: 'center', fontWeight: 'bold' }}>
              {RESTAURANT_INFO.name}
            </div>
            <div style={{ textAlign: 'center', marginBottom: '2px' }}>{RESTAURANT_INFO.address}</div>
            <div style={{ textAlign: 'center', marginBottom: '2px' }}>GSTIN: {RESTAURANT_INFO.gstin}</div>
            <div style={{ textAlign: 'center', marginBottom: '6px' }}>Phone: {RESTAURANT_INFO.phone}</div>

            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Bill meta */}
            <div style={{ textAlign: 'center', marginBottom: '2px' }}>Bill No: TF-{order.orderNumber}</div>
            <div style={{ textAlign: 'center', marginBottom: '2px' }}>Date: {billDate}</div>
            <div style={{ textAlign: 'center', marginBottom: '2px' }}>Table: {String(order.tableNumber).padStart(2, '0')}</div>
            <div style={{ textAlign: 'center', marginBottom: '2px' }}>KOT No: KOT-{order.orderNumber}</div>
            <div style={{ textAlign: 'center', marginBottom: '2px' }}>Customer: {order.customerName}</div>
            <div style={{ textAlign: 'center', marginBottom: '6px' }}>Phone: {order.phone}</div>

            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Items header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 30px 60px 60px', gap: '4px', fontWeight: 'bold', marginBottom: '4px' }}>
              <span>Item</span>
              <span style={{ textAlign: 'right' }}>Qty</span>
              <span style={{ textAlign: 'right' }}>Rate</span>
              <span style={{ textAlign: 'right' }}>Amt</span>
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

            {/* Items */}
            {order.items.map((item, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 30px 60px 60px', gap: '4px', marginBottom: '4px' }}>
                <span>{item.name}</span>
                <span style={{ textAlign: 'right' }}>{item.quantity}</span>
                <span style={{ textAlign: 'right' }}>{item.price.toFixed(2)}</span>
                <span style={{ textAlign: 'right' }}>{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}

            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Totals */}
            {[
              ['Subtotal', subtotal.toFixed(2)],
              ['Discount', discount.toFixed(2)],
              ['Taxable Value', taxableValue.toFixed(2)],
              ['CGST (2.5%)', cgst.toFixed(2)],
              ['SGST (2.5%)', sgst.toFixed(2)],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>{label}</span><span>{val}</span>
              </div>
            ))}

            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', marginBottom: '6px' }}>
              <span>Grand Total</span><span>{grandTotal.toFixed(2)}</span>
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Payment */}
            {[
              ['Payment Mode', order.paymentMethod || 'UPI'],
              ['Paid Amount', paidAmount.toFixed(2)],
              ['Balance', balance.toFixed(2)],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>{label}</span><span>{val}</span>
              </div>
            ))}

            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* QR */}
            <div style={{ textAlign: 'center', marginBottom: '4px', fontWeight: 'bold' }}>Scan &amp; Pay</div>
            <img src={qrUrl} alt="UPI QR" width={120} height={120} style={{ display: 'block', margin: '0 auto 6px' }} />
            <div style={{ textAlign: 'center', marginBottom: '2px' }}>UPI ID: {RESTAURANT_INFO.upiId}</div>
            <div style={{ textAlign: 'center', marginBottom: '6px' }}>Name: {RESTAURANT_INFO.name}</div>

            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px', marginBottom: '2px' }}>
              Thank you! Visit again.
            </div>
            <div style={{ textAlign: 'center', fontSize: '11px' }}>GST included as applicable</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------- MENU MANAGEMENT ----------
const MenuTab = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', price: '', category: '', image: '', description: '', isVeg: false });
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    const res = await axios.get(`${API_URL}/api/menu?restaurantId=${user?.restaurantId || 'default'}`);
    setItems(res.data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editing) {
        await axios.put(`${API_URL}/api/menu/${editing._id}`, form, authHeader());
      } else {
        await axios.post(`${API_URL}/api/menu`, form, authHeader());
      }
      fetchItems();
      resetForm();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailability = async (item) => {
    await axios.patch(`${API_URL}/api/menu/${item._id}/availability`, { available: !item.available }, authHeader());
    fetchItems();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    await axios.delete(`${API_URL}/api/menu/${id}`, authHeader());
    fetchItems();
  };

  const resetForm = () => { setEditing(null); setForm({ name: '', price: '', category: '', image: '', description: '', isVeg: false }); };

  const handleEdit = (item) => {
    setEditing(item);
    setForm({ name: item.name, price: item.price, category: item.category, image: item.image, description: item.description, isVeg: item.isVeg || false });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-4">{editing ? 'Edit Item' : 'Add New Item'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="w-full p-2.5 border rounded-lg text-sm" placeholder="Item name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
          <div className="grid grid-cols-2 gap-3">
            <input className="p-2.5 border rounded-lg text-sm" type="number" placeholder="Price (₹)" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required />
            <input className="p-2.5 border rounded-lg text-sm" placeholder="Category" value={form.category} onChange={e => setForm({...form, category: e.target.value})} required />
          </div>
          <input className="w-full p-2.5 border rounded-lg text-sm" type="url" placeholder="Image URL (optional)" value={form.image} onChange={e => setForm({...form, image: e.target.value})} />
          <textarea className="w-full p-2.5 border rounded-lg text-sm" rows="2" placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.isVeg} onChange={e => setForm({...form, isVeg: e.target.checked})} className="rounded" />
            <span className="text-green-600 font-medium">🌿 Vegetarian item</span>
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-50">
              {loading ? 'Saving...' : editing ? 'Update Item' : 'Add Item'}
            </button>
            {editing && <button type="button" onClick={resetForm} className="px-4 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm">Cancel</button>}
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Menu Items ({items.length})</h3>
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {items.map(item => (
            <div key={item._id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50">
              {item.image && <img src={item.image} alt={item.name} className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.name}</p>
                <p className="text-gray-500 text-xs">₹{item.price} · {item.category}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => toggleAvailability(item)}
                  className={`text-xs px-2 py-1 rounded-full font-medium ${item.available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {item.available ? 'Available' : 'Unavailable'}
                </button>
                <button onClick={() => handleEdit(item)} className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-1 rounded">Edit</button>
                <button onClick={() => handleDelete(item._id)} className="text-xs bg-red-100 text-red-700 hover:bg-red-200 px-2 py-1 rounded">Del</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------- ORDERS ----------
const OrdersTab = ({ orders, onUpdateStatus }) => {
  const [billOrder, setBillOrder] = useState(null);

  return (
    <>
      {billOrder && <BillModal order={billOrder} onClose={() => setBillOrder(null)} />}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium text-gray-600">#</th>
                <th className="text-left p-3 font-medium text-gray-600">Customer</th>
                <th className="text-left p-3 font-medium text-gray-600">Table</th>
                <th className="text-left p-3 font-medium text-gray-600">Items</th>
                <th className="text-left p-3 font-medium text-gray-600">Total</th>
                <th className="text-left p-3 font-medium text-gray-600">Status</th>
                <th className="text-left p-3 font-medium text-gray-600">Payment</th>
                <th className="text-left p-3 font-medium text-gray-600">Action</th>
                <th className="text-left p-3 font-medium text-gray-600">Bill</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order._id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-800">#{order.orderNumber}</td>
                  <td className="p-3">
                    <p className="font-medium">{order.customerName}</p>
                    <p className="text-gray-400 text-xs">{order.phone}</p>
                  </td>
                  <td className="p-3 text-gray-600">{order.tableNumber || '—'}</td>
                  <td className="p-3 text-gray-600 max-w-[160px] truncate">{order.items.map(i => `${i.name} ×${i.quantity}`).join(', ')}</td>
                  <td className="p-3 font-semibold">₹{order.total}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-700'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {order.paymentStatus}
                    </span>
                  </td>
                  <td className="p-3">
                    <select
                      value={order.status}
                      onChange={e => onUpdateStatus(order._id, e.target.value)}
                      className="text-xs border rounded px-2 py-1 bg-white"
                    >
                      {['placed','confirmed','preparing','ready','served','completed','cancelled'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => setBillOrder(order)}
                      className="text-xs bg-orange-100 text-orange-700 hover:bg-orange-200 px-2 py-1 rounded font-medium whitespace-nowrap"
                    >
                      🧾 Bill
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <p className="text-center text-gray-400 py-12">No orders found</p>}
        </div>
      </div>
    </>
  );
};

// ---------- ANALYTICS ----------
const AnalyticsTab = () => {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('today');

  useEffect(() => {
    axios.get(`${API_URL}/api/orders/analytics/summary?period=${period}`, authHeader())
      .then(res => setData(res.data))
      .catch(() => {});
  }, [period]);

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {['today', 'week', 'month'].map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium ${period === p ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {data && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow p-5">
              <p className="text-gray-500 text-sm">Revenue</p>
              <p className="text-3xl font-bold text-orange-500 mt-1">₹{data.summary.revenue?.toFixed(0) || 0}</p>
            </div>
            <div className="bg-white rounded-xl shadow p-5">
              <p className="text-gray-500 text-sm">Orders</p>
              <p className="text-3xl font-bold text-blue-500 mt-1">{data.summary.count || 0}</p>
            </div>
            <div className="bg-white rounded-xl shadow p-5">
              <p className="text-gray-500 text-sm">Avg Order</p>
              <p className="text-3xl font-bold text-green-500 mt-1">₹{data.summary.avgOrder?.toFixed(0) || 0}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-5">
            <h3 className="font-semibold mb-4">Top Selling Items</h3>
            <div className="space-y-2">
              {data.topItems.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-gray-400 text-sm w-5">{i + 1}.</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{item._id}</span>
                      <span className="text-gray-500">{item.count} sold</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-400 rounded-full" style={{ width: `${Math.min(100, (item.count / (data.topItems[0]?.count || 1)) * 100)}%` }}></div>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-green-600">₹{item.revenue}</span>
                </div>
              ))}
              {data.topItems.length === 0 && <p className="text-gray-400 text-sm">No data for this period</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ---------- MAIN ADMIN ----------
const Admin = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [liveCount, setLiveCount] = useState(0);

  const restaurantId = user?.restaurantId || 'default';

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/orders`, authHeader());
      setOrders(res.data);
    } catch (err) {}
  };

  useEffect(() => { if (activeTab === 'orders') fetchOrders(); }, [activeTab]);

  useAdminSocket(restaurantId, {
    onNewOrder: (order) => {
      setOrders(prev => [order, ...prev]);
      setLiveCount(c => c + 1);
    },
    onOrderUpdated: (updated) => {
      setOrders(prev => prev.map(o => o._id === updated._id ? updated : o));
    },
    onPaymentDone: () => fetchOrders(),
  });

  const handleUpdateStatus = async (orderId, status) => {
    try {
      const res = await axios.put(`${API_URL}/api/orders/${orderId}`, { status }, authHeader());
      setOrders(prev => prev.map(o => o._id === orderId ? res.data : o));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update');
    }
  };

  const tabs = [
    { id: 'orders', label: 'Orders', badge: liveCount > 0 ? liveCount : null },
    { id: 'menu', label: 'Menu' },
    { id: 'analytics', label: 'Analytics' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white border-b shadow-sm px-6 py-4 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🍽️</span>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Admin Dashboard</h1>
            <p className="text-gray-500 text-xs">{user?.name} · {user?.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <a href="/kitchen" target="_blank" className="text-sm text-orange-600 hover:text-orange-700 font-medium">
            👨‍🍳 Open Kitchen View
          </a>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">Logout</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-1 bg-white rounded-xl p-1 shadow mb-6 w-fit">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); if (tab.id === 'orders') setLiveCount(0); }}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === tab.id ? 'bg-orange-500 text-white shadow' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
              {tab.badge && <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{tab.badge}</span>}
            </button>
          ))}
        </div>

        {activeTab === 'orders' && <OrdersTab orders={orders} onUpdateStatus={handleUpdateStatus} />}
        {activeTab === 'menu' && <MenuTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
      </div>
    </div>
  );
};

export default Admin;
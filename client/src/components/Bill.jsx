import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import PaymentComponent from './PaymentComponent';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Global cache for html2pdf library - load once
let html2pdfCache = null;
const html2pdfPromise = (() => {
  if (html2pdfCache) return Promise.resolve(html2pdfCache);
  if (typeof window === 'undefined') return Promise.reject('Window not available');
  
  if (window.html2pdf) {
    html2pdfCache = window.html2pdf;
    return Promise.resolve(window.html2pdf);
  }
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.async = true;
    script.onload = () => {
      html2pdfCache = window.html2pdf;
      resolve(window.html2pdf);
    };
    script.onerror = () => reject(new Error('Failed to load html2pdf'));
    document.head.appendChild(script);
  });
})();

const Bill = ({ billId, onPaymentSuccess, onClose }) => {
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const fetchAbortControllerRef = useRef(null);

  useEffect(() => {
    fetchBill();
    
    return () => {
      // Cancel ongoing request on unmount
      if (fetchAbortControllerRef.current) {
        fetchAbortControllerRef.current.abort();
      }
    };
  }, [billId]);

  const fetchBill = async () => {
    try {
      setLoading(true);
      
      // Cancel previous request if exists
      if (fetchAbortControllerRef.current) {
        fetchAbortControllerRef.current.abort();
      }
      
      fetchAbortControllerRef.current = new AbortController();
      const token = localStorage.getItem('customerToken');
      
      if (!billId) {
        throw new Error('Bill ID is missing');
      }
      
      const response = await axios.get(`${API_URL}/api/bills/${billId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: fetchAbortControllerRef.current.signal,
        timeout: 8000 // 8 second timeout
      });
      
      if (!response.data) {
        throw new Error('Empty response from server');
      }
      
      setBill(response.data);
      setError(null);
    } catch (err) {
      if (err.name !== 'CanceledError') {
        const errorMsg = err.response?.data?.error || err.message || 'Failed to load bill';
        console.error('Bill fetch error:', { billId, error: errorMsg, status: err.response?.status });
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccessInternal = async () => {
    setShowPayment(false);
    await fetchBill();
    onPaymentSuccess?.();
  };

  // Memoize formatted bill data to prevent unnecessary recalculations
  const formattedBillData = useMemo(() => {
    if (!bill) return null;
    return {
      billNumber: bill.billNumber,
      createdAt: new Date(bill.createdAt),
      paymentStatus: bill.paymentStatus,
      customerName: bill.customerName,
      phone: bill.phone,
      tableNumber: bill.tableNumber,
      items: bill.items?.map(item => ({
        ...item,
        priceFixed: item.price.toFixed(2),
        totalPriceFixed: item.totalPrice.toFixed(2)
      })) || [],
      subtotal: bill.subtotal?.toFixed(2) || '0.00',
      discount: bill.discount?.toFixed(2) || '0.00',
      tax: bill.tax?.toFixed(2) || '0.00',
      serviceCharge: bill.serviceCharge?.toFixed(2) || '0.00',
      packagingCharges: bill.packagingCharges?.toFixed(2) || '0.00',
      grandTotal: bill.grandTotal?.toFixed(2) || '0.00',
      paidAmount: bill.paidAmount?.toFixed(2) || '0.00',
      remainingAmount: bill.remainingAmount?.toFixed(2) || '0.00',
      discountPercentage: bill.discountPercentage,
      printCount: bill.printCount || 0
    };
  }, [bill]);

  const handleDownloadPdf = async (format = 'a4') => {
    if (!bill) return;
    setDownloadLoading(true);

    try {
      const html2pdf = await html2pdfPromise;
      const element = document.getElementById('bill-print-area');
      if (!element) throw new Error('Bill area not found');
      
      const filename = `bill-${bill.billNumber}-${format}.pdf`;
      const options = {
        margin: 10,
        filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: {
          unit: 'mm',
          format: format === 'thermal' ? [80, 220] : 'a4',
          compress: true
        }
      };
      
      await html2pdf().set(options).from(element).save();
    } catch (err) {
      console.error('Unable to generate PDF:', err);
      setError('Failed to generate PDF');
    } finally {
      setDownloadLoading(false);
    }
  };

  const handlePrint = async () => {
    try {
      setIsPrinting(true);

      await axios.put(`${API_URL}/api/bills/${billId}/print`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('customerToken')}` },
        timeout: 5000
      });

      window.print();
      await fetchBill();
    } catch (err) {
      console.error('Failed to print:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin">
          <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-4 text-red-300">
        {error || 'Bill not found'}
      </div>
    );
  }

  const data = formattedBillData;

  if (!data) {
    return (
      <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-lg p-4 text-yellow-300">
        Bill data is loading...
      </div>
    );
  }

  return (
    <motion.div
      className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg overflow-hidden"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 px-6 py-5">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold text-white">Restaurant Bill</h1>
          <p className="text-orange-100 text-sm">Thank you for dining with us</p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-orange-100 text-xs uppercase tracking-[0.2em]">Bill No.</p>
            <p className="text-white font-semibold text-lg">#{data.billNumber}</p>
          </div>
          <div>
            <p className="text-orange-100 text-xs uppercase tracking-[0.2em]">Date</p>
            <p className="text-white font-semibold text-lg">{data.createdAt.toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-orange-100 text-xs uppercase tracking-[0.2em]">Status</p>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
              data.paymentStatus === 'paid'
                ? 'bg-green-500 text-white'
                : 'bg-yellow-500 text-black'
            }`}>
              {data.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div id="bill-print-area" className="p-6 space-y-6 max-h-96 overflow-y-auto">
        {/* Customer Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Customer Name</p>
            <p className="text-white font-semibold">{data.customerName}</p>
          </div>
          <div>
            <p className="text-gray-400">Phone</p>
            <p className="text-white font-semibold">{data.phone}</p>
          </div>
          {data.tableNumber && (
            <div>
              <p className="text-gray-400">Table</p>
              <p className="text-white font-semibold">{data.tableNumber}</p>
            </div>
          )}
          <div>
            <p className="text-gray-400">Date & Time</p>
            <p className="text-white font-semibold text-xs">
              {data.createdAt.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Items Section */}
        <div className="border-t border-white/10 pt-4">
          <div className="space-y-3">
            {data.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start bg-white/5 rounded-xl p-3">
                <div>
                  <p className="text-white font-semibold">{item.name}</p>
                  <p className="text-gray-400 text-xs">{item.quantity} × ₹{item.priceFixed}</p>
                </div>
                <p className="text-orange-300 font-semibold">₹{item.totalPriceFixed}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Breakdown */}
        <div className="border-t border-white/10 pt-4 space-y-2 text-sm">
          <div className="flex justify-between text-gray-300">
            <span>Subtotal:</span>
            <span>₹{data.subtotal}</span>
          </div>
          {parseFloat(data.discount) > 0 && (
            <div className="flex justify-between text-green-400">
              <span>Discount ({data.discountPercentage}%):</span>
              <span>-₹{data.discount}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-300">
            <span>Tax (5%):</span>
            <span>₹{data.tax}</span>
          </div>
          {parseFloat(data.serviceCharge) > 0 && (
            <div className="flex justify-between text-gray-300">
              <span>Service Charge:</span>
              <span>₹{data.serviceCharge}</span>
            </div>
          )}
          {parseFloat(data.packagingCharges) > 0 && (
            <div className="flex justify-between text-gray-300">
              <span>Packaging:</span>
              <span>₹{data.packagingCharges}</span>
            </div>
          )}
        </div>

        {/* Grand Total */}
        <div className="border-t-2 border-orange-500/50 pt-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold text-white">Grand Total:</span>
            <span className="text-2xl font-bold text-orange-400">
              ₹{data.grandTotal}
            </span>
          </div>
          {data.paymentStatus === 'paid' && (
            <div className="flex justify-between text-green-400 text-sm mt-2">
              <span>Paid Amount:</span>
              <span>₹{data.paidAmount}</span>
            </div>
          )}
          {parseFloat(data.remainingAmount) > 0 && (
            <div className="flex justify-between text-yellow-400 text-sm font-semibold mt-2">
              <span>Remaining:</span>
              <span>₹{data.remainingAmount}</span>
            </div>
          )}
        </div>

        {/* Print Count */}
        {data.printCount > 0 && (
          <div className="text-xs text-gray-500 text-center">
            Printed {data.printCount} time(s)
          </div>
        )}
      </div>

      {/* Payment Panel */}
      {data.paymentStatus !== 'paid' && showPayment && (
        <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 p-5">
          <PaymentComponent
            billId={billId}
            grandTotal={data.grandTotal}
            onPaymentSuccess={handlePaymentSuccessInternal}
            onPaymentFailed={() => setShowPayment(false)}
          />
        </div>
      )}

      {/* Footer Actions */}
      <div className="bg-white/5 border-t border-white/10 px-6 py-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-4">
          <motion.button
            onClick={handlePrint}
            disabled={isPrinting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white px-4 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isPrinting ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                Printing...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4H9a2 2 0 01-2-2v-4a2 2 0 012-2h6a2 2 0 012 2v4a2 2 0 01-2 2z" />
                </svg>
                Print Bill
              </>
            )}
          </motion.button>

          <motion.button
            onClick={() => handleDownloadPdf('a4')}
            disabled={downloadLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white px-4 py-3 rounded-lg font-semibold transition"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {downloadLoading ? 'Preparing PDF...' : 'Download A4'}
          </motion.button>

          <motion.button
            onClick={() => handleDownloadPdf('thermal')}
            disabled={downloadLoading}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-violet-600/50 text-white px-4 py-3 rounded-lg font-semibold transition"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {downloadLoading ? 'Preparing PDF...' : 'Download Thermal'}
          </motion.button>

          {data.paymentStatus !== 'paid' && (
            <motion.button
              onClick={() => setShowPayment(prev => !prev)}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white px-4 py-3 rounded-lg font-semibold transition"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {showPayment ? 'Hide Payment Options' : 'Pay Now'}
            </motion.button>
          )}
        </div>

        {onClose && (
          <motion.button
            onClick={onClose}
            className="w-full bg-gray-700 hover:bg-gray-800 text-white px-4 py-3 rounded-lg font-semibold transition"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Close
          </motion.button>
        )}
      </div>

      {/* Print Stylesheet */}
      <style>{`
        @media print {
          body {
            background: white;
            color: black;
          }
          * {
            background: white !important;
            color: black !important;
            border-color: #ccc !important;
          }
          .no-print {
            display: none !important;
          }
          button {
            display: none !important;
          }
        }
      `}</style>
    </motion.div>
  );
};

export default Bill;

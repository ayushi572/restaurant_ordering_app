import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Bill from '../components/Bill';

const BillPage = () => {
  const { billId } = useParams();
  const navigate = useNavigate();
  const tableNumber = sessionStorage.getItem('tableNumber') || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-950 via-red-900 to-orange-900 pb-10">
      <Header tableId={sessionStorage.getItem('tableId') || ''} tableNumber={tableNumber} />
      <div className="max-w-4xl mx-auto px-4 pt-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-orange-300 uppercase tracking-[0.25em]">Bill Details</p>
            <h1 className="text-3xl font-bold text-white">Review your bill</h1>
            <p className="text-gray-300 mt-2">Secure payment, print-ready receipt, and order reconciliation.</p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="rounded-full border border-white/20 bg-white/10 text-white px-5 py-3 text-sm hover:bg-white/20 transition"
          >
            ← Back
          </button>
        </div>

        <Bill billId={billId} onClose={() => navigate('/my-orders')} />
      </div>
    </div>
  );
};

export default BillPage;

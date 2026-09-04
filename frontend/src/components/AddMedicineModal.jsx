'use client';

import React, { useState } from 'react';
import axios from 'axios';
import { X, Pill, AlertCircle, Plus } from 'lucide-react';

const API_BASE = 'http://localhost:8000/api/v1';

export default function AddMedicineModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    disease_category: 'General',
    dosage: '',
    initial_quantity: 30,
    current_stock: 30,
    daily_frequency: 1,
    quantity_per_dose: 1,
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.name.trim()) {
      setError('Medicine name is required.');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        name: formData.name.trim(),
        disease_category: formData.disease_category.trim() || 'General',
        dosage: formData.dosage.trim() || null,
        initial_quantity: Number(formData.initial_quantity) || 0,
        current_stock: Number(formData.current_stock) || 0,
        daily_frequency: Number(formData.daily_frequency) || 1,
        quantity_per_dose: Number(formData.quantity_per_dose) || 1,
        notes: formData.notes.trim() || null,
      };

      await axios.post(`${API_BASE}/medicines/`, payload);
      setLoading(false);
      onSuccess();
      onClose();
      // Reset form
      setFormData({
        name: '',
        disease_category: 'General',
        dosage: '',
        initial_quantity: 30,
        current_stock: 30,
        daily_frequency: 1,
        quantity_per_dose: 1,
        notes: '',
      });
    } catch (err) {
      setLoading(false);
      const msg = err.response?.data?.detail || 'Failed to create medicine record.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Add New Medicine</h2>
              <p className="text-xs text-slate-400">Add a medicine to your personal inventory & tracking</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Medicine Name */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Medicine Name <span className="text-teal-400">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Amoxicillin, Metformin"
                required
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
              />
            </div>

            {/* Disease Category */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Disease Category</label>
              <input
                type="text"
                name="disease_category"
                value={formData.disease_category}
                onChange={handleChange}
                placeholder="e.g. Diabetes, Hypertension, General"
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
              />
            </div>

            {/* Dosage */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Dosage Specification</label>
              <input
                type="text"
                name="dosage"
                value={formData.dosage}
                onChange={handleChange}
                placeholder="e.g. 500mg, 10ml, 1 tablet"
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
              />
            </div>

            {/* Current Stock */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Current Stock Count</label>
              <input
                type="number"
                name="current_stock"
                min="0"
                value={formData.current_stock}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
              />
            </div>

            {/* Initial Quantity */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Initial Pack Quantity</label>
              <input
                type="number"
                name="initial_quantity"
                min="0"
                value={formData.initial_quantity}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
              />
            </div>

            {/* Daily Frequency */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Daily Frequency (Times / Day)</label>
              <input
                type="number"
                name="daily_frequency"
                min="1"
                value={formData.daily_frequency}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
              />
            </div>

            {/* Quantity per Dose */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Pills per Dose</label>
              <input
                type="number"
                name="quantity_per_dose"
                min="1"
                value={formData.quantity_per_dose}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">Notes / Instructions</label>
              <textarea
                name="notes"
                rows="2"
                value={formData.notes}
                onChange={handleChange}
                placeholder="e.g. Take after food, avoid dairy"
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition resize-none"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-medium transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              {loading ? 'Saving...' : 'Add Medicine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

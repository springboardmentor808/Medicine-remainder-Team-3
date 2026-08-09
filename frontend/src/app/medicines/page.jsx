'use client';

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Pill,
  Search,
  Plus,
  Edit2,
  Trash2,
  Filter,
  Grid,
  List as ListIcon,
  RefreshCw,
  AlertTriangle,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import AddMedicineModal from '../../components/AddMedicineModal';
import EditMedicineModal from '../../components/EditMedicineModal';

const API_BASE = 'http://localhost:8000/api/v1';

export default function MedicinesPage() {
  const [medicines, setMedicines] = useState([]);
  const [groupedMedicines, setGroupedMedicines] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters & Views
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list' | 'grouped'

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);

  // Expanded accordion groups for grouped view
  const [expandedGroups, setExpandedGroups] = useState({});

  // Fetch medicines list
  const fetchMedicines = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (viewMode === 'grouped') {
        const res = await axios.get(`${API_BASE}/medicines/grouped/by-disease`);
        setGroupedMedicines(res.data || []);
        let count = 0;
        (res.data || []).forEach((group) => {
          count += group.medicines?.length || 0;
        });
        setTotalCount(count);
      } else {
        const params = {};
        if (search.trim()) params.search = search.trim();
        if (selectedCategory) params.disease_category = selectedCategory;

        const res = await axios.get(`${API_BASE}/medicines/`, { params });
        setMedicines(res.data.medicines || []);
        setTotalCount(res.data.total || 0);
      }
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to load medicines.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, viewMode]);

  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines]);

  // Quick Stock Adjustment
  const handleStockAdjust = async (id, adjustment) => {
    try {
      await axios.patch(`${API_BASE}/medicines/${id}/stock`, { adjustment });
      fetchMedicines();
    } catch (err) {
      alert('Failed to update stock count.');
    }
  };

  // Delete Medicine
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete '${name}'? This action cannot be undone.`)) {
      return;
    }
    try {
      await axios.delete(`${API_BASE}/medicines/${id}`);
      fetchMedicines();
    } catch (err) {
      alert('Failed to delete medicine record.');
    }
  };

  // Toggle Group Accordion
  const toggleGroup = (category) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  return (
    <main className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto space-y-8">
      {/* Header Bar */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-500/20 rounded-xl border border-teal-500/30 text-teal-400">
            <Pill className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-indigo-400">
              Medicine Catalog
            </h1>
            <p className="text-sm text-slate-400">Manage prescriptions, stock levels, and dosage schedules</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => fetchMedicines()}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
            title="Refresh Inventory"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsAddOpen(true)}
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-teal-900/40 transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Medicine
          </button>
        </div>
      </header>

      {/* Control Bar: Search, Category Filter & View Toggles */}
      <div className="p-4 bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search medicine by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={viewMode === 'grouped'}
            className="w-full pl-10 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition disabled:opacity-50"
          />
        </div>

        {/* Filters & View Toggles */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          {/* Category Dropdown */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              disabled={viewMode === 'grouped'}
              className="px-3 py-2 pr-8 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-teal-500 transition appearance-none cursor-pointer disabled:opacity-50"
            >
              <option value="">All Categories</option>
              <option value="General">General</option>
              <option value="Diabetes">Diabetes</option>
              <option value="Hypertension">Hypertension</option>
              <option value="Cardiology">Cardiology</option>
              <option value="Antibiotic">Antibiotic</option>
            </select>
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
          </div>

          {/* View Mode Buttons */}
          <div className="flex items-center p-1 bg-slate-800/80 rounded-xl border border-slate-700/80">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grid' ? 'bg-teal-500/20 text-teal-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'list' ? 'bg-teal-500/20 text-teal-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="List View"
            >
              <ListIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grouped')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grouped' ? 'bg-teal-500/20 text-teal-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Group by Disease"
            >
              <Layers className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={fetchMedicines} className="underline hover:text-red-300">
            Retry
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400">Loading medicine inventory...</p>
        </div>
      ) : totalCount === 0 ? (
        <div className="py-16 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-4">
          <Pill className="w-12 h-12 text-slate-600 mx-auto" />
          <div>
            <h3 className="text-base font-semibold text-slate-300">No Medicines Found</h3>
            <p className="text-xs text-slate-500 mt-1">Get started by adding your first medicine record</p>
          </div>
          <button
            onClick={() => setIsAddOpen(true)}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-medium transition inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Medicine
          </button>
        </div>
      ) : (
        <>
          {/* Grid View */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {medicines.map((med) => (
                <div
                  key={med.id}
                  className="p-5 bg-slate-900/60 hover:bg-slate-900/90 rounded-2xl border border-slate-800 hover:border-slate-700/80 transition flex flex-col justify-between space-y-4 shadow-lg group"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h3 className="font-semibold text-slate-100 group-hover:text-teal-300 transition">
                          {med.name}
                        </h3>
                        {med.dosage && <span className="text-xs text-slate-400">{med.dosage}</span>}
                      </div>
                      <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-teal-400 rounded-full text-[11px] font-medium">
                        {med.disease_category || 'General'}
                      </span>
                    </div>

                    {/* Stock & Schedule Stats */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="p-2.5 bg-slate-800/40 rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Current Stock</span>
                        <div className="flex items-center justify-between mt-1">
                          <span className={`font-semibold ${med.current_stock <= 5 ? 'text-amber-400' : 'text-slate-200'}`}>
                            {med.current_stock} pills
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleStockAdjust(med.id, -1)}
                              className="w-5 h-5 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 flex items-center justify-center text-xs font-bold"
                              title="Decrease 1 pill"
                            >
                              -
                            </button>
                            <button
                              onClick={() => handleStockAdjust(med.id, 1)}
                              className="w-5 h-5 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 flex items-center justify-center text-xs font-bold"
                              title="Increase 1 pill"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="p-2.5 bg-slate-800/40 rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Est. Days Left</span>
                        <span className="font-semibold text-indigo-300 mt-1 block">
                          {med.days_until_empty != null ? `${med.days_until_empty} days` : 'N/A'}
                        </span>
                      </div>
                    </div>

                    {med.notes && (
                      <p className="text-[11px] text-slate-400 italic bg-slate-800/30 p-2 rounded-lg border border-slate-800/50">
                        "{med.notes}"
                      </p>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="flex justify-between items-center pt-3 border-t border-slate-800/80">
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> {med.daily_frequency}x daily ({med.quantity_per_dose} per dose)
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingMedicine(med);
                          setIsEditOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition"
                        title="Edit Medicine"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(med.id, med.name)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                        title="Delete Medicine"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-800 font-medium">
                  <tr>
                    <th className="p-4">Medicine Name</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Dosage</th>
                    <th className="p-4">Stock</th>
                    <th className="p-4">Days Left</th>
                    <th className="p-4">Frequency</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {medicines.map((med) => (
                    <tr key={med.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4 font-semibold text-slate-100 flex items-center gap-2">
                        <Pill className="w-4 h-4 text-teal-400" />
                        {med.name}
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-teal-300 rounded-md text-[11px]">
                          {med.disease_category || 'General'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400">{med.dosage || '-'}</td>
                      <td className="p-4">
                        <span className={med.current_stock <= 5 ? 'text-amber-400 font-bold' : 'text-slate-200'}>
                          {med.current_stock}
                        </span>
                      </td>
                      <td className="p-4 text-indigo-300 font-medium">
                        {med.days_until_empty != null ? `${med.days_until_empty}d` : '-'}
                      </td>
                      <td className="p-4 text-slate-400">{med.daily_frequency}x/day</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingMedicine(med);
                              setIsEditOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(med.id, med.name)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Grouped View */}
          {viewMode === 'grouped' && (
            <div className="space-y-4">
              {groupedMedicines.map((group) => {
                const isExpanded = expandedGroups[group.category] !== false; // Default open
                return (
                  <div key={group.category} className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
                    <button
                      onClick={() => toggleGroup(group.category)}
                      className="w-full px-6 py-4 bg-slate-800/40 hover:bg-slate-800/80 border-b border-slate-800 flex items-center justify-between text-left transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
                          <Layers className="w-4 h-4" />
                        </span>
                        <div>
                          <h3 className="font-semibold text-slate-100 text-sm">{group.category}</h3>
                          <span className="text-xs text-slate-400">{group.count} medicine(s)</span>
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>

                    {isExpanded && (
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-950/40">
                        {group.medicines.map((med) => (
                          <div key={med.id} className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
                            <div className="flex justify-between items-start">
                              <h4 className="font-semibold text-slate-200 text-xs">{med.name}</h4>
                              <span className="text-[10px] text-slate-400">{med.dosage}</span>
                            </div>
                            <div className="flex justify-between text-[11px] text-slate-400">
                              <span>Stock: <strong className="text-slate-200">{med.current_stock}</strong></span>
                              <span>Days Left: <strong className="text-indigo-300">{med.days_until_empty ?? 'N/A'}</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <AddMedicineModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSuccess={fetchMedicines}
      />

      <EditMedicineModal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditingMedicine(null);
        }}
        medicine={editingMedicine}
        onSuccess={fetchMedicines}
      />
    </main>
  );
}

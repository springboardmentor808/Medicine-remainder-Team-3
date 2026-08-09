'use client';

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  RefreshCw,
  AlertTriangle,
  Calendar,
  Pill,
  MapPin,
  CheckCircle,
  Clock,
  TrendingDown,
  Navigation,
  ExternalLink,
  Edit,
  X,
} from 'lucide-react';

const API_BASE = 'http://localhost:8000/api/v1';

export default function RefillPage() {
  const [medicines, setMedicines] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Geolocation & Nearby Pharmacies
  const [coords, setCoords] = useState({ lat: null, lon: null });
  const [geoError, setGeoError] = useState('');
  const [pharmacies, setPharmacies] = useState([]);
  const [pharmacyLoading, setPharmacyLoading] = useState(false);

  // Quick Refill Modal State
  const [selectedMed, setSelectedMed] = useState(null);
  const [refillStockCount, setRefillStockCount] = useState(30);
  const [refillModalOpen, setRefillModalOpen] = useState(false);
  const [updatingStock, setUpdatingStock] = useState(false);

  // Fetch user medicines and AI refill predictions
  const fetchRefillData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Get user medicines list
      const medRes = await axios.get(`${API_BASE}/medicines/`);
      const medList = medRes.data.medicines || [];
      setMedicines(medList);

      // 2. Fetch refill predictions for each medicine
      const predMap = {};
      await Promise.all(
        medList.map(async (med) => {
          try {
            const predRes = await axios.get(`${API_BASE}/refill/predict/${med.id}`);
            predMap[med.id] = predRes.data;
          } catch (err) {
            console.error(`Failed refill prediction for ${med.id}:`, err);
          }
        })
      );
      setPredictions(predMap);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to load refill tracking data.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRefillData();
  }, [fetchRefillData]);

  // Request browser geolocation
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }

    setPharmacyLoading(true);
    setGeoError('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setCoords({ lat, lon });
        await fetchNearbyPharmacies(lat, lon);
      },
      (err) => {
        setPharmacyLoading(false);
        setGeoError('Location permission denied or unavailable. Click below for default coordinates.');
      }
    );
  };

  // Fetch nearby pharmacies from API
  const fetchNearbyPharmacies = async (lat, lon) => {
    setPharmacyLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/refill/nearby-pharmacies`, {
        params: { lat, lon, radius_km: 5.0, limit: 10 },
      });
      setPharmacies(res.data.pharmacies || []);
    } catch (err) {
      setGeoError('Failed to fetch nearby pharmacies from OpenStreetMap.');
    } finally {
      setPharmacyLoading(false);
    }
  };

  // Submit Quick Refill Stock Update
  const handleStockUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMed) return;

    setUpdatingStock(true);
    try {
      await axios.post(`${API_BASE}/refill/update-stock`, {
        medicine_id: selectedMed.id,
        total_pills_remaining: Number(refillStockCount),
        daily_dose_count: selectedMed.daily_frequency * selectedMed.quantity_per_dose,
        low_stock_threshold: 5,
      });

      setUpdatingStock(false);
      setRefillModalOpen(false);
      setSelectedMed(null);
      fetchRefillData();
    } catch (err) {
      setUpdatingStock(false);
      alert('Failed to update refill stock.');
    }
  };

  // Summary Metrics
  const lowStockCount = Object.values(predictions).filter((p) => p.is_low_stock).length;
  const imminentRefillsCount = Object.values(predictions).filter(
    (p) => p.days_remaining != null && p.days_remaining <= 7
  ).length;

  return (
    <main className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 rounded-xl border border-amber-500/30 text-amber-400">
            <TrendingDown className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-teal-400">
              Refill AI & Pharmacy Finder
            </h1>
            <p className="text-sm text-slate-400">Smart pill depletion predictions & location-based refill assistance</p>
          </div>
        </div>

        <button
          onClick={fetchRefillData}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Predictions
        </button>
      </header>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 bg-slate-900/60 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-teal-500/10 text-teal-400 rounded-xl">
            <Pill className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block">Total Tracked Medicines</span>
            <span className="text-xl font-bold text-slate-100">{medicines.length}</span>
          </div>
        </div>

        <div className="p-5 bg-slate-900/60 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block">Low Stock Warnings</span>
            <span className={`text-xl font-bold ${lowStockCount > 0 ? 'text-amber-400' : 'text-slate-100'}`}>
              {lowStockCount}
            </span>
          </div>
        </div>

        <div className="p-5 bg-slate-900/60 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block">Refills Needed Within 7 Days</span>
            <span className="text-xl font-bold text-indigo-300">{imminentRefillsCount}</span>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchRefillData} className="underline">
            Retry
          </button>
        </div>
      )}

      {/* Section 1: Refill Predictions List */}
      <section className="p-6 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-6">
        <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-400" /> AI Refill Schedule & Pill Stock Status
        </h2>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Calculating refill schedules...</div>
        ) : medicines.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">No medicines in inventory to calculate predictions.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {medicines.map((med) => {
              const pred = predictions[med.id];
              const isLow = pred?.is_low_stock || med.current_stock <= 5;
              const daysRemaining = pred?.days_remaining ?? med.days_until_empty;
              const estDate = pred?.estimated_refill_date;

              return (
                <div
                  key={med.id}
                  className={`p-5 rounded-2xl border transition flex flex-col justify-between space-y-4 ${
                    isLow
                      ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-slate-100">{med.name}</h3>
                        <span className="text-xs text-slate-400">{med.disease_category || 'General'}</span>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                          isLow
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {isLow ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        {isLow ? 'Low Stock Alert' : 'Sufficient Stock'}
                      </span>
                    </div>

                    {/* Stock Detail & Refill Dates */}
                    <div className="grid grid-cols-2 gap-3 text-xs pt-2">
                      <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-800">
                        <span className="text-slate-400 text-[10px] block">Pills Remaining</span>
                        <span className={`text-base font-bold ${isLow ? 'text-amber-400' : 'text-slate-100'}`}>
                          {med.current_stock} pills
                        </span>
                      </div>

                      <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-800">
                        <span className="text-slate-400 text-[10px] block">Estimated Refill Date</span>
                        <span className="text-xs font-bold text-teal-300 mt-1 block">
                          {estDate ? estDate : daysRemaining != null ? `In ~${daysRemaining} days` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Refill Button */}
                  <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                    <span className="text-[11px] text-slate-400">
                      Daily Consumption: <strong>{med.daily_frequency * med.quantity_per_dose}</strong> pills/day
                    </span>

                    <button
                      onClick={() => {
                        setSelectedMed(med);
                        setRefillStockCount(med.current_stock + 30);
                        setRefillModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold rounded-xl text-xs transition flex items-center gap-1.5"
                    >
                      <Edit className="w-3.5 h-3.5" /> Refill Stock
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 2: Nearby Pharmacies (OpenStreetMap) */}
      <section className="p-6 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-teal-400" /> OpenStreetMap Nearby Pharmacies
            </h2>
            <p className="text-xs text-slate-400">Locate pharmacies nearby using live GPS coordinates</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleGetLocation}
              disabled={pharmacyLoading}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-medium transition flex items-center gap-2 shadow-lg"
            >
              <Navigation className="w-4 h-4" /> Use Current Location
            </button>
            <button
              onClick={() => fetchNearbyPharmacies(28.6139, 77.2090)}
              disabled={pharmacyLoading}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
            >
              Default City
            </button>
          </div>
        </div>

        {geoError && <p className="text-xs text-amber-400 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">{geoError}</p>}

        {pharmacyLoading ? (
          <div className="py-12 text-center space-y-2">
            <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-400">Querying OpenStreetMap Overpass API for pharmacies...</p>
          </div>
        ) : pharmacies.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800/80">
            Click "Use Current Location" or "Default City" to load nearby pharmacies.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pharmacies.map((pharm, idx) => (
              <div key={idx} className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-semibold text-slate-200 text-xs">{pharm.name}</h4>
                    <span className="text-[10px] text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                      {pharm.distance_km} km
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{pharm.address || 'Address available via map link'}</p>
                </div>

                <a
                  href={`https://www.openstreetmap.org/?mlat=${pharm.latitude}&mlon=${pharm.longitude}#map=16/${pharm.latitude}/${pharm.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 text-[11px] text-teal-400 hover:text-teal-300 font-medium inline-flex items-center gap-1"
                >
                  View on Map <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick Refill Modal */}
      {refillModalOpen && selectedMed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-semibold text-slate-100 text-base">Refill Stock — {selectedMed.name}</h3>
              <button onClick={() => setRefillModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStockUpdateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">New Total Pill Count</label>
                <input
                  type="number"
                  min="1"
                  value={refillStockCount}
                  onChange={(e) => setRefillStockCount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRefillModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingStock}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl text-xs transition"
                >
                  {updatingStock ? 'Updating...' : 'Confirm Refill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

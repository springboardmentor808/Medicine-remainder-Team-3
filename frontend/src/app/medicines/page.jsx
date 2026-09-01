'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Toast from '@/components/ui/Toast';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import AddMedicineModal from '@/components/forms/AddMedicineModal';
import EditMedicineModal from '@/components/forms/EditMedicineModal';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { medicineAPI, exportAPI, patientAPI } from '@/lib/api';

const CATEGORIES = [
  'All',
  'General Healthcare',
  'Blood Pressure',
  'Diabetes',
  'Thyroid',
  'Antibiotics',
  'Vitamins',
  'Heart Medications',
];



function MedicinesPageInner() {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  // Filters & Views
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list' | 'grouped'

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedMed, setSelectedMed] = useState(null);

  // OCR Scan State
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrData, setOcrData] = useState(null);
  const fileInputRef = useRef(null);

  // Stock Quick-Update modal
  const [stockModalMed, setStockModalMed] = useState(null);
  const [newStockVal, setNewStockVal] = useState(30);
  const [updatingStock, setUpdatingStock] = useState(false);

  const [isDemoData, setIsDemoData] = useState(false);

  const fetchMedicines = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await medicineAPI.list();
      // Backend returns array directly or wrapped in .medicines / .items / .data
      const items = Array.isArray(res) ? res : (res?.medicines || res?.items || res?.data || []);
      setMedicines(Array.isArray(items) ? items : []);
      setIsDemoData(false);
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('401') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('credentials')) {
        setError('Session expired. Please log in again to view your medicines.');
      } else if (msg.toLowerCase().includes('cannot connect') || msg.toLowerCase().includes('network')) {
        setError('Cannot connect to the server. Please ensure the backend is running on port 8000.');
      } else {
        setError(msg || 'Failed to load medicines.');
      }
      setMedicines([]);
      setIsDemoData(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines]);

  // Auto-trigger scan when navigated with ?scan=1 (e.g. from dashboard "Scan Now")
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams?.get('scan') === '1' && fileInputRef.current) {
      // Short delay to ensure DOM is ready
      const timer = setTimeout(() => {
        fileInputRef.current?.click();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  // Safe list guard
  const medList = Array.isArray(medicines) ? medicines : [];

  // Filter logic
  const filteredMedicines = medList.filter((m) => {
    const matchesSearch =
      m.name?.toLowerCase().includes(search.toLowerCase()) ||
      m.disease_category?.toLowerCase().includes(search.toLowerCase()) ||
      m.notes?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategory === 'All' || m.disease_category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Grouped by disease category
  const groupedByCategory = filteredMedicines.reduce((acc, med) => {
    const cat = med.disease_category || 'General Healthcare';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(med);
    return acc;
  }, {});

  // Delete Medicine Handler
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove ${name}?`)) return;
    try {
      await medicineAPI.remove(id);
      setToast({ type: 'success', message: `${name} has been removed from inventory.` });
      fetchMedicines();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to delete medicine.' });
    }
  };

  // Quick Log Dose — routes through adherence record endpoint
  const handleLogDose = async (med) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const timeNow = new Date().toTimeString().slice(0, 5);
      await patientAPI.recordAction({
        medicine_id: med.id,
        scheduled_date: today,
        scheduled_time: timeNow,
        action: 'TAKEN',
      });
      setToast({ type: 'success', message: `Dose logged for ${med.name}!` });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to log dose.' });
    }
  };

  // Save Quick Stock Update
  const handleSaveStock = async (e) => {
    e.preventDefault();
    if (!stockModalMed) return;
    setUpdatingStock(true);
    try {
      await medicineAPI.updateStock(stockModalMed.id, Number(newStockVal));
      setToast({ type: 'success', message: `Stock updated for ${stockModalMed.name}!` });
      setStockModalMed(null);
      fetchMedicines();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to update stock.' });
    } finally {
      setUpdatingStock(false);
    }
  };

  // OCR File / Camera Handler
  const handleOcrFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrScanning(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await medicineAPI.ocrScan(formData);
      const data = res?.data || res;
      setOcrData(data);
      setIsAddOpen(true);
      setToast({
        type: 'success',
        message: data?.medicine_name
          ? `Prescription scanned: Detected ${data.medicine_name} (${data.dosage || ''})`
          : 'Prescription scanned! Please review details.',
      });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'OCR Scan failed.' });
    } finally {
      setOcrScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Stats calculation
  const totalCount = medicines.length;
  const lowStockCount = medicines.filter((m) => m.current_stock <= 5).length;
  const categoriesCount = Object.keys(
    medicines.reduce((a, b) => ({ ...a, [b.disease_category || 'General']: true }), {})
  ).length;

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Toast Notification */}
        {toast && (
          <Toast
            type={toast.type}
            message={toast.message}
            onClose={() => setToast(null)}
          />
        )}

        {/* Demo Mode / Offline Catalog Notice */}
        {isDemoData && (
          <div className="flex items-center justify-between gap-3 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-amber-600 dark:text-amber-400">
                cloud_off
              </span>
              <span>
                <strong>Offline Preview Mode:</strong> Showing offline sample medication catalog. Live synchronization will resume once the server is reached.
              </span>
            </div>
            <button
              onClick={fetchMedicines}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold transition-colors flex-shrink-0"
            >
              Retry Sync
            </button>
          </div>
        )}

        {/* Hidden Camera/File Input for Prescription OCR */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleOcrFileChange}
          className="hidden"
          id="prescription-camera-input"
        />

        {/* Header Banner */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container-low p-6 rounded-2xl border border-outline-variant/30 shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                pill
              </span>
              <h1 className="text-headline-md font-bold text-on-surface">Medication Cabinet</h1>
            </div>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Manage your prescriptions, dosage schedules, disease groupings, and inventory stock.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Scan Prescription Button (Camera / File) */}
            <Button
              variant="tonal"
              onClick={() => fileInputRef.current?.click()}
              loading={ocrScanning}
              leftIcon={<span className="material-symbols-outlined text-[20px]">photo_camera</span>}
            >
              Scan Prescription
            </Button>

            {/* Download Group */}
            <div className="flex items-center gap-1 border border-outline-variant/40 rounded-lg px-1 py-0.5 bg-surface-container-lowest">
              <span className="text-label-caps text-on-surface-variant px-1.5">Download:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => exportAPI.medicinesPDF()}
                leftIcon={<span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>}
                title="Download styled PDF document"
              >
                PDF
              </Button>
              <div className="w-px h-5 bg-outline-variant/40" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => exportAPI.medicinesCSV()}
                leftIcon={<span className="material-symbols-outlined text-[18px]">download</span>}
                title="Download CSV spreadsheet"
              >
                CSV
              </Button>
            </div>

            {/* Add Medicine Button */}
            <Button
              onClick={() => {
                setOcrData(null);
                setIsAddOpen(true);
              }}
              leftIcon={<span className="material-symbols-outlined text-[20px]">add</span>}
            >
              Add Medicine
            </Button>
          </div>
        </header>

      {/* Overview Metric Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card variant="filled" className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">medication</span>
          </div>
          <div>
            <p className="text-caption text-on-surface-variant uppercase font-semibold tracking-wider">Total Medicines</p>
            <p className="text-headline-md font-bold text-on-surface">{totalCount}</p>
          </div>
        </Card>

        <Card variant="filled" className="p-4 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${lowStockCount > 0 ? 'bg-error-container text-error' : 'bg-success/10 text-success'}`}>
            <span className="material-symbols-outlined text-[24px]">warning</span>
          </div>
          <div>
            <p className="text-caption text-on-surface-variant uppercase font-semibold tracking-wider">Low Stock Items</p>
            <p className="text-headline-md font-bold text-on-surface">{lowStockCount}</p>
          </div>
        </Card>

        <Card variant="filled" className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">category</span>
          </div>
          <div>
            <p className="text-caption text-on-surface-variant uppercase font-semibold tracking-wider">Disease Categories</p>
            <p className="text-headline-md font-bold text-on-surface">{categoriesCount}</p>
          </div>
        </Card>
      </section>

      {/* Search, Filter Bar & View Toggle */}
      <section className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/30 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search medicine name, category or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<span className="material-symbols-outlined text-[20px]">search</span>}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Category Dropdown Filter */}
          <div className="flex items-center gap-2">
            <span className="text-caption text-on-surface-variant font-medium">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-[40px] px-3 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center p-1 bg-surface-container-low rounded-lg border border-outline-variant/40">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-surface-container-lowest text-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}`}
              title="Grid View"
            >
              <span className="material-symbols-outlined text-[20px]">grid_view</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-surface-container-lowest text-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}`}
              title="List View"
            >
              <span className="material-symbols-outlined text-[20px]">view_list</span>
            </button>
            <button
              onClick={() => setViewMode('grouped')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grouped' ? 'bg-surface-container-lowest text-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}`}
              title="Grouped by Disease"
            >
              <span className="material-symbols-outlined text-[20px]">folder_special</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      {loading ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-body-sm text-on-surface-variant">Loading your medication inventory...</p>
        </div>
      ) : error ? (
        <ErrorMessage
          title="Error loading medication inventory"
          message={error}
          onRetry={fetchMedicines}
          onDismiss={() => setError('')}
        />
      ) : filteredMedicines.length === 0 ? (
        <EmptyState
          icon="medication"
          title="No medicines found"
          description={
            search || selectedCategory !== 'All'
              ? 'No items match your search filters. Try clearing or changing filters.'
              : 'Your cabinet is empty. Add your first prescription to start tracking dosages and reminders.'
          }
          actionLabel="Add Medicine Now"
          onAction={() => setIsAddOpen(true)}
        />
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMedicines.map((med) => (
            <Card key={med.id} variant="elevated" hoverEffect className="p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-title-lg font-bold text-on-surface">{med.name}</h3>
                    <p className="text-body-sm text-primary font-medium">{med.dosage}</p>
                  </div>
                  <Badge variant={med.current_stock <= 5 ? 'error' : 'success'}>
                    {med.current_stock <= 5 ? 'Low Stock' : 'In Stock'}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Badge variant="neutral">{med.disease_category || 'General'}</Badge>
                  <span className="text-caption text-on-surface-variant">
                    {med.daily_frequency}x daily ({med.quantity_per_dose} unit/dose)
                  </span>
                </div>

                {med.notes && (
                  <p className="text-caption text-on-surface-variant bg-surface-container-low p-2 rounded-lg italic">
                    &quot;{med.notes}&quot;
                  </p>
                )}
              </div>

              {/* Stock Bar & Actions */}
              <div className="space-y-3 pt-2 border-t border-outline-variant/30">
                <div className="flex items-center justify-between text-caption font-semibold">
                  <span className="text-on-surface-variant">Remaining Stock:</span>
                  <span className={med.current_stock <= 5 ? 'text-error font-bold' : 'text-on-surface'}>
                    {med.current_stock} units
                  </span>
                </div>

                <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${med.current_stock <= 5 ? 'bg-error' : 'bg-primary'}`}
                    style={{ width: `${Math.min(100, (med.current_stock / (med.initial_quantity || 30)) * 100)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLogDose(med)}
                      title="Log taken dose"
                    >
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setStockModalMed(med);
                        setNewStockVal(med.current_stock);
                      }}
                      title="Adjust Stock"
                    >
                      <span className="material-symbols-outlined text-[18px]">inventory</span>
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedMed(med);
                        setIsEditOpen(true);
                      }}
                      title="Edit details"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(med.id, med.name)}
                      className="text-error hover:bg-error-container/20"
                      title="Delete medicine"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : viewMode === 'list' ? (
        /* LIST VIEW */
        <Card variant="outlined" className="divide-y divide-outline-variant/30 overflow-hidden">
          {filteredMedicines.map((med) => (
            <div key={med.id} className="p-4 hover:bg-surface-container-low transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[20px]">pill</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-title-md font-bold text-on-surface">{med.name}</h4>
                    <Badge variant={med.current_stock <= 5 ? 'error' : 'success'}>
                      {med.current_stock} left
                    </Badge>
                  </div>
                  <p className="text-body-sm text-on-surface-variant">
                    {med.dosage} • {med.disease_category || 'General'} • {med.daily_frequency}x daily
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <Button variant="outlined" size="sm" onClick={() => handleLogDose(med)}>
                  Log Dose
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedMed(med);
                    setIsEditOpen(true);
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(med.id, med.name)}
                  className="text-error"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </Card>
      ) : (
        /* GROUPED BY DISEASE VIEW */
        <div className="space-y-6">
          {Object.entries(groupedByCategory).map(([category, items]) => (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-outline-variant/40">
                <span className="material-symbols-outlined text-primary text-[22px]">folder</span>
                <h3 className="text-headline-sm font-bold text-on-surface">{category}</h3>
                <Badge variant="neutral">{items.length} items</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((med) => (
                  <Card key={med.id} variant="filled" className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-title-md font-bold text-on-surface">{med.name}</h4>
                        <p className="text-caption text-primary font-medium">{med.dosage}</p>
                      </div>
                      <Badge variant={med.current_stock <= 5 ? 'error' : 'success'}>
                        {med.current_stock} left
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-outline-variant/30 text-caption">
                      <span>Schedule: {med.daily_frequency}x/day</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setSelectedMed(med);
                            setIsEditOpen(true);
                          }}
                          className="text-primary hover:underline"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add & Edit Modals */}
      <AddMedicineModal
        isOpen={isAddOpen}
        initialData={ocrData}
        onClose={() => {
          setIsAddOpen(false);
          setOcrData(null);
        }}
        onSuccess={(newMed) => {
          setToast({ type: 'success', message: 'Medicine added successfully!' });
          if (newMed) {
            setMedicines((prev) => [newMed, ...(Array.isArray(prev) ? prev : [])]);
          }
          fetchMedicines();
        }}
      />

      <EditMedicineModal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedMed(null);
        }}
        medicine={selectedMed}
        onSuccess={() => {
          setToast({ type: 'success', message: 'Medicine updated successfully!' });
          fetchMedicines();
        }}
      />

      {/* Quick Stock Modal */}
      {stockModalMed && (
        <div className="fixed inset-0 z-50 bg-scrim/40 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl max-w-sm w-full p-6 space-y-4 shadow-modal border border-outline-variant/30">
            <h3 className="text-headline-sm font-bold text-on-surface">Update Stock Quantity</h3>
            <p className="text-body-sm text-on-surface-variant">
              Set new stock count for <strong>{stockModalMed.name}</strong>.
            </p>
            <form onSubmit={handleSaveStock} className="space-y-4">
              <Input
                label="Current Units Count"
                type="number"
                min={0}
                value={newStockVal}
                onChange={(e) => setNewStockVal(e.target.value)}
                required
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setStockModalMed(null)}>
                  Cancel
                </Button>
                <Button type="submit" loading={updatingStock}>
                  Save Stock
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </DashboardLayout>
  );
}

export default function MedicinesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-on-surface-variant">Loading...</div>}>
      <MedicinesPageInner />
    </Suspense>
  );
}

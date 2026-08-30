'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Toast from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { medicineAPI, refillAPI } from '@/lib/api';

const DEFAULT_FALLBACK_MEDS = [
  { id: 'med-1', name: 'Amlodipine 5mg', current_stock: 4, total_stock: 30, disease_category: 'Blood Pressure', prescribing_doctor: 'Dr. Sarah Jenkins' },
  { id: 'med-4', name: 'Levothyroxine 50mcg', current_stock: 18, total_stock: 30, disease_category: 'Thyroid', prescribing_doctor: 'Dr. Elena Rostova' },
  { id: 'med-2', name: 'Lisinopril 10mg', current_stock: 22, total_stock: 30, disease_category: 'Blood Pressure', prescribing_doctor: 'Dr. Sarah Jenkins' },
];

export default function RefillPage() {
  const [medicines, setMedicines] = useState(DEFAULT_FALLBACK_MEDS);
  const [loadingMeds, setLoadingMeds] = useState(true);
  const [toast, setToast] = useState(null);

  // Pharmacy Discovery State
  const [pharmacies, setPharmacies] = useState([]);
  const [pharmacyLoading, setPharmacyLoading] = useState(false);
  const [pharmacyError, setPharmacyError] = useState('');
  const [searchRadius, setSearchRadius] = useState(5); // 5km
  const [userCoords, setUserCoords] = useState({ lat: 28.6139, lng: 77.209 }); // Default New Delhi

  // Quick Refill Modal
  const [selectedMedForRefill, setSelectedMedForRefill] = useState(null);
  const [refillQuantity, setRefillQuantity] = useState(30);
  const [selectedPharmacy, setSelectedPharmacy] = useState('');
  const [submittingRefill, setSubmittingRefill] = useState(false);

  const fetchLowStockMedicines = useCallback(async () => {
    setLoadingMeds(true);
    try {
      const res = await medicineAPI.list();
      const items = res.data?.items || res.data;
      if (Array.isArray(items) && items.length > 0) {
        setMedicines(items);
      } else {
        setMedicines(DEFAULT_FALLBACK_MEDS);
      }
    } catch (err) {
      setMedicines(DEFAULT_FALLBACK_MEDS);
    } finally {
      setLoadingMeds(false);
    }
  }, []);

  const fetchNearbyPharmacies = useCallback(async (lat, lng, radius) => {
    setPharmacyLoading(true);
    setPharmacyError('');
    try {
      const res = await refillAPI.nearbyPharmacies({
        lat: lat || userCoords.lat,
        lng: lng || userCoords.lng,
        radius_km: radius || searchRadius,
      });
      const data = res.data?.pharmacies || res.data || [];
      setPharmacies(data);
    } catch (err) {
      setPharmacyError(err.message || 'Failed to locate nearby pharmacies.');
    } finally {
      setPharmacyLoading(false);
    }
  }, [userCoords, searchRadius]);

  useEffect(() => {
    fetchLowStockMedicines();

    // Try to get user location
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserCoords(newCoords);
          fetchNearbyPharmacies(newCoords.lat, newCoords.lng, searchRadius);
        },
        () => {
          // Default location fallback
          fetchNearbyPharmacies(28.6139, 77.209, searchRadius);
        }
      );
    } else {
      fetchNearbyPharmacies(28.6139, 77.209, searchRadius);
    }
  }, [fetchLowStockMedicines, fetchNearbyPharmacies, searchRadius]);

  // Refill request submit
  const handleRefillSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMedForRefill) return;

    setSubmittingRefill(true);
    try {
      await refillAPI.requestRefill({
        medicine_id: selectedMedForRefill.id,
        pharmacy_id: selectedPharmacy || null,
        quantity: Number(refillQuantity),
      });

      // Update local stock directly
      await medicineAPI.update(selectedMedForRefill.id, {
        current_stock: selectedMedForRefill.current_stock + Number(refillQuantity),
      });

      setToast({
        type: 'success',
        message: `Refill request submitted for ${selectedMedForRefill.name}! Stock increased by ${refillQuantity}.`,
      });
      setSelectedMedForRefill(null);
      fetchLowStockMedicines();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to submit refill order.' });
    } finally {
      setSubmittingRefill(false);
    }
  };

  // Filter low stock (< 10 units) and critical (< 5 units)
  const lowStockMeds = medicines.filter((m) => m.current_stock <= 10);
  const criticalMeds = medicines.filter((m) => m.current_stock <= 3);

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-low p-6 rounded-2xl border border-outline-variant/30 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              local_pharmacy
            </span>
            <h1 className="text-headline-md font-bold text-on-surface">Refill Tracker & Pharmacies</h1>
          </div>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Predictive stock depletion alerts and OpenStreetMap nearby pharmacy discovery.
          </p>
        </div>
      </header>

      {/* Critical Stock Alert Banner */}
      {criticalMeds.length > 0 && (
        <div className="bg-error-container/40 border border-error/40 p-4 rounded-xl flex items-start gap-3">
          <span className="material-symbols-outlined text-error text-[24px] shrink-0 mt-0.5">warning</span>
          <div>
            <h4 className="text-title-md font-bold text-error">Critical Stock Warning!</h4>
            <p className="text-body-sm text-on-surface-variant">
              You have {criticalMeds.length} medicine(s) with less than 3 doses remaining (
              {criticalMeds.map((m) => m.name).join(', ')}). Order refills immediately.
            </p>
          </div>
        </div>
      )}

      {/* Low Stock Items Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-headline-sm font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">inventory_2</span>
            Medicines Requiring Refill
          </h2>
          <Badge variant="neutral">{lowStockMeds.length} Items</Badge>
        </div>

        {loadingMeds ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-body-sm text-on-surface-variant">Checking inventory levels...</p>
          </div>
        ) : lowStockMeds.length === 0 ? (
          <Card variant="outlined" className="p-8 text-center bg-surface-container-lowest">
            <span className="material-symbols-outlined text-success text-[40px] mb-2">check_circle</span>
            <h3 className="text-title-lg font-bold text-on-surface">All Stock Levels Healthy!</h3>
            <p className="text-body-sm text-on-surface-variant max-w-md mx-auto mt-1">
              None of your medications are running low right now. We will notify you automatically when stock drops below 10 units.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lowStockMeds.map((med) => {
              const dailyConsumption = (med.daily_frequency || 1) * (med.quantity_per_dose || 1);
              const daysLeft = Math.floor(med.current_stock / dailyConsumption);

              return (
                <Card
                  key={med.id}
                  variant="elevated"
                  className={`p-5 space-y-4 border-l-4 ${med.current_stock <= 5 ? 'border-l-error' : 'border-l-warning'}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-title-lg font-bold text-on-surface">{med.name}</h3>
                      <p className="text-body-sm text-on-surface-variant">{med.dosage}</p>
                    </div>
                    <Badge variant={med.current_stock <= 5 ? 'error' : 'warning'}>
                      {daysLeft <= 0 ? 'Depleted' : `${daysLeft} days left`}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-caption font-semibold">
                      <span className="text-on-surface-variant">Current Stock:</span>
                      <span className="text-on-surface">{med.current_stock} units</span>
                    </div>
                    <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${med.current_stock <= 5 ? 'bg-error' : 'bg-warning'}`}
                        style={{ width: `${Math.min(100, (med.current_stock / 30) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <Button
                    fullWidth
                    size="sm"
                    onClick={() => {
                      setSelectedMedForRefill(med);
                      setRefillQuantity(30);
                    }}
                    leftIcon={<span className="material-symbols-outlined text-[18px]">shopping_cart</span>}
                  >
                    Request Refill Order
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Nearby Pharmacy Discovery Section */}
      <section className="space-y-4 pt-6 border-t border-outline-variant/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-headline-sm font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">distance</span>
              Nearby Pharmacies (OpenStreetMap)
            </h2>
            <p className="text-body-sm text-on-surface-variant">
              Find licensed chemists and pharmacies within your vicinity.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-caption font-medium text-on-surface-variant">Radius:</span>
            <select
              value={searchRadius}
              onChange={(e) => setSearchRadius(Number(e.target.value))}
              className="h-[38px] px-3 rounded-lg bg-surface-container-low border border-outline-variant text-body-sm font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value={1}>1 km</option>
              <option value={2}>2 km</option>
              <option value={5}>5 km</option>
              <option value={10}>10 km</option>
              <option value={25}>25 km</option>
              <option value={50}>50 km</option>
            </select>

            <Button
              variant="outlined"
              size="sm"
              onClick={() => fetchNearbyPharmacies(userCoords.lat, userCoords.lng, searchRadius)}
              leftIcon={<span className="material-symbols-outlined text-[18px]">refresh</span>}
            >
              Refresh
            </Button>
          </div>
        </div>

        {pharmacyLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-body-sm text-on-surface-variant">Scanning OpenStreetMap for nearby chemists...</p>
          </div>
        ) : pharmacyError ? (
          <ErrorMessage
            title="Unable to locate pharmacies"
            message={pharmacyError}
            onRetry={() => fetchNearbyPharmacies(userCoords.lat, userCoords.lng, searchRadius)}
            onDismiss={() => setPharmacyError('')}
          />
        ) : pharmacies.length === 0 ? (
          <EmptyState
            icon="storefront"
            title="No Pharmacies Found"
            description={`No pharmacies detected within ${searchRadius}km radius. Try expanding your search radius above.`}
            secondaryLabel="Expand to 15km"
            onSecondary={() => {
              setSearchRadius(15);
              fetchNearbyPharmacies(userCoords.lat, userCoords.lng, 15);
            }}
            className="py-8"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pharmacies.map((p, idx) => (
              <Card key={idx} variant="outlined" className="p-4 space-y-3 hover:bg-surface-container-low transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-primary text-[22px] shrink-0 mt-0.5">
                      local_pharmacy
                    </span>
                    <div>
                      <h4 className="text-title-md font-bold text-on-surface">{p.name || 'Local Pharmacy'}</h4>
                      <p className="text-caption text-on-surface-variant line-clamp-2">
                        {p.address || p.city || 'Address not listed'}
                      </p>
                    </div>
                  </div>
                  {p.distance_km && (
                    <Badge variant="neutral" className="shrink-0">
                      {p.distance_km} km
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between text-caption border-t border-outline-variant/30 pt-2">
                  <span className="text-success font-medium flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-success" /> Open Now
                  </span>

                  {p.lat && p.lng && (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=16/${p.lat}/${p.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-semibold inline-flex items-center gap-1"
                    >
                      <span>Directions</span>
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Refill Order Modal */}
      {selectedMedForRefill && (
        <Modal
          isOpen={Boolean(selectedMedForRefill)}
          onClose={() => setSelectedMedForRefill(null)}
          title={`Request Refill: ${selectedMedForRefill.name}`}
          description="Specify refill quantity and select preferred pharmacy for fulfillment."
        >
          <form onSubmit={handleRefillSubmit} className="space-y-4 pt-2">
            <Input
              label="Refill Quantity (Units)"
              type="number"
              min={1}
              value={refillQuantity}
              onChange={(e) => setRefillQuantity(e.target.value)}
              required
            />

            <div>
              <label className="block text-body-sm font-semibold text-on-surface mb-1">
                Select Preferred Pharmacy (Optional)
              </label>
              <select
                value={selectedPharmacy}
                onChange={(e) => setSelectedPharmacy(e.target.value)}
                className="w-full h-[44px] px-3 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">-- Nearest Pharmacy --</option>
                {pharmacies.map((p, i) => (
                  <option key={i} value={p.name}>
                    {p.name} ({p.distance_km ? `${p.distance_km}km` : 'Nearby'})
                  </option>
                ))}
              </select>
            </div>

            <Modal.Footer>
              <Button type="button" variant="ghost" onClick={() => setSelectedMedForRefill(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={submittingRefill}>
                Confirm Order Refill
              </Button>
            </Modal.Footer>
          </form>
        </Modal>
      )}
      </div>
    </DashboardLayout>
  );
}

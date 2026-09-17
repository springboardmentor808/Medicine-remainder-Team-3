'use client';

/**
 * PillSync — Interactive Leaflet.js Pharmacy Locator Map
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Real-time geospatial map canvas displaying detected pharmacies & dispensaries.
 * 
 * Features:
 *   - Leaflet.js Canvas with OpenStreetMap vector tiles (mounted once)
 *   - HTML-sanitized popups preventing XSS injection
 *   - Valid zero-coordinate support (0.0 lat/lng)
 *   - Blue pulsing animated user origin marker with search perimeter circle
 *   - Custom emerald medical-cross pin markers for detected pharmacies
 *   - Interactive popups with name, address, live distance, and navigation links
 *   - Smooth flyTo animations on selection without recreating the map
 *   - Controlled selection synchronization on card close
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Navigation, ExternalLink, Building2, Compass, Phone, Clock } from 'lucide-react';
import Button from '@/components/ui/Button';

// Sanitization utility to prevent HTML injection in Leaflet popup template strings
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default function PharmacyMapView({
  userCoords = { lat: 25.3845, lng: 82.9569 },
  locationName = 'Varanasi, Uttar Pradesh',
  pharmacies = [],
  selectedPharmacy = null,
  onSelectPharmacy = () => {},
  searchRadius = 5,
}) {
  const [mounted, setMounted] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [activePin, setActivePin] = useState(null);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const userLayerRef = useRef(null);
  const leafletRef = useRef(null);

  // Accept valid coordinates including zero
  const userLatRaw = userCoords?.lat ?? userCoords?.latitude;
  const userLngRaw = userCoords?.lng ?? userCoords?.longitude;
  const lat = (userLatRaw !== null && userLatRaw !== undefined && !isNaN(Number(userLatRaw)))
    ? Number(userLatRaw)
    : 25.3845;
  const lng = (userLngRaw !== null && userLngRaw !== undefined && !isNaN(Number(userLngRaw)))
    ? Number(userLngRaw)
    : 82.9569;

  // Client hydration check
  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize Leaflet Map ONCE on mount (Do not recreate on selection change)
  useEffect(() => {
    if (!mounted || !mapContainerRef.current) return;

    let isCancelled = false;

    const initMap = async () => {
      try {
        const L = (await import('leaflet')).default || (await import('leaflet'));
        if (isCancelled || !mapContainerRef.current) return;
        leafletRef.current = L;

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const map = L.map(mapContainerRef.current, {
          center: [lat, lng],
          zoom: 14,
          zoomControl: false,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        userLayerRef.current = L.layerGroup().addTo(map);
        markersLayerRef.current = L.layerGroup().addTo(map);
        mapInstanceRef.current = map;
        setMapReady(true);
      } catch (err) {
        console.error('[PharmacyMapView] Failed to initialize Leaflet canvas:', err);
      }
    };

    initMap();

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Helper: Render User Marker + Radius Circle
  const renderUserMarker = useCallback((L, layer, map) => {
    if (!layer || !map) return;
    layer.clearLayers();

    // Pulsing blue user location marker
    const userIcon = L.divIcon({
      className: 'custom-user-marker',
      html: `
        <div class="relative flex items-center justify-center w-8 h-8">
          <span class="absolute w-8 h-8 rounded-full bg-blue-500/30 animate-ping"></span>
          <span class="relative w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-md"></span>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
    });

    const userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(layer);
    userMarker.bindPopup(`
      <div style="font-family: inherit; font-size: 12px; padding: 4px; min-width: 150px;">
        <div style="font-weight: 700; color: #0f172a;">📍 Search Origin</div>
        <div style="color: #64748b; margin-top: 2px;">${escapeHtml(locationName || 'Current Location')}</div>
        <div style="color: #2563eb; font-weight: 600; margin-top: 4px;">GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
      </div>
    `);

    // Radius circle showing search boundary
    const radiusMeters = (searchRadius || 5) * 1000;
    L.circle([lat, lng], {
      radius: radiusMeters,
      color: '#3b82f6',
      fillColor: '#60a5fa',
      fillOpacity: 0.08,
      weight: 1.5,
      dashArray: '4, 4',
    }).addTo(layer);
  }, [lat, lng, locationName, searchRadius]);

  // Helper: Render Pharmacy Pins (Independent of active selection to prevent re-creation)
  const renderPharmacyMarkers = useCallback((L, layer, map) => {
    if (!layer || !map) return;
    layer.clearLayers();

    if (!pharmacies || pharmacies.length === 0) return;

    const bounds = L.latLngBounds([[lat, lng]]);

    pharmacies.forEach((p) => {
      // Accept valid 0.0 coordinates
      const rawLat = p.latitude ?? p.lat;
      const rawLng = p.longitude ?? p.lng;
      if (rawLat === null || rawLat === undefined || rawLng === null || rawLng === undefined) return;
      const pLat = Number(rawLat);
      const pLng = Number(rawLng);
      if (isNaN(pLat) || isNaN(pLng)) return;

      bounds.extend([pLat, pLng]);

      // Green Medical Cross Pin
      const pharmacyIcon = L.divIcon({
        className: 'custom-pharmacy-pin',
        html: `
          <div class="relative group cursor-pointer transition-transform duration-200 hover:scale-110">
            <div class="w-8 h-8 rounded-full bg-emerald-600 border-2 border-white text-white flex items-center justify-center shadow-lg">
              <svg style="width: 16px; height: 16px; fill: white;" viewBox="0 0 24 24">
                <path d="M19 10.5h-5.5V5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v5.5H5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.5V19c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-5.5H19c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16],
      });

      const marker = L.marker([pLat, pLng], { icon: pharmacyIcon }).addTo(layer);

      const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pLat)},${encodeURIComponent(pLng)}`;

      // Safe HTML-escaped popup content
      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; padding: 4px; max-width: 220px;">
          <div style="font-weight: 700; font-size: 13px; color: #0f172a;">${escapeHtml(p.name || 'Pharmacy / Chemist')}</div>
          <div style="color: #64748b; margin-top: 3px;">${escapeHtml(p.address || p.city || 'Nearby your location')}</div>
          ${p.distance_km !== null && p.distance_km !== undefined ? `<div style="color: #059669; font-weight: 700; margin-top: 4px;">📍 ${escapeHtml(p.distance_km)} km away</div>` : ''}
          ${p.phone ? `<div style="color: #475569; margin-top: 2px;">📞 ${escapeHtml(p.phone)}</div>` : ''}
          <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between;">
            <a href="${navUrl}" target="_blank" rel="noopener noreferrer" style="color: #059669; font-weight: 600; text-decoration: underline;">
              Get Directions ↗
            </a>
          </div>
        </div>
      `);

      marker.on('click', () => {
        setActivePin(p);
        onSelectPharmacy?.(p);
      });
    });

    if (pharmacies.length > 0 && map) {
      map.fitBounds(bounds.pad(0.15));
    }
  }, [lat, lng, pharmacies, onSelectPharmacy]);

  // Update user marker when userCoords or searchRadius change
  useEffect(() => {
    if (!mapReady || !leafletRef.current || !mapInstanceRef.current || !userLayerRef.current) return;
    renderUserMarker(leafletRef.current, userLayerRef.current, mapInstanceRef.current);
  }, [mapReady, renderUserMarker]);

  // Update pharmacy markers when pharmacy data changes
  useEffect(() => {
    if (!mapReady || !leafletRef.current || !mapInstanceRef.current || !markersLayerRef.current) return;
    renderPharmacyMarkers(leafletRef.current, markersLayerRef.current, mapInstanceRef.current);
  }, [mapReady, renderPharmacyMarkers]);

  // Fly to selected pharmacy when chosen without recreating the map
  useEffect(() => {
    const target = selectedPharmacy || activePin;
    if (!target || !mapInstanceRef.current) return;
    const rawLat = target.latitude ?? target.lat;
    const rawLng = target.longitude ?? target.lng;
    if (rawLat === null || rawLat === undefined || rawLng === null || rawLng === undefined) return;
    const pLat = Number(rawLat);
    const pLng = Number(rawLng);
    if (!isNaN(pLat) && !isNaN(pLng)) {
      mapInstanceRef.current.flyTo([pLat, pLng], 16, { duration: 1.0 });
    }
  }, [selectedPharmacy, activePin]);

  if (!mounted) {
    return (
      <div className="w-full h-80 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-center">
        <div className="flex items-center gap-2 text-on-surface-variant text-body-sm">
          <Compass className="w-5 h-5 animate-spin text-primary" />
          <span>Initializing Leaflet Geospatial Canvas...</span>
        </div>
      </div>
    );
  }

  const currentSelection = activePin || selectedPharmacy;

  return (
    <div className="w-full space-y-4">
      {/* Map Frame Container */}
      <div className="relative w-full h-[360px] sm:h-[440px] rounded-2xl overflow-hidden border border-outline-variant/40 shadow-sm bg-surface-container-low">
        {/* Leaflet Canvas Mount */}
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Map Header Overlay */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
          <div className="bg-surface/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-outline-variant/50 shadow-sm pointer-events-auto flex items-center gap-2 text-xs font-semibold text-on-surface">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <span>📍 {locationName ? `${escapeHtml(locationName)} • ` : ''}GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)} ({searchRadius}km radius)</span>
          </div>

          <a
            href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=14/${lat}/${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-surface/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-outline-variant/50 shadow-sm pointer-events-auto flex items-center gap-1.5 text-xs font-semibold text-primary hover:bg-surface transition-colors"
          >
            <span>Open in OSM</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Selected Pharmacy Quick Card Overlay */}
        {currentSelection && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-sm bg-surface/95 dark:bg-slate-900/95 backdrop-blur-md p-3.5 rounded-xl border border-outline-variant/50 shadow-lg pointer-events-auto space-y-2 z-10 animate-fadeIn">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <Building2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-body-sm font-bold text-on-surface">
                    {currentSelection.name || 'Selected Pharmacy'}
                  </h4>
                  <p className="text-[11px] text-on-surface-variant line-clamp-1">
                    {currentSelection.address || currentSelection.city || 'Near your location'}
                  </p>
                </div>
              </div>
              {/* Clear both local activePin and controlled parent selection */}
              <button
                onClick={() => {
                  setActivePin(null);
                  onSelectPharmacy?.(null);
                }}
                className="text-on-surface-variant hover:text-on-surface text-xs font-bold px-1"
                aria-label="Close details"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-outline-variant/30 text-xs">
              <span className="text-emerald-600 font-semibold">
                {currentSelection.distance_km !== null && currentSelection.distance_km !== undefined ? `${currentSelection.distance_km} km away` : 'Nearby'}
              </span>
              <div className="flex items-center gap-2">
                {(() => {
                  const rawTargetLat = currentSelection.latitude ?? currentSelection.lat;
                  const rawTargetLng = currentSelection.longitude ?? currentSelection.lng;
                  if (rawTargetLat === null || rawTargetLat === undefined || rawTargetLng === null || rawTargetLng === undefined) return null;
                  const pLat = Number(rawTargetLat);
                  const pLng = Number(rawTargetLng);
                  if (isNaN(pLat) || isNaN(pLng)) return null;
                  return (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pLat)},${encodeURIComponent(pLng)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Directions</span>
                    </a>
                  );
                })()}
                <Button
                  size="xs"
                  variant="primary"
                  onClick={() => onSelectPharmacy(currentSelection)}
                >
                  Select for Refill
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pharmacy Pins Pill Bar */}
      {pharmacies.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-on-surface-variant font-medium shrink-0 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            Detected {pharmacies.length} Chemists:
          </span>
          {pharmacies.map((p, i) => {
            const isSelected = (activePin?.name === p.name || selectedPharmacy?.name === p.name);
            return (
              <button
                key={i}
                onClick={() => {
                  setActivePin(p);
                  onSelectPharmacy(p);
                }}
                className={`px-2.5 py-1 rounded-lg border text-left whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#164234] text-white border-[#164234] font-semibold shadow-xs'
                    : 'bg-surface-container-low text-on-surface hover:bg-surface-container border-outline-variant/50'
                }`}
              >
                <span>{p.name || `Pharmacy #${i + 1}`}</span>
                {p.distance_km !== null && p.distance_km !== undefined && (
                  <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-on-surface-variant'}`}>
                    ({p.distance_km}km)
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, ExternalLink, Building2, Compass } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

export default function PharmacyMapView({
  userCoords = { lat: 28.6139, lng: 77.2090 },
  pharmacies = [],
  selectedPharmacy = null,
  onSelectPharmacy = () => {},
  searchRadius = 5,
}) {
  const [mounted, setMounted] = useState(false);
  const [activePin, setActivePin] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-80 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-center">
        <div className="flex items-center gap-2 text-on-surface-variant text-body-sm">
          <Compass className="w-5 h-5 animate-spin text-primary" />
          <span>Loading OpenStreetMap View...</span>
        </div>
      </div>
    );
  }

  const lat = userCoords?.lat || 28.6139;
  const lng = userCoords?.lng || 77.2090;

  // Compute bbox for OpenStreetMap embed based on search radius
  const delta = (searchRadius || 5) / 111.0;
  const minLat = (lat - delta).toFixed(4);
  const maxLat = (lat + delta).toFixed(4);
  const minLng = (lng - delta).toFixed(4);
  const maxLng = (lng + delta).toFixed(4);

  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${lat}%2C${lng}`;

  return (
    <div className="w-full space-y-4">
      {/* Map Frame Container */}
      <div className="relative w-full h-[360px] sm:h-[420px] rounded-2xl overflow-hidden border border-outline-variant/40 shadow-sm bg-surface-container-low">
        {/* OpenStreetMap Iframe */}
        <iframe
          title="OpenStreetMap Pharmacy Map"
          className="w-full h-full border-0"
          loading="lazy"
          src={osmEmbedUrl}
        />

        {/* Map Header Overlay */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <div className="bg-surface/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-outline-variant/50 shadow-sm pointer-events-auto flex items-center gap-2 text-xs font-semibold text-on-surface">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <span>GPS: {lat.toFixed(4)}, {lng.toFixed(4)} ({searchRadius}km radius)</span>
          </div>

          <a
            href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=14/${lat}/${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-surface/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-outline-variant/50 shadow-sm pointer-events-auto flex items-center gap-1.5 text-xs font-semibold text-primary hover:bg-surface transition-colors"
          >
            <span>Open in OSM</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Selected Pharmacy Quick Card Overlay */}
        {(activePin || selectedPharmacy) && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-sm bg-surface/95 backdrop-blur-md p-3.5 rounded-xl border border-outline-variant/50 shadow-lg pointer-events-auto space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <Building2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-body-sm font-bold text-on-surface">
                    {(activePin || selectedPharmacy)?.name || 'Selected Pharmacy'}
                  </h4>
                  <p className="text-[11px] text-on-surface-variant line-clamp-1">
                    {(activePin || selectedPharmacy)?.address || (activePin || selectedPharmacy)?.city || 'Near your location'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActivePin(null)}
                className="text-on-surface-variant hover:text-on-surface text-xs font-bold px-1"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-outline-variant/30 text-xs">
              <span className="text-primary font-semibold">
                {(activePin || selectedPharmacy)?.distance_km ? `${(activePin || selectedPharmacy).distance_km} km away` : 'Nearby'}
              </span>
              <div className="flex items-center gap-2">
                {(activePin || selectedPharmacy)?.lat && (activePin || selectedPharmacy)?.lng && (
                  <a
                    href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${lat}%2C${lng}%3B${(activePin || selectedPharmacy).lat}%2C${(activePin || selectedPharmacy).lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>Route</span>
                  </a>
                )}
                <Button
                  size="xs"
                  variant="primary"
                  onClick={() => onSelectPharmacy(activePin || selectedPharmacy)}
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
          {pharmacies.map((p, i) => (
            <button
              key={i}
              onClick={() => {
                setActivePin(p);
                onSelectPharmacy(p);
              }}
              className={`px-2.5 py-1 rounded-lg border text-left whitespace-nowrap transition-all flex items-center gap-1.5 ${
                (activePin?.name === p.name || selectedPharmacy?.name === p.name)
                  ? 'bg-primary text-on-primary border-primary font-semibold shadow-xs'
                  : 'bg-surface-container-low text-on-surface hover:bg-surface-container border-outline-variant/50'
              }`}
            >
              <span>{p.name || `Pharmacy #${i + 1}`}</span>
              {p.distance_km && (
                <span className={`text-[10px] ${activePin?.name === p.name ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>
                  ({p.distance_km}km)
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

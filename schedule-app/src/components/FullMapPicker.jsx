import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import AddressField from './AddressField.jsx';
import Icon from './Icon.jsx';
import { geoAvailable, getCurrentPosition } from '../data/geo.js';
import { selectTick } from '../data/haptics.js';

const DEFAULT_VIEW = [37.7749, -122.4194];

// A full-screen map for choosing where a pin goes: tap to place it, search for
// an address, or jump to where you are. Used by forms where the small inline
// map was too cramped (and its taps competed with the keyboard). Rendered in
// <body> so it sits above whatever sheet opened it.
//
// React still bubbles events from a portal up through the component that
// rendered it, so without the stopper below the sheet underneath treats a tap
// on the map as the start of its swipe-to-close gesture and swallows it.
const STOP = (e) => e.stopPropagation();
export default function FullMapPicker({ open, initial, title = 'Drop a pin', onConfirm, onClose }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [pin, setPin] = useState(initial || null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (open) {
      setPin(initial || null);
      setQuery('');
      setError('');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !containerRef.current) return undefined;
    const start = initial || null;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false });
    map.setView(start ? [start.lat, start.lng] : DEFAULT_VIEW, start ? 16 : 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    map.on('click', (e) => {
      selectTick();
      setPin({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 60);
    if (!start && geoAvailable()) {
      // Start near the person rather than on a default city.
      getCurrentPosition({ timeout: 6000 })
        .then((pos) => mapRef.current && !markerRef.current && mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 14))
        .catch(() => {});
    }
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    if (pin) {
      const icon = L.divIcon({
        className: 'pin-icon',
        html: `<div class="pin-bubble"><span>📍</span></div>`,
        iconSize: [40, 46],
        iconAnchor: [20, 46],
      });
      markerRef.current = L.marker([pin.lat, pin.lng], { icon, keyboard: false }).addTo(map);
    }
  }, [pin, open]);

  const goTo = (p) => {
    setError('');
    setPin(p);
    mapRef.current?.setView([p.lat, p.lng], Math.max(mapRef.current.getZoom(), 16));
  };

  const useHere = async () => {
    setLocating(true);
    setError('');
    try {
      const pos = await getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      goTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      setError("Couldn't get your location. Check that location is allowed for Keystone.");
    } finally {
      setLocating(false);
    }
  };

  if (!open) return null;
  return createPortal(
    <div
      className="full-map-picker"
      role="dialog"
      aria-label={title}
      onPointerDown={STOP}
      onPointerMove={STOP}
      onPointerUp={STOP}
      onPointerCancel={STOP}
      onTouchStart={STOP}
      onTouchMove={STOP}
      onTouchEnd={STOP}
      onMouseDown={STOP}
      onClick={STOP}
    >
      <header className="full-map-head">
        <button className="icon-btn" onClick={onClose} aria-label="Cancel">
          <Icon name="close" size={20} />
        </button>
        <strong>{title}</strong>
        <span className="full-map-head-spacer" />
      </header>
      <div className="full-map-search">
        <AddressField
          value={query}
          onChange={(text, coords) => {
            setQuery(text);
            if (coords) goTo(coords);
          }}
          placeholder="Search for an address or place"
        />
      </div>
      <div className="full-map-body">
        <div ref={containerRef} className="full-map-canvas" />
        {geoAvailable() && (
          <button className="map-round full-map-locate" onClick={useHere} disabled={locating} aria-label="My location" title="My location">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      <footer className="full-map-foot">
        <p className="muted small">{error || (pin ? 'Tap the map to move the pin.' : 'Tap the map to drop the pin.')}</p>
        <button className="btn btn-primary full" disabled={!pin} onClick={() => onConfirm(pin)}>
          Use this location
        </button>
      </footer>
    </div>,
    document.body,
  );
}

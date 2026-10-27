import { useState } from 'react';
import AddressField from './AddressField.jsx';
import FullMapPicker from './FullMapPicker.jsx';
import Icon from './Icon.jsx';
import { geoAvailable, getCurrentPosition } from '../data/geo.js';
import { selectTick } from '../data/haptics.js';

// The address box plus two ways to set the location without typing one: pick a
// spot on a full-screen map, or use where you are right now. Both hand back
// coordinates through the same onChange the address box uses, so the person
// form saves them exactly like a picked suggestion. A pin on its own is a
// complete location — the address text can stay empty.
export default function AddressPinField({ value, lat, lng, onChange, placeholder }) {
  const [mapOpen, setMapOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const hasPin = lat != null && lng != null;

  const setPin = (la, ln) => {
    selectTick();
    setError('');
    onChange(value || '', { lat: la, lng: ln });
  };

  const useHere = async () => {
    setLocating(true);
    setError('');
    try {
      const pos = await getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      setPin(pos.coords.latitude, pos.coords.longitude);
    } catch {
      setError("Couldn't get your location. Check that location is allowed for Keystone.");
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="address-pin-field">
      <AddressField value={value} onChange={onChange} placeholder={placeholder} />
      <div className="address-pin-actions">
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setMapOpen(true)}>
          <Icon name="pin" size={14} /> {hasPin ? 'Change pin on map' : 'Drop a pin on the map'}
        </button>
        {geoAvailable() && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={useHere} disabled={locating}>
            {locating ? 'Locating…' : 'Use my location'}
          </button>
        )}
      </div>
      {error && <p className="muted small danger-text">{error}</p>}
      {hasPin && <p className="muted small">Pin set on the map.</p>}
      <FullMapPicker
        open={mapOpen}
        initial={hasPin ? { lat, lng } : null}
        onClose={() => setMapOpen(false)}
        onConfirm={(p) => {
          setPin(p.lat, p.lng);
          setMapOpen(false);
        }}
      />
    </div>
  );
}

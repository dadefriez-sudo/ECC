import { useState } from 'react';
import AddressField from './AddressField.jsx';
import MiniMapPicker from './MiniMapPicker.jsx';
import Icon from './Icon.jsx';
import { geoAvailable, getCurrentPosition } from '../data/geo.js';
import { selectTick } from '../data/haptics.js';

// The address box plus two ways to set the location without typing one: tap
// a spot on a small map, or use where you are right now. Both hand back
// coordinates through the same onChange the address box uses, so the person
// form saves them exactly like a picked suggestion. A pin on its own is a
// complete location — the address text can stay empty.
export default function AddressPinField({ value, lat, lng, onChange, placeholder }) {
  const [mapOpen, setMapOpen] = useState(lat != null && lng != null && !value);
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
      setMapOpen(true);
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
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setMapOpen((o) => !o)} aria-expanded={mapOpen}>
          <Icon name="pin" size={14} /> {mapOpen ? 'Hide map' : hasPin ? 'Edit pin on map' : 'Drop a pin on the map'}
        </button>
        {geoAvailable() && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={useHere} disabled={locating}>
            {locating ? 'Locating…' : 'Use my location'}
          </button>
        )}
      </div>
      {error && <p className="muted small danger-text">{error}</p>}
      {mapOpen && <MiniMapPicker lat={lat} lng={lng} onPick={setPin} />}
      {hasPin && !mapOpen && <p className="muted small">Pin set on the map.</p>}
    </div>
  );
}

import { useRef, useState } from 'react';
import Modal from './Modal.jsx';
import AddressField from './AddressField.jsx';
import MiniMapPicker from './MiniMapPicker.jsx';
import Icon from './Icon.jsx';
import { geocodeAddress } from '../data/geocode.js';
import { confirmTick, selectTick, tapTick } from '../data/haptics.js';

// Shown after a vCard import for every contact that didn't come out the
// other side with a pin: no address on the card at all, or an address that
// didn't match anything when auto-geocoded. Reviewed one at a time — typing
// a corrected address (with suggestions, same as the rest of the app) or
// tapping a spot on the small map both produce a location; either is handed
// back to the caller to save and pin, or the contact can be skipped and
// picked up later from their own profile.
export default function ImportAddressReview({ queue, onResolve, onSkip, onClose }) {
  // Fixed at the queue's starting size so the "X of Y" count climbs as
  // contacts are resolved/skipped, rather than Y shrinking along with it.
  const totalRef = useRef(queue.length);
  if (queue.length > totalRef.current) totalRef.current = queue.length;
  const total = totalRef.current;
  const current = queue[0];

  if (!current) return null;

  return (
    <ReviewCard
      key={current.id}
      contact={current}
      title={`Add a location (${total - queue.length + 1} of ${total})`}
      onResolve={onResolve}
      onSkip={onSkip}
      onClose={onClose}
    />
  );
}

function ReviewCard({ contact, title, onResolve, onSkip, onClose }) {
  const [text, setText] = useState(contact.address || '');
  const [coords, setCoords] = useState(null);
  const [looking, setLooking] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);

  const onAddressChange = (value, picked) => {
    setText(value);
    setCoords(picked ? { lat: picked.lat, lng: picked.lng } : null);
    setLookupFailed(false);
  };

  const onMapPick = (lat, lng) => {
    selectTick();
    setCoords({ lat, lng });
    setLookupFailed(false);
  };

  const canSave = !!(coords || text.trim());

  const save = async () => {
    let loc = coords;
    if (!loc && text.trim()) {
      setLooking(true);
      loc = await geocodeAddress(text.trim());
      setLooking(false);
      if (!loc) {
        setLookupFailed(true);
        return;
      }
    }
    confirmTick();
    onResolve(contact.id, {
      address: text.trim(),
      addressLat: loc?.lat ?? null,
      addressLng: loc?.lng ?? null,
    });
  };

  const skip = () => {
    tapTick();
    onSkip(contact.id);
  };

  return (
    <Modal
      open
      tall
      title={title}
      onClose={onClose}
      footer={
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={skip}>
            Skip
          </button>
          <button className="btn btn-primary" disabled={!canSave || looking} onClick={save}>
            {looking ? 'Looking up…' : <><Icon name="pin" size={15} /> Save location</>}
          </button>
        </div>
      }
    >
      <div className="form">
        <div className="import-review-name">
          <strong>{contact.name}</strong>
          <span className="muted small">
            {contact.reason === 'missing'
              ? "No address came in with this card."
              : `Couldn't find "${contact.address}" on the map.`}
          </span>
        </div>

        <label className="field">
          <span>Address</span>
          <AddressField value={text} onChange={onAddressChange} placeholder="Street, city, state" />
        </label>
        {lookupFailed && (
          <p className="muted small danger-text">
            Still couldn't find that address — try picking a suggestion, or drop a pin below.
          </p>
        )}

        <div className="field">
          <span>Or drop a pin</span>
          <MiniMapPicker lat={coords?.lat} lng={coords?.lng} onPick={onMapPick} />
        </div>
      </div>
    </Modal>
  );
}

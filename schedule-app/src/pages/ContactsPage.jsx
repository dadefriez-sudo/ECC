import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore, useActions } from '../data/store.jsx';
import AddressField from '../components/AddressField.jsx';
import EditorSheet from '../components/EditorSheet.jsx';
import Select from '../components/Select.jsx';
import Modal from '../components/Modal.jsx';
import { Avatar, AvatarPicker } from '../components/Avatar.jsx';
import { Brand } from '../components/Logo.jsx';
import SwipeRow from '../components/SwipeRow.jsx';
import { daysAgoLabel, daysSince, todayISO, uid } from '../data/helpers.js';
import { syncContactAddressPin } from '../data/geocode.js';
import { parseVCard, generateVCard } from '../data/vcard.js';
import { useDeleteContactWithUndo } from '../data/useDeleteContact.js';
import { useToast } from '../data/toast.jsx';
import { selectTick } from '../data/haptics.js';

// Overdue logic lives in data/reconnect.js now — it needs the interaction
// list and a settings flag, not just a day count. Re-exported here so the
// pages that already imported it from this module keep working.
import { reconnectDaysOf, makeOverdueCheck } from '../data/reconnect.js';
export { reconnectDaysOf, makeOverdueCheck };
import {
  resolveContactSwipe,
  DEFAULT_CONTACT_SWIPE_LEFT,
  DEFAULT_CONTACT_SWIPE_RIGHT,
} from '../data/contactSwipe.js';
import Icon from '../components/Icon.jsx';
import GroupPicker from '../components/GroupPicker.jsx';
import ImportAddressReview from '../components/ImportAddressReview.jsx';

// Sort comparators for the list — dates compare fine as their own ISO
// strings, so "missing" just needs a fallback that sorts to the right end
// rather than a separate branch: '0000-00-00' reads as earliest, so a
// contact with no createdAt/lastContacted naturally lands last in a
// newest-first sort instead of needing its own case.
// The A-Z list. People are ordered by first name by default (or by last name,
// a setting), ignoring case and accents, with anything that does not start
// with a letter (a number, a symbol) collected under # at the end.
const stripAccents = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function nameSortKey(name, order) {
  const n = (name || '').trim();
  if (order !== 'last') return n;
  const parts = n.split(/\s+/);
  return parts.length < 2 ? n : `${parts[parts.length - 1]} ${parts.slice(0, -1).join(' ')}`;
}
function letterFromKey(key) {
  const ch = stripAccents((key || '#').trim().charAt(0)).toUpperCase();
  return /[A-Z]/.test(ch) ? ch : '#';
}
const nameComparator = (order) => (a, b) => {
  const ka = nameSortKey(a.name, order);
  const kb = nameSortKey(b.name, order);
  const la = letterFromKey(ka) === '#';
  const lb = letterFromKey(kb) === '#';
  if (la !== lb) return la ? 1 : -1;
  return ka.localeCompare(kb, undefined, { sensitivity: 'base' });
};
const ALPHABET = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];

const CONTACT_SORTS = {
  name: (a, b) => a.name.localeCompare(b.name),
  added: (a, b) => (b.createdAt || '0000-00-00').localeCompare(a.createdAt || '0000-00-00'),
  contacted: (a, b) => (b.lastContacted || '0000-00-00').localeCompare(a.lastContacted || '0000-00-00'),
};
const SORT_OPTIONS = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'added', label: 'Recently added' },
  { value: 'contacted', label: 'Recently contacted' },
];

export default function ContactsPage() {
  const { state } = useStore();
  const actions = useActions();
  const navigate = useNavigate();
  const location = useLocation();
  const deleteContactWithUndo = useDeleteContactWithUndo();
  const showToast = useToast();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(''); // '__overdue', '__favorites', or ''
  // Group chips are multi-select (show anyone in ANY of these groups) —
  // separate from `filter` above, which stays a single mutually-exclusive
  // choice between All/Reconnect/Favorites. Picking a group exits whichever
  // of those was active, and picking one of those clears any group picks.
  const [groupFilters, setGroupFilters] = useState(() => new Set());
  const toggleGroupFilter = (id) => {
    setFilter('');
    setGroupFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const setSpecialFilter = (v) => {
    setGroupFilters(new Set());
    setFilter(v);
  };
  const [sortMode, setSortMode] = useState('name'); // 'name' | 'added' | 'contacted'
  const [adding, setAdding] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulkTagText, setBulkTagText] = useState('');
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  // Contacts from the most recent vCard import that didn't come out the
  // other side with a pin — reviewed one at a time via ImportAddressReview.
  const [addressReview, setAddressReview] = useState([]);
  // Offered once, right after a vCard import finishes — a fast way to file
  // an entire imported batch (often all from the same source, e.g. a synced
  // church or work directory) into one group instead of tagging them one by
  // one afterward. Only ever offered, never forced: skipping just leaves
  // them ungrouped, same as before this existed.
  const [importGroupPrompt, setImportGroupPrompt] = useState(null); // { contactIds, count } | null
  const [importGroupChoice, setImportGroupChoice] = useState('');

  const toggleSelected = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };
  const selectedContacts = () =>
    [...selected].map((id) => state.contacts.find((c) => c.id === id)).filter(Boolean);
  const bulkDelete = () => {
    deleteContactWithUndo(selectedContacts());
    exitSelectMode();
  };
  const bulkExport = () => {
    const list = selectedContacts();
    const blob = new Blob([generateVCard(list)], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${todayISO()}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const applyBulkTag = () => {
    const tag = bulkTagText.trim();
    if (!tag) return;
    for (const c of selectedContacts()) {
      if (!(c.tags || []).includes(tag)) {
        actions.updateContact({ ...c, tags: [...(c.tags || []), tag] });
      }
    }
    showToast(`Tagged ${selected.size} ${selected.size === 1 ? 'person' : 'people'} "${tag}"`);
    setBulkTagOpen(false);
    setBulkTagText('');
    exitSelectMode();
  };

  const iconSize = state.settings?.contactIconSize || 'md';

  // Swipe bindings, both configurable (Settings → People swipe actions).
  // The context bag is what lets the action registry stay plain data —
  // navigation, toasts and the undo-aware delete all live out here.
  const swipeRightKey = state.settings?.contactSwipeRight ?? DEFAULT_CONTACT_SWIPE_RIGHT;
  const swipeLeftKey = state.settings?.contactSwipeLeft ?? DEFAULT_CONTACT_SWIPE_LEFT;
  const swipeFor = (key, contact) =>
    resolveContactSwipe(key, { contact, actions, navigate, showToast, deleteContactWithUndo });

  const statusById = useMemo(
    () => Object.fromEntries(state.statuses.map((s) => [s.id, s])),
    [state.statuses]
  );

  // Closes over the settings flag and the interaction list (see
  // data/reconnect.js), so the call sites below stay a plain isOverdue(c).
  const isOverdue = useMemo(() => makeOverdueCheck(state), [state]);

  const overdue = useMemo(
    () =>
      state.contacts
        .filter(isOverdue)
        .sort((a, b) => daysSince(b.lastContacted) - daysSince(a.lastContacted)),
    [state.contacts, isOverdue]
  );

  const favoriteCount = useMemo(() => state.contacts.filter((c) => c.favorite).length, [state.contacts]);

  const nameOrder = state.settings?.contactNameOrder === 'last' ? 'last' : 'first';
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.contacts
      .filter((c) =>
        groupFilters.size > 0
          ? groupFilters.has(c.statusId)
          : filter === '__overdue'
          ? isOverdue(c)
          : filter === '__favorites'
          ? c.favorite
          : true
      )
      .filter((c) =>
        q
          ? c.name.toLowerCase().includes(q) ||
            (c.tags || []).some((t) => t.toLowerCase().includes(q)) ||
            (c.notes || '').toLowerCase().includes(q)
          : true
      )
      .sort(sortMode === 'name' ? nameComparator(nameOrder) : CONTACT_SORTS[sortMode] || CONTACT_SORTS.name);
  }, [state.contacts, query, filter, groupFilters, isOverdue, sortMode, nameOrder]);

  const showBanner = !query.trim() && filter === '' && groupFilters.size === 0 && overdue.length > 0;

  // Directory layout: favorites as an avatar row up top, the list grouped
  // under A-Z letters (only when sorted by name), and a one-line reconnect
  // banner in place of the old carousel. Filters, sort and Select live
  // behind the button beside the search box.
  const noFilters = !query.trim() && filter === '' && groupFilters.size === 0;
  const favorites = useMemo(
    () => state.contacts.filter((c) => c.favorite).sort(nameComparator(nameOrder)).slice(0, 12),
    [state.contacts, nameOrder]
  );
  const showFavRow = noFilters && !selectMode && favorites.length > 0;
  const filtersActive = filter !== '' || groupFilters.size > 0 || sortMode !== 'name';
  const activeFilterLabel =
    groupFilters.size > 0
      ? state.statuses.filter((st) => groupFilters.has(st.id)).map((st) => st.label).join(', ')
      : filter === '__overdue'
      ? 'Reconnect'
      : filter === '__favorites'
      ? 'Favorites'
      : '';
  const byLetter = sortMode === 'name' && filter !== '__overdue';
  const letterOf = (c) => letterFromKey(nameSortKey(c.name, nameOrder));
  // Rows grouped under their letter, A to Z then #.
  const groups = useMemo(() => {
    const map = new Map();
    for (const c of filtered) {
      const l = letterFromKey(nameSortKey(c.name, nameOrder));
      if (!map.has(l)) map.set(l, []);
      map.get(l).push(c);
    }
    return ALPHABET.filter((l) => map.has(l)).map((l) => ({ letter: l, items: map.get(l) }));
  }, [filtered, nameOrder]);
  const presentLetters = useMemo(() => new Set(groups.map((g) => g.letter)), [groups]);
  const showIndex = filtered.length >= 12 && groups.length >= 3;

  const initialAddJsonRef = useRef('');
  const startAdd = () => {
    const d = {
      name: '',
      phone: '',
      email: '',
      address: '',
      addressLat: null,
      addressLng: null,
      photo: '',
      statusId: state.statuses[0]?.id || '',
      tagsText: '',
      notes: '',
    };
    setAdding(d);
    initialAddJsonRef.current = JSON.stringify(d);
  };
  const addDirty = adding ? JSON.stringify(adding) !== initialAddJsonRef.current : false;

  // Opened from the Home page's quick-add menu.
  useEffect(() => {
    if (location.state?.quickNewContact) {
      startAdd();
      window.history.replaceState({}, '');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveNew = () => {
    const name = adding.name.trim();
    if (!name) return;
    const address = adding.address.trim();
    const contact = {
      id: uid('c'),
      name,
      phone: adding.phone.trim(),
      email: adding.email.trim(),
      address,
      // Carried from AddressField when the address came from a picked
      // suggestion, not typed free text — dropped here before, so a
      // disambiguated pick (exactly the reason to offer suggestions at all)
      // was silently thrown away and the address re-geocoded blind on save,
      // same one-shot "first hit" lookup a free-typed address falls back to.
      addressLat: adding.addressLat ?? null,
      addressLng: adding.addressLng ?? null,
      photo: adding.photo || '',
      statusId: adding.statusId,
      tags: adding.tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      notes: adding.notes.trim(),
      lastContacted: '',
      createdAt: new Date().toISOString().slice(0, 10),
      favorite: false,
    };
    actions.addContact(contact);
    if (address) syncContactAddressPin(contact, state, actions);
    setAdding(null);
  };

  const isPro = !!state.settings?.isPro;

  const vcfFileRef = useRef(null);
  const importVCard = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = parseVCard(reader.result);
        if (imported.length === 0) return alert('No contacts found in that file.');
        const newContacts = imported.map((c) => ({
          id: uid('c'),
          name: c.name,
          phone: c.phone,
          email: c.email,
          address: c.address,
          photo: '',
          statusId: state.statuses[0]?.id || '',
          tags: [],
          notes: c.notes,
          lastContacted: '',
          createdAt: todayISO(),
        }));
        newContacts.forEach((contact) => actions.addContact(contact));
        // Groups are a Pro feature — offering to sort into one that can't
        // be seen or used afterward would just be confusing, so non-Pro
        // (or nothing to sort into yet) falls back to the plain count.
        if (isPro && state.statuses.length > 0) {
          setImportGroupChoice('');
          setImportGroupPrompt({ contactIds: newContacts.map((c) => c.id), count: newContacts.length });
        } else {
          alert(`Imported ${newContacts.length} contact${newContacts.length === 1 ? '' : 's'}.`);
        }
        // Geocoding pins one at a time in the background, a beat apart —
        // Nominatim's public endpoint enforces roughly one request per
        // second, and firing every contact's lookup at once (the previous
        // behaviour) meant only the first one or two ever got served; the
        // rest were silently rate-limited. Every contact with an address
        // gets a real attempt this way, sequenced rather than all at once,
        // and anyone who came out the other side without a pin — no address
        // on the card, or one that didn't geocode — is queued for a quick
        // manual review instead of just staying silently unpinned.
        (async () => {
          const needsReview = [];
          for (const contact of newContacts) {
            if (!contact.address) {
              needsReview.push({ id: contact.id, name: contact.name, address: '', reason: 'missing' });
              continue;
            }
            const loc = await syncContactAddressPin(contact, state, actions);
            if (!loc) {
              needsReview.push({ id: contact.id, name: contact.name, address: contact.address, reason: 'unresolved' });
            }
            await new Promise((r) => setTimeout(r, 1100));
          }
          if (needsReview.length) setAddressReview(needsReview);
        })();
      } catch {
        alert('That file could not be read as a vCard (.vcf) file.');
      }
    };
    reader.readAsText(file);
  };

  // A contact from the address review — either a corrected/typed address
  // (geocoded on demand) or a pin dropped by hand — is saved to the
  // contact and pinned in one go via the same helper the rest of the app
  // uses, then the review moves to the next one in the queue.
  const resolveAddressReview = (contactId, { address, addressLat, addressLng }) => {
    const contact = state.contacts.find((c) => c.id === contactId);
    setAddressReview((q) => q.filter((c) => c.id !== contactId));
    if (!contact) return;
    const updated = { ...contact, address, addressLat, addressLng };
    actions.updateContact(updated);
    syncContactAddressPin(updated, state, actions);
  };
  const skipAddressReview = (contactId) => {
    setAddressReview((q) => q.filter((c) => c.id !== contactId));
  };

  const applyImportGroup = () => {
    const { contactIds, count } = importGroupPrompt;
    if (importGroupChoice) {
      for (const id of contactIds) {
        const c = state.contacts.find((x) => x.id === id);
        if (c) actions.updateContact({ ...c, statusId: importGroupChoice });
      }
      const group = state.statuses.find((s) => s.id === importGroupChoice);
      showToast(`Added ${count} ${count === 1 ? 'contact' : 'contacts'} to ${group?.label || 'the group'}`);
    }
    setImportGroupPrompt(null);
  };

  // The letter headings stick just under the page header while you scroll, so
  // it needs the header's real height (it changes with filters and select mode).
  useEffect(() => {
    const head = document.querySelector('.page-head');
    if (!head) return undefined;
    const set = () => document.documentElement.style.setProperty('--people-head-h', `${Math.round(head.getBoundingClientRect().height)}px`);
    set();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(set) : null;
    ro?.observe(head);
    return () => {
      ro?.disconnect();
      document.documentElement.style.removeProperty('--people-head-h');
    };
  }, []);

  const renderContactRow = (c) => {
    const st = statusById[c.statusId];
    const over = isOverdue(c);
    const isSel = selected.has(c.id);
    return (
      <li key={c.id}>
        <SwipeRow
          disabled={selectMode}
          swipeRight={swipeFor(swipeRightKey, c)}
          swipeLeft={swipeFor(swipeLeftKey, c)}
        >
          <div className="contact-row-inner">
            <button
              className="contact-row"
              onClick={() => (selectMode ? toggleSelected(c.id) : navigate(`/contacts/${c.id}`))}
            >
              {selectMode && <span className={`select-dot${isSel ? ' select-dot--on' : ''}`} />}
              <span className="avatar-slot">
                <Avatar name={c.name} photo={c.photo} color={st?.color} size={iconSize} />
                {over && <span className="overdue-dot" aria-hidden="true" />}
              </span>
              <span className="contact-main">
                <span className="contact-name">
                  {c.name}
                  {over && filter !== '__overdue' && <span className="overdue-tag">Reconnect</span>}
                </span>
                <span className="contact-sub muted">
                  {st && <span className="dot-badge" style={{ color: st.color }}>{st.label}</span>}
                  {st && ' · '}
                  Last: {daysAgoLabel(c.lastContacted)}
                </span>
              </span>
              {!selectMode && !(filter === '__overdue') && <Chevron />}
            </button>
            {!selectMode && filter === '__overdue' && (
              <button
                className="btn btn-ghost btn-sm reconnect-log"
                onClick={() => actions.updateContact({ ...c, lastContacted: todayISO() })}
              >
                <Icon name="check" size={15} /> Log
              </button>
            )}
          </div>
        </SwipeRow>
      </li>
    );
  };

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-head-row">
          <Brand>People</Brand>
          <div className="page-head-actions">
            <button className="icon-btn" onClick={() => vcfFileRef.current?.click()} aria-label="Import contacts (.vcf)" title="Import contacts (.vcf)">
              <ImportIcon />
            </button>
          </div>
          <input ref={vcfFileRef} type="file" accept=".vcf,text/vcard" hidden onChange={importVCard} />
        </div>
        <div className="people-search-row">
          <input
            className="search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, tag, or note"
          />
          <button
            className="icon-btn people-filter-btn"
            onClick={() => setFilterOpen(true)}
            aria-label="Filter, sort and select"
            title="Filter, sort and select"
          >
            <FilterIcon />
            {filtersActive && <i className="people-filter-dot" aria-hidden="true" />}
          </button>
        </div>
        {activeFilterLabel && !selectMode && (
          <div className="chips">
            <button className="chip chip--on" onClick={() => setSpecialFilter('')}>
              {activeFilterLabel} ✕
            </button>
          </div>
        )}
        {selectMode && (
          <div className="select-toggle-row">
            <button className="btn btn-sm btn-primary" onClick={exitSelectMode}>
              Cancel select
            </button>
            <span className="muted small">{selected.size} selected</span>
          </div>
        )}
      </header>

      {showFavRow && (
        <div className="people-favs">
          {favorites.map((c) => (
            <button key={c.id} className="people-fav" onClick={() => navigate(`/contacts/${c.id}`)}>
              <Avatar name={c.name} photo={c.photo} color={statusById[c.statusId]?.color} size="lg" />
              <span className="people-fav-name">{c.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      )}

      {showBanner && (
        <button className="people-reconnect" onClick={() => setSpecialFilter('__overdue')}>
          <Icon name="bell" size={16} />
          <span className="people-reconnect-text">
            {overdue.length} {overdue.length === 1 ? 'person' : 'people'} to reconnect
          </span>
          <span className="people-reconnect-stack">
            {overdue.slice(0, 3).map((c) => (
              <Avatar key={c.id} name={c.name} photo={c.photo} color={statusById[c.statusId]?.color} size="sm" />
            ))}
          </span>
          <Chevron />
        </button>
      )}

      {state.contacts.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><Icon name="personPlus" size={48} /></div>
          <h2>Add the people who matter</h2>
          <p className="muted">
            Keep track of friends, family, and anyone you want to stay close to. Sort them into groups
            you create, and get a nudge when it's time to reach out again.
          </p>
          <button className="btn btn-primary" onClick={startAdd}>
            + Add someone
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="muted center-pad">No one matches that search.</p>
      ) : (
        <ul className={`contact-list${byLetter ? ' contact-list--dir contact-list--groups' : ''}`}>
          {byLetter
            ? groups.map((g) => (
                <li key={g.letter} className="people-group" id={`pl-${g.letter}`}>
                  <div className="people-letter">{g.letter}</div>
                  <ul className="contact-list contact-list--dir">{g.items.map(renderContactRow)}</ul>
                </li>
              ))
            : filtered.map(renderContactRow)}
        </ul>
      )}

      {byLetter && showIndex && !selectMode && (
        <AlphabetRail
          present={presentLetters}
          onJump={(l) => document.getElementById(`pl-${l}`)?.scrollIntoView({ block: 'start' })}
        />
      )}

      <Modal
        open={filterOpen}
        title="Filter & sort"
        onClose={() => setFilterOpen(false)}
        footer={
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={() => setFilterOpen(false)}>
              Done
            </button>
          </div>
        }
      >
        <div className="form">
          <div className="field">
            <span>Show</span>
            <div className="chips people-filter-chips">
          <button
            className={`chip${!filter && groupFilters.size === 0 ? ' chip--on' : ''}`}
            onClick={() => setSpecialFilter('')}
          >
            All
          </button>
          {overdue.length > 0 && (
            <button
              className={`chip chip--alert${filter === '__overdue' ? ' chip--on' : ''}`}
              onClick={() => setSpecialFilter(filter === '__overdue' ? '' : '__overdue')}
            >
              Reconnect · {overdue.length}
            </button>
          )}
          {favoriteCount > 0 && (
            <button
              className={`chip${filter === '__favorites' ? ' chip--on' : ''}`}
              onClick={() => setSpecialFilter(filter === '__favorites' ? '' : '__favorites')}
            >
              <Icon name="star" size={13} /> Favorites · {favoriteCount}
            </button>
          )}
          {isPro ? (
            // Multi-select: tap any number of groups on at once to see
            // everyone in any of them, not just one group at a time.
            state.statuses.map((s) => {
              const on = groupFilters.has(s.id);
              return (
                <button
                  key={s.id}
                  className={`chip${on ? ' chip--on' : ''}`}
                  style={on ? { background: s.color, borderColor: s.color, color: '#fff' } : { borderColor: s.color, color: s.color }}
                  onClick={() => toggleGroupFilter(s.id)}
                  aria-pressed={on}
                >
                  {s.label}
                </button>
              );
            })
          ) : (
            state.statuses.length > 0 && (
              <button className="chip" onClick={() => navigate('/pricing')}>
                <Icon name="lock" size={15} /> Groups · Pro
              </button>
            )
          )}
            </div>
          </div>
          <div className="field">
            <span>Sort</span>
            <Select value={sortMode} onChange={setSortMode} options={SORT_OPTIONS} />
          </div>
          {sortMode === 'name' && (
            <div className="field">
              <span>Order names by</span>
              <div className="seg seg--full">
                {[
                  { value: 'first', label: 'First name' },
                  { value: 'last', label: 'Last name' },
                ].map((o) => (
                  <button
                    key={o.value}
                    className={`seg-btn${nameOrder === o.value ? ' seg-btn--on' : ''}`}
                    onClick={() => actions.setSettings({ contactNameOrder: o.value })}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {state.contacts.length > 0 && (
            <button
              className="btn btn-ghost full"
              onClick={() => {
                setSelectMode(true);
                setFilterOpen(false);
              }}
            >
              Select several people
            </button>
          )}
        </div>
      </Modal>

      {state.contacts.length > 0 && !selectMode && (
        <button className="fab" onClick={startAdd} aria-label="Add person">
          <Icon name="plus" size={26} />
        </button>
      )}

      {selectMode && selected.size > 0 && (
        <div className="select-bar">
          <span>{selected.size} selected</span>
          <div className="select-bar-actions">
            <button className="btn btn-ghost btn-sm" data-haptic="none" onClick={() => setBulkTagOpen(true)}>
              Tag
            </button>
            <button className="btn btn-ghost btn-sm" data-haptic="none" onClick={bulkExport}>
              Export
            </button>
            <button className="btn btn-danger-ghost btn-sm" data-haptic="none" onClick={bulkDelete}>
              Delete
            </button>
          </div>
        </div>
      )}

      <Modal
        open={bulkTagOpen}
        title="Add a tag"
        onClose={() => setBulkTagOpen(false)}
        footer={
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setBulkTagOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={applyBulkTag} disabled={!bulkTagText.trim()}>
              Apply
            </button>
          </div>
        }
      >
        <label className="field">
          <span>Tag</span>
          <input
            autoFocus
            value={bulkTagText}
            onChange={(e) => setBulkTagText(e.target.value)}
            placeholder="e.g. neighbor"
            onKeyDown={(e) => e.key === 'Enter' && applyBulkTag()}
          />
        </label>
      </Modal>

      <Modal
        open={!!importGroupPrompt}
        title="Sort into a group?"
        onClose={() => setImportGroupPrompt(null)}
        footer={
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setImportGroupPrompt(null)}>
              Skip
            </button>
            <button className="btn btn-primary" onClick={applyImportGroup} disabled={!importGroupChoice}>
              Apply
            </button>
          </div>
        }
      >
        {importGroupPrompt && (
          <div className="form">
            <p className="muted small">
              Imported {importGroupPrompt.count} {importGroupPrompt.count === 1 ? 'contact' : 'contacts'}. Add
              {importGroupPrompt.count === 1 ? ' it' : ' all of them'} to one group now, or skip and sort them
              individually later.
            </p>
            <label className="field">
              <span>Group</span>
              <GroupPicker value={importGroupChoice} onChange={setImportGroupChoice} />
            </label>
          </div>
        )}
      </Modal>

      {addressReview.length > 0 && (
        <ImportAddressReview
          queue={addressReview}
          onResolve={resolveAddressReview}
          onSkip={skipAddressReview}
          onClose={() => setAddressReview([])}
        />
      )}

      <EditorSheet open={!!adding} title="Add person" dirty={addDirty} onSave={saveNew} onDiscard={() => setAdding(null)}>
        {adding && (
          <div className="form">
            <AvatarPicker
              name={adding.name || '?'}
              photo={adding.photo}
              onChange={(photo) => setAdding({ ...adding, photo })}
            />
            <label className="field">
              <span>Name</span>
              <input
                value={adding.name}
                onChange={(e) => setAdding({ ...adding, name: e.target.value })}
                placeholder="Full name"
              />
            </label>
            {isPro && (
              <label className="field">
                <span>Group</span>
                <GroupPicker value={adding.statusId} onChange={(v) => setAdding({ ...adding, statusId: v })} />
              </label>
            )}
            <div className="field-row">
              <label className="field">
                <span>Phone</span>
                <input
                  type="tel"
                  value={adding.phone}
                  onChange={(e) => setAdding({ ...adding, phone: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  value={adding.email}
                  onChange={(e) => setAdding({ ...adding, email: e.target.value })}
                />
              </label>
            </div>
            <label className="field">
              <span>Address</span>
              <AddressField
                value={adding.address}
                onChange={(address, coords) =>
                  setAdding({
                    ...adding,
                    address,
                    addressLat: coords ? coords.lat : null,
                    addressLng: coords ? coords.lng : null,
                  })
                }
                placeholder="Optional, drops a map pin automatically"
              />
            </label>
            <label className="field">
              <span>Tags</span>
              <input
                value={adding.tagsText}
                onChange={(e) => setAdding({ ...adding, tagsText: e.target.value })}
                placeholder="family, work (comma separated)"
              />
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea
                rows="2"
                value={adding.notes}
                onChange={(e) => setAdding({ ...adding, notes: e.target.value })}
              />
            </label>
          </div>
        )}
      </EditorSheet>
    </div>
  );
}

// The side rail: all 26 letters and #, dimmed when nobody starts with that
// letter. Tap a letter, or drag a finger along the rail to scrub through the
// list; a bubble shows the letter you are on. A letter with nobody under it
// jumps to the next one that has someone.
function AlphabetRail({ present, onJump }) {
  const railRef = useRef(null);
  const [active, setActive] = useState(null);
  const lastRef = useRef(null);

  const letterAt = (clientY) => {
    const r = railRef.current.getBoundingClientRect();
    const i = Math.max(0, Math.min(ALPHABET.length - 1, Math.floor(((clientY - r.top) / r.height) * ALPHABET.length)));
    return ALPHABET[i];
  };
  const go = (clientY) => {
    const letter = letterAt(clientY);
    if (letter === lastRef.current) return;
    lastRef.current = letter;
    setActive(letter);
    const from = ALPHABET.indexOf(letter);
    const target = ALPHABET.slice(from).find((l) => present.has(l)) || [...ALPHABET].reverse().find((l) => present.has(l));
    if (target) onJump(target);
    selectTick();
  };
  const end = () => {
    lastRef.current = null;
    setTimeout(() => setActive(null), 350);
  };

  return (
    <>
      {active && <div className="people-index-bubble" aria-hidden="true">{active}</div>}
      <nav
        ref={railRef}
        className="people-index"
        aria-label="Jump to letter"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          go(e.clientY);
        }}
        onPointerMove={(e) => e.buttons !== 0 && go(e.clientY)}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {ALPHABET.map((l) => (
          <span key={l} className={`people-index-l${present.has(l) ? '' : ' people-index-l--off'}${active === l ? ' people-index-l--on' : ''}`}>
            {l}
          </span>
        ))}
      </nav>
    </>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className="row-chevron">
      <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M3 5h18l-7 8v6l-4-2v-4L3 5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M12 3v11m0 0l-4-4m4 4l4-4M5 19h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

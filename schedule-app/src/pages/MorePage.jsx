import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useAuth, useUser, useClerk, UserButton } from '@clerk/clerk-react';
import { useStore, useActions } from '../data/store.jsx';
import Modal from '../components/Modal.jsx';
import Select from '../components/Select.jsx';
import { Avatar, AvatarPicker } from '../components/Avatar.jsx';
import { Brand } from '../components/Logo.jsx';
import { selectTick } from '../data/haptics.js';
import {
  notificationsSupported,
  notificationPermission,
  requestNotificationPermission,
  exactAlarmsConfigurable,
  exactAlarmPermission,
  requestExactAlarmPermission,
} from '../data/notifications.js';
import { downloadICS, parseICS } from '../data/ics.js';
import { parseVCard, generateVCard } from '../data/vcard.js';
import { syncContactAddressPin } from '../data/geocode.js';
import {
  formatTime,
  EVENT_TYPE_KINDS,
  DEFAULT_KIND_COLORS,
  normalizeEventTypeOrder,
  uid,
  todayISO,
} from '../data/helpers.js';
import { geoAvailable } from '../data/geo.js';
import ReorderToggleList from '../components/ReorderToggleList.jsx';
import SettingsGroup from '../components/SettingsGroup.jsx';
import SettingsSection from '../components/SettingsSection.jsx';
import { HOME_BLOCK_TYPES, normalizeHomeBlocks } from '../data/homeBlocks.js';
import { TAB_TYPES, normalizeTabOrder } from '../data/tabs.js';
import { QUICK_ADD_TYPES, normalizeQuickAdd } from '../data/quickAdd.js';
import { CLERK_ENABLED } from '../data/clerkConfig.js';
import { AI_ENABLED } from '../data/aiConfig.js';
import { MAP_STYLE_OPTIONS } from '../data/mapStyles.js';
import {
  CONTACT_SWIPE_OPTIONS,
  DEFAULT_CONTACT_SWIPE_LEFT,
  DEFAULT_CONTACT_SWIPE_RIGHT,
} from '../data/contactSwipe.js';
import { backendConfigured, deleteAccount, googleAuthUrl, importGoogleData, disconnectGoogle } from '../data/api.js';
import { useSyncStatus, describeSyncedAt } from '../data/syncStatus.js';
import { useToast } from '../data/toast.jsx';
import Icon from '../components/Icon.jsx';

const formatHour = (h) => formatTime(`${String(h).padStart(2, '0')}:00`);
const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: h, label: formatHour(h) }));

const DESTRUCTIVE_ACTIONS = {
  reset: {
    title: 'Reset to sample data?',
    body: 'This replaces your current data with the built-in sample set.',
    cta: 'Reset',
  },
  clear: {
    title: 'Clear everything?',
    body: 'This permanently removes all goals, events, and people. Your custom groups are kept.',
    cta: 'Clear',
  },
  clearCache: {
    title: 'Clear cache?',
    body: 'This clears the offline app-shell cache and reloads Keystone. Your data (goals, events, people, notes) is untouched — it lives in local storage, not the cache.',
    cta: 'Clear cache',
  },
  clearContacts: {
    title: 'Remove all contacts?',
    body: 'This permanently removes everyone from People. Events and map pins are kept, just unlinked from the people they referenced.',
    cta: 'Remove all',
  },
};

// Swatches are each scheme's own light-mode accent, so the dot is literally
// the colour you get. Split into two rows because fifteen unlabelled dots in
// one grid gives no clue which are the soft ones (see styles.css for why the
// pastels are muted rather than pale).
const COLOR_SCHEMES = [
  { value: 'default', label: 'Gold', swatch: '#a9822a' },
  { value: 'emerald', label: 'Emerald', swatch: '#0f8f72' },
  { value: 'ocean', label: 'Ocean', swatch: '#1f6fb0' },
  { value: 'sunset', label: 'Sunset', swatch: '#d9601f' },
  { value: 'grape', label: 'Grape', swatch: '#7c4fd1' },
  { value: 'rose', label: 'Rose', swatch: '#c23d6b' },
  { value: 'forest', label: 'Forest', swatch: '#2f7d3a' },
  { value: 'slate', label: 'Slate', swatch: '#46586b' },
  { value: 'berry', label: 'Berry', swatch: '#a3306f' },
  { value: 'crimson', label: 'Crimson', swatch: '#c0392b' },
  { value: 'wine', label: 'Wine', swatch: '#8c2f43' },
  { value: 'clay', label: 'Clay', swatch: '#9c5b3c' },
  { value: 'olive', label: 'Olive', swatch: '#6d7d24' },
  { value: 'teal', label: 'Teal', swatch: '#0d8a9e' },
  { value: 'indigo', label: 'Indigo', swatch: '#4b56c9' },
  { value: 'plum', label: 'Plum', swatch: '#6b3b7a' },
  { value: 'charcoal', label: 'Charcoal', swatch: '#3d4348' },
];

const PASTEL_SCHEMES = [
  { value: 'lavender', label: 'Lavender', swatch: '#7a68b8' },
  { value: 'blush', label: 'Blush', swatch: '#c06b83' },
  { value: 'sage', label: 'Sage', swatch: '#5f8a63' },
  { value: 'sky', label: 'Sky', swatch: '#4f8bb5' },
  { value: 'apricot', label: 'Apricot', swatch: '#b8703c' },
  { value: 'seafoam', label: 'Seafoam', swatch: '#4e938c' },
];

const PRESET_COLORS = [
  '#2e9e6b',
  '#1f5f8b',
  '#e08a1e',
  '#8a5cd1',
  '#d1495b',
  '#3a9188',
  '#c2547a',
  '#5b7fb0',
];

// The Settings page as an outline: seven sections, nineteen cards, in the
// order someone would go looking for them rather than the order they were
// built in. Appearance used to sit between "Calendar import / export" and
// "Customize home screen", with the three Customize cards separated from
// the theme picker they belong with — nineteen equal-weight cards in one
// flat scroll, and no way to tell where anything lived.
//
// `keywords` are the words people actually type that don't appear in the
// card's own title — "dark mode" for Appearance, "backup" for Your data.
// Searching matches the title too, so it only lists the extras.
const SETTINGS_INDEX = [
  {
    label: 'Account',
    groups: [
      { id: 'g0', title: 'Profile', keywords: 'name photo picture avatar you' },
      { id: 'g1', title: 'Account & sync', keywords: 'sign in log out cloud backup device' },
      { id: 'g2', title: 'Shared calendars', keywords: 'share family invite together members' },
    ],
  },
  {
    label: 'Appearance',
    groups: [
      { id: 'g4', title: 'Theme & colors', keywords: 'appearance theme dark light mode colour scheme text size icon size font' },
      { id: 'g5', title: 'Home screen', keywords: 'customize blocks reorder hide sections layout' },
      { id: 'g6', title: 'Quick-add menu', keywords: 'customize fab plus button actions reorder' },
      { id: 'g7', title: 'Navigation tabs', keywords: 'customize tab bar bottom reorder hide' },
    ],
  },
  {
    label: 'Calendar',
    groups: [
      { id: 'g8', title: 'Calendar settings', keywords: 'day start end hour zoom week 24 templates duration reminder default' },
      { id: 'g15', title: 'Event types', keywords: 'call text in person travel email other category colour color custom add create new reorder remove drag' },
      { id: 'g3', title: 'Calendar import / export', keywords: 'ics subscribe google apple outlook download' },
    ],
  },
  {
    label: 'People',
    groups: [
      { id: 'g14', title: 'People groups', keywords: 'contacts status label category colour color' },
      { id: 'gswipe', title: 'People swipe actions', keywords: 'contacts gesture log schedule call text delete' },
      { id: 'g19', title: 'Contact import / export', keywords: 'vcf vcard contacts address book download backup google apple outlook' },
      { id: 'g13', title: 'Contact notifications', keywords: 'contacts dates special yearly birthdays anniversaries overdue reconnect touch base nudge' },
    ],
  },
  {
    label: 'Map',
    groups: [
      { id: 'g9', title: 'Map settings', keywords: 'pins basemap style satellite dark emoji size' },
      { id: 'g11', title: 'Arrival reminders', keywords: 'location geofence nearby pin notify' },
    ],
  },
  {
    label: 'Notifications',
    groups: [
      { id: 'g10', title: 'Allow notifications', keywords: 'alerts permission push allow' },
    ],
  },
  {
    label: 'App',
    groups: [
      // Buried behind AI_ENABLED (see aiConfig.js) along with the card
      // itself below — nothing to find here while it's off.
      ...(AI_ENABLED
        ? [{ id: 'gai', title: 'Assistant', keywords: 'claude ai chat bubble ask assistant helper' }]
        : []),
      { id: 'g16', title: 'Feedback', keywords: 'bug idea suggest contact support tour tutorial replay' },
      { id: 'g17', title: 'Your data', keywords: 'backup export import json reset clear cache delete storage' },
      { id: 'g18', title: 'Legal', keywords: 'privacy policy terms of service data collection legal' },
    ],
  },
];

export default function MorePage() {
  const { state } = useStore();
  const actions = useActions();
  const navigate = useNavigate();
  const location = useLocation();
  const [editingStatus, setEditingStatus] = useState(null);
  const [editingKindColor, setEditingKindColor] = useState(null); // { value, label, color } | null
  const [editingEventType, setEditingEventType] = useState(null); // { id?, label, color } | null
  const [confirm, setConfirm] = useState(null); // 'reset' | 'clear' | 'clearCache' | 'clearContacts' | null
  const [feedback, setFeedback] = useState(null); // string | null
  const [editingProfile, setEditingProfile] = useState(null);
  const [, setPermTick] = useState(0); // re-render after permission change
  // Lets a link elsewhere in the app (the Pro page's feature tiles) jump
  // straight to a matching card via /more?q=..., reusing the same search
  // that opens matching cards and hides the rest — read once on arrival,
  // not kept in sync with the URL afterwards, so typing in the box doesn't
  // fight with it.
  const [query, setQuery] = useState(() => new URLSearchParams(location.search).get('q') || '');
  const showToast = useToast();
  // Stripe redirects back here with ?checkout=success after a real purchase
  // (see backend/src/routes/billing.js). It's a full page reload, so this
  // effect runs once on arrival; the param is stripped right after so it
  // doesn't re-fire on a refresh or on navigating back to this page later.
  useEffect(() => {
    if (new URLSearchParams(location.search).get('checkout') !== 'success') return;
    showToast('Welcome to Keystone Pro!');
    navigate('/more', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The redirect back from Google's consent screen (see
  // backend/src/routes/google.js's /callback) is handled inside
  // GoogleSyncButtons below, not here — it needs a Clerk token, and this
  // component renders even when Clerk isn't configured (CLERK_ENABLED
  // false), which GoogleSyncButtons being conditionally mounted accounts for.
  // Which settings cards are expanded. All collapsed on arrival, so the page
  // opens as a scannable index rather than one long scroll; kept in component
  // state rather than persisted, since "where I left the accordion" isn't a
  // preference worth remembering across launches.
  const [openGroups, setOpenGroups] = useState(() => new Set());
  const isOpen = (id) => openGroups.has(id);
  const toggleGroup = (id) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Search matches a card's title and its keywords. Every term has to hit
  // somewhere, so "map dark" finds Map settings rather than everything
  // mentioning either word.
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const searching = terms.length > 0;
  const shown = useMemo(() => {
    const set = new Set();
    for (const section of SETTINGS_INDEX) {
      for (const g of section.groups) {
        const hay = `${section.label} ${g.title} ${g.keywords}`.toLowerCase();
        if (terms.every((t) => hay.includes(t))) set.add(g.id);
      }
    }
    return set;
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps
  const sectionShown = (label) => {
    if (!searching) return true;
    const section = SETTINGS_INDEX.find((x) => x.label === label);
    return !!section && section.groups.some((g) => shown.has(g.id));
  };
  // Everything a card needs to know about being found, opened and hidden.
  // While a search is running the matches open themselves — making you tap
  // a result to see whether it's the one you wanted defeats the search.
  const grp = (id) => ({
    id,
    open: searching || isOpen(id),
    onToggle: () => toggleGroup(id),
    hidden: searching && !shown.has(id),
  });
  const fileRef = useRef(null);
  const icsFileRef = useRef(null);
  const vcfFileRef = useRef(null);

  const theme = state.settings?.theme || 'system';
  const notifOn = !!state.settings?.notifications && notificationPermission() === 'granted';
  const isPro = !!state.settings?.isPro;
  const isBetaTester = !!state.settings?.isBetaTester;
  const googleConnected = !!state.settings?.googleConnected;
  const profileName = state.settings?.profileName || '';
  const profilePhoto = state.settings?.profilePhoto || '';
  // `!== false` rather than a truthiness check, matching DataSync: an
  // existing user whose stored settings predate this flag has it undefined,
  // and the toggle must show the same "on" that the sync is acting on.
  const cloudSyncOn = state.settings?.cloudSync !== false;

  const requirePro = (fn) => (isPro ? fn() : navigate('/pricing'));

  const exportICS = () => downloadICS(state.events, state.contacts);
  const importICS = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = parseICS(reader.result);
        if (imported.length === 0) return alert('No events found in that file.');
        for (const ev of imported) {
          actions.addEvent({
            ...ev,
            repeatUntil: '',
            repeatDays: [],
            doneDates: [],
            skipDates: [],
            kind: '',
            color: '',
            reminder: 0,
            contactIds: [],
            contactId: '',
          });
        }
        alert(`Imported ${imported.length} event${imported.length === 1 ? '' : 's'}.`);
      } catch {
        alert('That file could not be read as an .ics calendar.');
      }
    };
    reader.readAsText(file);
  };

  const exportContactsVCF = () => {
    const blob = new Blob([generateVCard(state.contacts)], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${todayISO()}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importContactsVCF = (e) => {
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
        alert(`Imported ${newContacts.length} contact${newContacts.length === 1 ? '' : 's'}.`);
        // Nominatim's public geocoder enforces roughly one request per
        // second, so addresses are synced one at a time, a beat apart,
        // instead of all at once — see the same pattern (and reasoning) on
        // the People tab's own import.
        (async () => {
          for (const contact of newContacts) {
            if (!contact.address) continue;
            await syncContactAddressPin(contact, state, actions);
            await new Promise((r) => setTimeout(r, 1100));
          }
        })();
      } catch {
        alert('That file could not be read as a vCard (.vcf) file.');
      }
    };
    reader.readAsText(file);
  };

  const toggleNotifications = async () => {
    if (notifOn) {
      actions.setSettings({ notifications: false });
      return;
    }
    const perm = await requestNotificationPermission();
    setPermTick((t) => t + 1);
    actions.setSettings({ notifications: perm === 'granted' });
  };

  const handleExactAlarms = async () => {
    await requestExactAlarmPermission();
    setPermTick((t) => t + 1);
  };

  const submitFeedback = (mode) => {
    const text = (feedback || '').trim();
    if (!text) return;
    if (mode === 'copy') {
      navigator.clipboard?.writeText(text).then(
        () => alert('Feedback copied to your clipboard.'),
        () => {}
      );
    } else {
      const url = `mailto:keystone.planner@gmail.com?subject=${encodeURIComponent('Keystone feedback')}&body=${encodeURIComponent(text)}`;
      window.location.href = url;
    }
    setFeedback(null);
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keystone-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        actions.importData(data);
      } catch {
        alert('That file could not be read as a Keystone backup.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const saveStatus = () => {
    const label = editingStatus.label.trim();
    if (!label) return;
    if (editingStatus.id) actions.updateStatus({ id: editingStatus.id, label, color: editingStatus.color });
    else actions.addStatus({ label, color: editingStatus.color });
    setEditingStatus(null);
  };

  const kindColors = { ...DEFAULT_KIND_COLORS, ...(state.settings?.eventKindColors || {}) };
  const saveKindColor = () => {
    actions.setSettings({ eventKindColors: { ...kindColors, [editingKindColor.value]: editingKindColor.color } });
    setEditingKindColor(null);
  };

  const saveEventType = () => {
    const label = editingEventType.label.trim();
    if (!label) return;
    if (editingEventType.id) actions.updateCustomEventType({ id: editingEventType.id, label, color: editingEventType.color });
    else actions.addCustomEventType({ label, color: editingEventType.color });
    setEditingEventType(null);
  };

  // The fixed kinds and someone's own custom types, combined into the one
  // reorderable/hideable list Settings → Calendar → Event types shows.
  // Tapping a row opens whichever editor actually fits it — a fixed kind
  // only ever has its color to change, a custom type has its label too
  // (and can be deleted outright, unlike a fixed kind, which can only be
  // hidden — see EVENT_TYPE_KINDS in helpers.js for why).
  const eventTypeList = [
    ...EVENT_TYPE_KINDS.map((k) => ({ id: k.value, label: k.label, swatch: kindColors[k.value] })),
    ...(state.customEventTypes || []).map((t) => ({ id: t.id, label: t.label, swatch: t.color })),
  ];
  const eventTypeOrder = normalizeEventTypeOrder(state.settings?.eventTypeOrder, state.customEventTypes);
  const openEventTypeEditor = (id) => {
    const fixed = EVENT_TYPE_KINDS.find((k) => k.value === id);
    if (fixed) {
      setEditingKindColor({ value: fixed.value, label: fixed.label, color: kindColors[fixed.value] });
      return;
    }
    const custom = (state.customEventTypes || []).find((t) => t.id === id);
    if (custom) setEditingEventType({ ...custom });
  };

  const counts = {
    goals: state.goals.length,
    events: state.events.length,
    contacts: state.contacts.length,
  };

  const clearCache = async () => {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    window.location.reload();
  };

  const s = state.settings || {};
  const step = (key, delta, min, max) =>
    actions.setSettings({ [key]: Math.max(min, Math.min(max, (s[key] ?? 0) + delta)) });

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-head-row">
          <Brand>More</Brand>
        </div>
        <div className="settings-search">
          <Icon name="search" size={16} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search settings"
            aria-label="Search settings"
          />
          {query && (
            <button className="icon-btn" onClick={() => setQuery('')} aria-label="Clear search">
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      </header>

      {!searching && (isPro ? (
        <button className="pro-bubble-lg pro-bubble-lg--active" onClick={() => navigate('/pro')}>
          <span className="pro-bubble-lg-crown"><Icon name="crown" size={22} /></span>
          <div>
            <strong>Keystone Pro</strong>
            <p className="muted small">
              {isBetaTester
                ? "You have Pro — beta tester access."
                : CLERK_ENABLED && backendConfigured()
                ? 'Unlocked for good — thanks for buying.'
                : 'You have Pro (demo mode) active.'}
            </p>
          </div>
          <span className="pro-bubble-lg-arrow">›</span>
        </button>
      ) : (
        <button className="pro-bubble-lg" onClick={() => navigate('/pricing')}>
          <span className="pro-bubble-lg-crown"><Icon name="crown" size={22} /></span>
          <div>
            <strong>Unlock Keystone Pro</strong>
            <p className="muted small">
              One payment, yours for good — timelines, sharing, sync, themes, and more.
            </p>
          </div>
          <span className="pro-bubble-lg-arrow">›</span>
        </button>
      ))}

      {!searching && CLERK_ENABLED && <AccountSection />}

      <SettingsSection label="Account" hidden={!sectionShown('Account')} />
      <SettingsGroup {...grp('g0')}>
        <div className="section-head">
          <span className="detail-label">Profile</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditingProfile({ name: profileName, photo: profilePhoto })}>
            Edit
          </button>
        </div>
        <div className="profile-row">
          <Avatar name={profileName || 'You'} photo={profilePhoto} size="lg" />
          <div>
            <strong>{profileName || 'Add your name'}</strong>
            <p className="muted small">Stored only on this device.</p>
          </div>
        </div>
      </SettingsGroup>
      <SettingsGroup {...grp('g1')}>
        <span className="detail-label">Account & sync</span>
        <div className="section-head">
          <span>Cloud sync</span>
          <button
            className={`toggle${cloudSyncOn ? ' toggle--on' : ''}`}
            role="switch"
            aria-checked={cloudSyncOn}
            onClick={() => requirePro(() => actions.setSettings({ cloudSync: !cloudSyncOn }))}
          >
            <span className="toggle-knob" />
          </button>
        </div>
        {isPro && CLERK_ENABLED && backendConfigured() ? (
          <CloudSyncStatus cloudSyncOn={cloudSyncOn} />
        ) : (
          <p className="muted small">
            {isPro
              ? "Sync isn't connected to a server yet — flipping this on doesn't move your data anywhere. It's here so the setting is ready once a backend exists."
              : 'Keep your data synced across devices. Requires Pro.'}
          </p>
        )}
        {CLERK_ENABLED ? (
          <GoogleSyncButtons
            isPro={isPro}
            googleConnected={googleConnected}
            requirePro={requirePro}
            actions={actions}
            showToast={showToast}
            state={state}
          />
        ) : (
          <button
            className="btn btn-ghost full"
            onClick={() =>
              requirePro(() => alert('Google sign-in requires a backend that is not connected in this build yet.'))
            }
          >
            <GoogleIcon /> Sign in with Google {!isPro && '· Pro'}
          </button>
        )}
        <p className="muted small">
          {googleConnected
            ? "Calendar (single events only, not repeating ones) stays synced both ways while Keystone is open. Contacts is a one-time import — tap \"Import contacts again\" any time for a fresh copy."
            : 'A personal Keystone login (no Google needed) is free and always available — this is only for connecting your Google Calendar (kept in sync) and Contacts (a one-time import).'}
        </p>
      </SettingsGroup>
      <SettingsGroup {...grp('g2')}>
        <span className="detail-label">Shared calendars</span>
        <p className="muted small">Invite someone to see or add events with you on a calendar you both share.</p>
        <button
          className="btn btn-ghost full"
          onClick={() => (isPro ? navigate('/shared-calendars') : navigate('/pricing'))}
        >
          <Icon name="users" /> Manage shared calendars {!isPro && '· Pro'}
        </button>
      </SettingsGroup>

      <SettingsSection label="Appearance" hidden={!sectionShown('Appearance')} />
      <SettingsGroup {...grp('g4')}>
        <span className="detail-label">Theme &amp; colors</span>
        <div className="seg seg--full">
          {['system', 'light', 'dark'].map((t) => (
            <button
              key={t}
              className={`seg-btn${theme === t ? ' seg-btn--on' : ''}`}
              onClick={() => actions.setSettings({ theme: t })}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <p className="muted small color-scheme-label">Color theme {!isPro && '· Pro'}</p>
        <SchemeRow
          schemes={COLOR_SCHEMES}
          isPro={isPro}
          current={state.settings?.colorScheme || 'default'}
          onPick={(v) => requirePro(() => actions.setSettings({ colorScheme: v }))}
        />
        <p className="muted small color-scheme-label">Pastel</p>
        <SchemeRow
          schemes={PASTEL_SCHEMES}
          isPro={isPro}
          current={state.settings?.colorScheme || 'default'}
          onPick={(v) => requirePro(() => actions.setSettings({ colorScheme: v }))}
        />

        {/* Was just "Contact icon size", which didn't say icon of what, or
            where. It's the photo/initials circle on the People list. */}
        <p className="muted small">Photo size on the People list</p>
        <div className="seg seg--full">
          {[
            { value: 'sm', label: 'Small' },
            { value: 'md', label: 'Medium' },
            { value: 'lg', label: 'Large' },
          ].map((o) => (
            <button
              key={o.value}
              className={`seg-btn${(s.contactIconSize || 'md') === o.value ? ' seg-btn--on' : ''}`}
              onClick={() => actions.setSettings({ contactIconSize: o.value })}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="section-head">
          <span>Task completion animation</span>
          <button
            className={`toggle${(s.taskCompleteAnim ?? true) ? ' toggle--on' : ''}`}
            role="switch"
            aria-checked={s.taskCompleteAnim ?? true}
            onClick={() => actions.setSettings({ taskCompleteAnim: !(s.taskCompleteAnim ?? true) })}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        <div className="section-head">
          <span>Haptic feedback</span>
          <button
            className={`toggle${(s.hapticsEnabled ?? true) ? ' toggle--on' : ''}`}
            role="switch"
            aria-checked={s.hapticsEnabled ?? true}
            onClick={() => actions.setSettings({ hapticsEnabled: !(s.hapticsEnabled ?? true) })}
          >
            <span className="toggle-knob" />
          </button>
        </div>
      </SettingsGroup>
      <SettingsGroup {...grp('g5')}>
        <span className="detail-label">Home screen {!isPro && '· Pro'}</span>
        <p className="muted small">
          Choose which blocks show on Home, and drag to reorder them — or edit this right from the Home page itself
          via the pencil icon in its header.
        </p>
        {isPro ? (
          <ReorderToggleList
            items={normalizeHomeBlocks(s.homeBlocks)}
            types={HOME_BLOCK_TYPES}
            onChange={(next) => actions.setSettings({ homeBlocks: next })}
          />
        ) : (
          <button type="button" className="bubble-reorder-locked" onClick={() => navigate('/pricing')}>
            <ul className="bubble-reorder-list bubble-reorder-list--preview">
              {HOME_BLOCK_TYPES.map((t) => (
                <li key={t.id} className="bubble-reorder-row">
                  <span className="bubble-reorder-icon"><Icon name={t.icon} size={20} /></span>
                  <span className="bubble-reorder-label">{t.label}</span>
                </li>
              ))}
            </ul>
            <span className="bubble-reorder-lock-hint">
              <LockIcon /> Unlock to customize
            </span>
          </button>
        )}
      </SettingsGroup>
      <SettingsGroup {...grp('g6')}>
        <span className="detail-label">Quick-add menu {!isPro && '· Pro'}</span>
        <p className="muted small">Choose which actions the floating + button offers, and drag to reorder them.</p>
        {isPro ? (
          <ReorderToggleList
            items={normalizeQuickAdd(s.quickAdd)}
            types={QUICK_ADD_TYPES}
            onChange={(next) => actions.setSettings({ quickAdd: next })}
          />
        ) : (
          <button type="button" className="bubble-reorder-locked" onClick={() => navigate('/pricing')}>
            <ul className="bubble-reorder-list bubble-reorder-list--preview">
              {QUICK_ADD_TYPES.map((t) => (
                <li key={t.id} className="bubble-reorder-row">
                  <span className="bubble-reorder-icon"><Icon name={t.icon} size={20} /></span>
                  <span className="bubble-reorder-label">{t.label}</span>
                </li>
              ))}
            </ul>
            <span className="bubble-reorder-lock-hint">
              <LockIcon /> Unlock to customize
            </span>
          </button>
        )}
      </SettingsGroup>
      <SettingsGroup {...grp('g7')}>
        <span className="detail-label">Navigation tabs {!isPro && '· Pro'}</span>
        <p className="muted small">Choose which tabs show in the bar, and drag to reorder them. More always stays on.</p>
        {isPro ? (
          <ReorderToggleList
            items={normalizeTabOrder(s.tabOrder)}
            types={TAB_TYPES}
            lockedIds={['more']}
            onChange={(next) => actions.setSettings({ tabOrder: next })}
          />
        ) : (
          <button type="button" className="bubble-reorder-locked" onClick={() => navigate('/pricing')}>
            <ul className="bubble-reorder-list bubble-reorder-list--preview">
              {TAB_TYPES.map((t) => (
                <li key={t.id} className="bubble-reorder-row">
                  <span className="bubble-reorder-label">{t.label}</span>
                </li>
              ))}
            </ul>
            <span className="bubble-reorder-lock-hint">
              <LockIcon /> Unlock to customize
            </span>
          </button>
        )}
      </SettingsGroup>

      <SettingsSection label="Calendar" hidden={!sectionShown('Calendar')} />
      <SettingsGroup {...grp('g8')}>
        <span className="detail-label">Calendar settings</span>

        <div className="section-head">
          <span>24-hour time</span>
          <button
            className={`toggle${s.use24h ? ' toggle--on' : ''}`}
            role="switch"
            aria-checked={!!s.use24h}
            onClick={() => actions.setSettings({ use24h: !s.use24h })}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        <div className="section-head">
          <span>Week starts on Sunday</span>
          <button
            className={`toggle${s.weekStartsSunday ? ' toggle--on' : ''}`}
            role="switch"
            aria-checked={!!s.weekStartsSunday}
            onClick={() => actions.setSettings({ weekStartsSunday: !s.weekStartsSunday })}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        <div className="section-head">
          <span>Show tasks on day timeline</span>
          <button
            className={`toggle${s.showTasksOnTimeline ? ' toggle--on' : ''}`}
            role="switch"
            aria-checked={!!s.showTasksOnTimeline}
            onClick={() => actions.setSettings({ showTasksOnTimeline: !s.showTasksOnTimeline })}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        {/* The two schedule warnings the planner can raise, separately
            switchable — the travel estimate is a guess from straight-line
            distance and some people will want it quiet while still being
            told about a genuine double-booking, which is a fact. */}
        <div className="section-head">
          <span>Warn about overlapping events</span>
          <button
            className={`toggle${s.warnOverlaps !== false ? ' toggle--on' : ''}`}
            role="switch"
            aria-checked={s.warnOverlaps !== false}
            onClick={() => actions.setSettings({ warnOverlaps: s.warnOverlaps === false })}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        <div className="section-head">
          <span>Day & week templates</span>
          <button
            className={`toggle${s.showDayTemplates !== false ? ' toggle--on' : ''}`}
            role="switch"
            aria-checked={s.showDayTemplates !== false}
            onClick={() => actions.setSettings({ showDayTemplates: s.showDayTemplates === false })}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        <div className="section-head">
          <span>Warn about tight travel time</span>
          <button
            className={`toggle${s.warnTravelTime !== false ? ' toggle--on' : ''}`}
            role="switch"
            aria-checked={s.warnTravelTime !== false}
            onClick={() => actions.setSettings({ warnTravelTime: s.warnTravelTime === false })}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        <p className="muted small">Default event length</p>
        <div className="cadence-setting">
          <button className="step-btn" onClick={() => step('defaultEventDuration', -15, 15, 240)} aria-label="Shorter">
            −
          </button>
          <span className="cadence-value">
            <strong>{s.defaultEventDuration ?? 60}</strong> min
          </span>
          <button className="step-btn step-btn--plus" onClick={() => step('defaultEventDuration', 15, 15, 240)} aria-label="Longer">
            +
          </button>
        </div>

        <p className="muted small">Default reminder lead time</p>
        <div className="cadence-setting">
          <button className="step-btn" onClick={() => step('defaultReminderLead', -5, 0, 120)} aria-label="Less lead time">
            −
          </button>
          <span className="cadence-value">
            <strong>{s.defaultReminderLead ?? 0}</strong> min before
          </span>
          <button className="step-btn step-btn--plus" onClick={() => step('defaultReminderLead', 5, 0, 120)} aria-label="More lead time">
            +
          </button>
        </div>

        <p className="muted small">Timeline hours</p>
        <div className="field-row">
          <label className="field">
            <span>Starts</span>
            <Select
              value={s.timelineStartHour ?? 6}
              onChange={(v) =>
                actions.setSettings({
                  timelineStartHour: Math.min(Number(v), (s.timelineEndHour ?? 23) - 1),
                })
              }
              options={HOURS.filter((h) => h.value < (s.timelineEndHour ?? 23))}
            />
          </label>
          <label className="field">
            <span>Ends</span>
            <Select
              value={s.timelineEndHour ?? 23}
              onChange={(v) =>
                actions.setSettings({
                  timelineEndHour: Math.max(Number(v), (s.timelineStartHour ?? 6) + 1),
                })
              }
              options={HOURS.filter((h) => h.value > (s.timelineStartHour ?? 6))}
            />
          </label>
        </div>

        <div onClick={() => !isPro && navigate('/pricing')}>
          <p className="muted small">Event block opacity {!isPro && '· Pro'}</p>
          <input
            type="range"
            min="30"
            max="100"
            step="10"
            value={s.eventBlockOpacity ?? 100}
            onChange={(e) => {
              selectTick();
              requirePro(() => actions.setSettings({ eventBlockOpacity: Number(e.target.value) }));
            }}
            className="range-slider"
            disabled={!isPro}
          />
        </div>
      </SettingsGroup>
      <SettingsGroup {...grp('g15')}>
        <span className="detail-label">Event types</span>
        <p className="muted small">
          Colors for calendar events. Everyone can recolor Call/Text/In Person/Travel/Email/Other
          — reordering, hiding, and adding your own types beyond those is Pro.
        </p>
        {isPro ? (
          <>
            <ReorderToggleList
              items={eventTypeOrder}
              types={eventTypeList}
              onChange={(next) => actions.setSettings({ eventTypeOrder: next })}
              onItemClick={openEventTypeEditor}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setEditingEventType({ label: '', color: PRESET_COLORS[0] })}
            >
              + Custom event
            </button>
          </>
        ) : (
          <>
            <ul className="status-list">
              {EVENT_TYPE_KINDS.map((k) => (
                <li key={k.value}>
                  <button
                    className="status-item"
                    onClick={() => setEditingKindColor({ value: k.value, label: k.label, color: kindColors[k.value] })}
                  >
                    <span className="swatch" style={{ background: kindColors[k.value] }} />
                    <span>{k.label}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="bubble-reorder-locked" onClick={() => navigate('/pricing')}>
              <span className="bubble-reorder-lock-hint">
                <LockIcon /> Unlock to reorder, hide, or add your own types
              </span>
            </button>
          </>
        )}
      </SettingsGroup>
      <SettingsGroup {...grp('g3')}>
        <span className="detail-label">Calendar import / export</span>
        <p className="muted small">Move events to or from other calendar apps using the .ics format.</p>
        <div className="stack-btns">
          <button className="btn btn-ghost full" onClick={() => requirePro(exportICS)}>
            Export calendar (.ics) {!isPro && '· Pro'}
          </button>
          <button className="btn btn-ghost full" onClick={() => requirePro(() => icsFileRef.current?.click())}>
            Import calendar (.ics) {!isPro && '· Pro'}
          </button>
          <input ref={icsFileRef} type="file" accept=".ics,text/calendar" hidden onChange={importICS} />
        </div>
      </SettingsGroup>

      <SettingsSection label="People" hidden={!sectionShown('People')} />
      <SettingsGroup {...grp('g14')}>
        <div className="section-head">
          <span className="detail-label">People groups {!isPro && '· Pro'}</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => requirePro(() => setEditingStatus({ label: '', color: PRESET_COLORS[0] }))}
          >
            + Add
          </button>
        </div>
        <p className="muted small">Groups you sort people into on the People tab.</p>
        <ul className="status-list">
          {state.statuses.map((s) => (
            <li key={s.id}>
              <button className="status-item" onClick={() => requirePro(() => setEditingStatus({ ...s }))}>
                <span className="swatch" style={{ background: s.color }} />
                <span>{s.label}</span>
                <span className="muted count-tag">
                  {state.contacts.filter((c) => c.statusId === s.id).length}
                </span>
              </button>
            </li>
          ))}
          {state.statuses.length === 0 && <li className="muted small">No statuses yet.</li>}
        </ul>
      </SettingsGroup>
      <SettingsGroup {...grp('gswipe')}>
        <span className="detail-label">People swipe actions</span>
        <p className="muted small">
          What swiping a row on the People tab does. Deleting someone is still available from
          their own page and from Select mode, so it doesn't have to live on a swipe.
        </p>
        <p className="muted small">Swipe right</p>
        <Select
          value={s.contactSwipeRight ?? DEFAULT_CONTACT_SWIPE_RIGHT}
          onChange={(v) => actions.setSettings({ contactSwipeRight: v })}
          options={CONTACT_SWIPE_OPTIONS}
        />
        <p className="muted small">Swipe left</p>
        <Select
          value={s.contactSwipeLeft ?? DEFAULT_CONTACT_SWIPE_LEFT}
          onChange={(v) => actions.setSettings({ contactSwipeLeft: v })}
          options={CONTACT_SWIPE_OPTIONS}
        />
      </SettingsGroup>
      <SettingsGroup {...grp('g19')}>
        <span className="detail-label">Contact import / export</span>
        <p className="muted small">Move people to or from other address book apps using the .vcf format.</p>
        <div className="stack-btns">
          <button className="btn btn-ghost full" onClick={exportContactsVCF}>
            Export contacts (.vcf)
          </button>
          <button className="btn btn-ghost full" onClick={() => vcfFileRef.current?.click()}>
            Import contacts (.vcf)
          </button>
          <input ref={vcfFileRef} type="file" accept=".vcf,text/vcard" hidden onChange={importContactsVCF} />
        </div>
      </SettingsGroup>
      <SettingsGroup {...grp('g13')}>
        <span className="detail-label">Contact notifications</span>
        <div className="section-head">
          <span>Birthdays & anniversaries</span>
          <button
            className={`toggle${s.contactBirthdaysEnabled !== false ? ' toggle--on' : ''}`}
            role="switch"
            aria-checked={s.contactBirthdaysEnabled !== false}
            onClick={() => actions.setSettings({ contactBirthdaysEnabled: s.contactBirthdaysEnabled === false })}
          >
            <span className="toggle-knob" />
          </button>
        </div>
        <p className="muted small">
          Surface a person's birthday or anniversary on Home and the calendar, and send a
          reminder notification the morning of. Each date is still optional per person —
          set them from a contact's Edit sheet.
        </p>
        <div className="section-head">
          <span>Reconnect reminders</span>
          <button
            className={`toggle${s.reconnectRemindersEnabled === true ? ' toggle--on' : ''}`}
            role="switch"
            aria-checked={s.reconnectRemindersEnabled === true}
            onClick={() =>
              actions.setSettings({ reconnectRemindersEnabled: s.reconnectRemindersEnabled !== true })
            }
          >
            <span className="toggle-knob" />
          </button>
        </div>
        <p className="muted small">
          Flag people on the People tab when you haven't been in touch for this long.
          Only applies to people you've actually logged contact with — someone you've
          added but never spoken to has no lapse to report. You can override the
          interval per person.
        </p>
        {s.reconnectRemindersEnabled === true && (
        <div className="cadence-setting">
          <button
            className="step-btn"
            onClick={() =>
              actions.setSettings({ reconnectDays: Math.max(1, (state.settings?.reconnectDays ?? 30) - 5) })
            }
            aria-label="Fewer days"
          >
            −
          </button>
          <span className="cadence-value">
            <strong>{state.settings?.reconnectDays ?? 30}</strong> days
          </span>
          <button
            className="step-btn step-btn--plus"
            onClick={() =>
              actions.setSettings({ reconnectDays: Math.min(365, (state.settings?.reconnectDays ?? 30) + 5) })
            }
            aria-label="More days"
          >
            +
          </button>
        </div>
        )}
      </SettingsGroup>

      <SettingsSection label="Map" hidden={!sectionShown('Map')} />
      <SettingsGroup {...grp('g9')}>
        <span className="detail-label">Map settings</span>
        <p className="muted small">Map style</p>
        <Select
          value={s.mapStyle || 'auto'}
          onChange={(v) => actions.setSettings({ mapStyle: v })}
          options={MAP_STYLE_OPTIONS}
        />
        <p className="muted small">
          "Match app theme" uses a light or dark basemap to match whichever the app is showing —
          a bright white map inside a dark app is the thing most worth avoiding here.
        </p>
        <div className="section-head">
          <span>Show contact places</span>
          <button
            className={`toggle${s.mapShowContactPins ?? true ? ' toggle--on' : ''}`}
            role="switch"
            aria-checked={s.mapShowContactPins ?? true}
            onClick={() => actions.setSettings({ mapShowContactPins: !(s.mapShowContactPins ?? true) })}
          >
            <span className="toggle-knob" />
          </button>
        </div>
        <div className="section-head">
          <span>Show custom places</span>
          <button
            className={`toggle${s.mapShowCustomPins ?? true ? ' toggle--on' : ''}`}
            role="switch"
            aria-checked={s.mapShowCustomPins ?? true}
            onClick={() => actions.setSettings({ mapShowCustomPins: !(s.mapShowCustomPins ?? true) })}
          >
            <span className="toggle-knob" />
          </button>
        </div>
        <p className="muted small">Pin emoji size</p>
        <input
          type="range"
          min="70"
          max="160"
          step="10"
          value={s.mapEmojiSize ?? 100}
          onChange={(e) => {
            selectTick();
            actions.setSettings({ mapEmojiSize: Number(e.target.value) });
          }}
          className="range-slider"
        />
      </SettingsGroup>
      <SettingsGroup {...grp('g11')}>
        <div className="section-head">
          <span className="detail-label">Arrival reminders</span>
          <button
            className={`toggle${state.settings?.locationRemindersEnabled ? ' toggle--on' : ''}`}
            role="switch"
            aria-checked={!!state.settings?.locationRemindersEnabled}
            onClick={() =>
              actions.setSettings({ locationRemindersEnabled: !state.settings?.locationRemindersEnabled })
            }
            disabled={!geoAvailable()}
          >
            <span className="toggle-knob" />
          </button>
        </div>
        <p className="muted small">
          {geoAvailable()
            ? 'Get notified when you’re near a place you’ve pinned on the Map with a reminder radius set. Only works while Keystone is open or freshly backgrounded — true background tracking needs a permission this build doesn’t request yet.'
            : 'This device doesn’t support location.'}
        </p>
      </SettingsGroup>

      <SettingsSection label="Notifications" hidden={!sectionShown('Notifications')} />
      <SettingsGroup {...grp('g10')}>
        <div className="section-head">
          <span className="detail-label">Allow notifications</span>
          <button
            className={`toggle${notifOn ? ' toggle--on' : ''}`}
            role="switch"
            aria-checked={notifOn}
            onClick={toggleNotifications}
            disabled={!notificationsSupported()}
          >
            <span className="toggle-knob" />
          </button>
        </div>
        <p className="muted small">
          {notificationsSupported()
            ? Capacitor.isNativePlatform()
              ? 'Get reminders for goals, events, and tasks — these still fire even if Keystone is fully closed.'
              : 'Get reminders for goals and events while Keystone is open. (A web app can’t alert you once it’s fully closed.)'
            : 'This browser doesn’t support notifications.'}
        </p>
        {notifOn && exactAlarmsConfigurable() && exactAlarmPermission() !== 'granted' && (
          <>
            <p className="muted small">
              One more Android setting is needed for reminders to fire at the exact time while Keystone is
              closed — without it, Android can delay them.
            </p>
            <button className="btn btn-ghost full" onClick={handleExactAlarms}>
              Enable exact-time reminders
            </button>
          </>
        )}
      </SettingsGroup>

      <SettingsSection label="App" hidden={!sectionShown('App')} />
      {AI_ENABLED && (
        <SettingsGroup {...grp('gai')}>
          <div className="section-head">
            <span className="detail-label">Assistant</span>
            <button
              className={`toggle${s.assistantEnabled !== false ? ' toggle--on' : ''}`}
              role="switch"
              aria-checked={s.assistantEnabled !== false}
              onClick={() => actions.setSettings({ assistantEnabled: s.assistantEnabled === false })}
            >
              <span className="toggle-knob" />
            </button>
          </div>
          <p className="muted small">
            A chat bubble that can read your calendar, tasks and people, and add things for you —
            anything it adds can be undone from the chat. Needs Pro and a signed-in account, and it
            only appears when the server it talks to has been set up for it. What you ask goes to
            Anthropic's Claude along with a summary of your schedule and the names of your contacts;
            notes, phone numbers and photos are never sent unless you ask about them.
          </p>
        </SettingsGroup>
      )}
      <SettingsGroup {...grp('g16')}>
        <span className="detail-label">Feedback</span>
        <p className="muted small">Have an idea or found a bug? I'd love to hear it.</p>
        <div className="stack-btns">
          <button className="btn btn-ghost full" onClick={() => setFeedback('')}>
            <Icon name="lightbulb" /> Send feedback / suggest a feature
          </button>
          {/* The tour narrates the Home screen, so it goes there rather
              than playing on top of Settings. App.jsx owns the Tutorial for
              both the first run and this replay, so there's one code path. */}
          <button
            className="btn btn-ghost full"
            onClick={() => navigate('/', { state: { replayTour: true } })}
          >
            <Icon name="play" /> Replay the tour
          </button>
        </div>
      </SettingsGroup>
      <SettingsGroup {...grp('g17')}>
        <span className="detail-label">Your data</span>
        <p className="muted small">
          Everything is stored privately on this device. {counts.goals} goals · {counts.events} events ·{' '}
          {counts.contacts} people.
        </p>
        <div className="stack-btns">
          <button className="btn btn-ghost full" onClick={exportData}>
            Export backup (.json)
          </button>
          <button className="btn btn-ghost full" onClick={() => fileRef.current?.click()}>
            Import backup
          </button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={importData} />
          <button className="btn btn-ghost full" onClick={() => setConfirm('reset')}>
            Reset to sample data
          </button>
          <button className="btn btn-danger-ghost full" onClick={() => setConfirm('clearCache')}>
            Clear cache
          </button>
          <button className="btn btn-danger-ghost full" onClick={() => setConfirm('clearContacts')}>
            Remove all contacts
          </button>
          <button className="btn btn-danger-ghost full" onClick={() => setConfirm('clear')}>
            Clear everything
          </button>
        </div>
      </SettingsGroup>
      <SettingsGroup {...grp('g18')}>
        <span className="detail-label">Legal</span>
        <div className="stack-btns">
          <button className="btn btn-ghost full" onClick={() => navigate('/privacy')}>
            Privacy Policy
          </button>
          <button className="btn btn-ghost full" onClick={() => navigate('/terms')}>
            Terms of Service
          </button>
        </div>
      </SettingsGroup>


      {searching && shown.size === 0 && (
        <p className="muted center-pad">No settings match "{query.trim()}".</p>
      )}

      {!searching && <p className="muted small center-pad">Keystone · works offline · v0.2</p>}

      {/* Group editor */}
      <Modal
        open={!!editingStatus}
        title={editingStatus?.id ? 'Edit group' : 'New group'}
        onClose={() => setEditingStatus(null)}
        fullPage
        footer={
          <div className="modal-actions">
            {editingStatus?.id && (
              <button
                className="btn btn-danger-ghost"
                onClick={() => {
                  actions.deleteStatus(editingStatus.id);
                  setEditingStatus(null);
                }}
              >
                Delete
              </button>
            )}
            <button className="btn btn-primary" onClick={saveStatus}>
              Save
            </button>
          </div>
        }
      >
        {editingStatus && (
          <div className="form">
            <label className="field">
              <span>Label</span>
              <input
                autoFocus
                value={editingStatus.label}
                onChange={(e) => setEditingStatus({ ...editingStatus, label: e.target.value })}
                placeholder="e.g. Close, Reconnect"
              />
            </label>
            <div className="field">
              <span>Color</span>
              <div className="color-grid">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`color-dot${editingStatus.color === c ? ' color-dot--on' : ''}`}
                    style={{ background: c }}
                    onClick={() => setEditingStatus({ ...editingStatus, color: c })}
                    aria-label={`Choose ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Event kind color editor */}
      <Modal
        open={!!editingKindColor}
        title={editingKindColor?.label}
        onClose={() => setEditingKindColor(null)}
        fullPage
        footer={
          <button className="btn btn-primary" onClick={saveKindColor}>
            Save
          </button>
        }
      >
        {editingKindColor && (
          <div className="form">
            <div className="field">
              <span>Color</span>
              <div className="color-grid">
                {(PRESET_COLORS.includes(editingKindColor.color)
                  ? PRESET_COLORS
                  : [...PRESET_COLORS, editingKindColor.color]
                ).map((c) => (
                  <button
                    key={c}
                    className={`color-dot${editingKindColor.color === c ? ' color-dot--on' : ''}`}
                    style={{ background: c }}
                    onClick={() => setEditingKindColor({ ...editingKindColor, color: c })}
                    aria-label={`Choose ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Custom event type editor */}
      <Modal
        open={!!editingEventType}
        title={editingEventType?.id ? 'Edit event type' : 'New event type'}
        onClose={() => setEditingEventType(null)}
        fullPage
        footer={
          <div className="modal-actions">
            {editingEventType?.id && (
              <button
                className="btn btn-danger-ghost"
                onClick={() => {
                  actions.deleteCustomEventType(editingEventType.id);
                  setEditingEventType(null);
                }}
              >
                Delete
              </button>
            )}
            <button className="btn btn-primary" onClick={saveEventType}>
              Save
            </button>
          </div>
        }
      >
        {editingEventType && (
          <div className="form">
            <label className="field">
              <span>Label</span>
              <input
                autoFocus
                value={editingEventType.label}
                onChange={(e) => setEditingEventType({ ...editingEventType, label: e.target.value })}
                placeholder="e.g. Gym, Doctor, Errand"
              />
            </label>
            <div className="field">
              <span>Color</span>
              <div className="color-grid">
                {(PRESET_COLORS.includes(editingEventType.color)
                  ? PRESET_COLORS
                  : [...PRESET_COLORS, editingEventType.color]
                ).map((c) => (
                  <button
                    key={c}
                    className={`color-dot${editingEventType.color === c ? ' color-dot--on' : ''}`}
                    style={{ background: c }}
                    onClick={() => setEditingEventType({ ...editingEventType, color: c })}
                    aria-label={`Choose ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Feedback */}
      <Modal
        open={feedback !== null}
        title="Send feedback"
        onClose={() => setFeedback(null)}
        fullPage
        footer={
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => submitFeedback('copy')}>
              Copy
            </button>
            <button className="btn btn-primary" onClick={() => submitFeedback('email')}>
              Email it
            </button>
          </div>
        }
      >
        <div className="form">
          <label className="field">
            <span>What's on your mind?</span>
            <textarea
              autoFocus
              rows="5"
              value={feedback || ''}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="A feature idea, something confusing, a bug you hit…"
            />
          </label>
          <p className="muted small">
            "Email it" opens your mail app with the note ready to send. "Copy" puts it on your clipboard.
          </p>
        </div>
      </Modal>

      {/* Confirm reset / clear / clear cache / remove contacts */}
      <Modal
        open={['reset', 'clear', 'clearCache', 'clearContacts'].includes(confirm)}
        title={DESTRUCTIVE_ACTIONS[confirm]?.title}
        onClose={() => setConfirm(null)}
        footer={
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (confirm === 'reset') actions.resetData();
                else if (confirm === 'clear') actions.clearData();
                else if (confirm === 'clearContacts') actions.clearContacts();
                else if (confirm === 'clearCache') return clearCache();
                setConfirm(null);
              }}
            >
              {DESTRUCTIVE_ACTIONS[confirm]?.cta}
            </button>
          </div>
        }
      >
        <p>{DESTRUCTIVE_ACTIONS[confirm]?.body}</p>
      </Modal>

      {/* Profile editor */}
      <Modal
        open={!!editingProfile}
        title="Edit profile"
        onClose={() => setEditingProfile(null)}
        fullPage
        footer={
          <div className="modal-actions">
            <button
              className="btn btn-primary"
              onClick={() => {
                actions.setSettings({ profileName: editingProfile.name.trim(), profilePhoto: editingProfile.photo || '' });
                setEditingProfile(null);
              }}
            >
              Save
            </button>
          </div>
        }
      >
        {editingProfile && (
          <div className="form">
            <AvatarPicker
              name={editingProfile.name || 'You'}
              photo={editingProfile.photo}
              onChange={(photo) => setEditingProfile({ ...editingProfile, photo })}
            />
            <label className="field">
              <span>Name</span>
              <input
                autoFocus
                value={editingProfile.name}
                onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                placeholder="Your name"
              />
            </label>
          </div>
        )}
      </Modal>

    </div>
  );
}

function AccountSection() {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleDeleteAccount = async () => {
    setDeleteError('');
    setDeleting(true);
    try {
      await deleteAccount(getToken);
      await clerk.signOut();
      navigate('/', { replace: true });
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
    }
  };

  return (
    <section className="detail-section">
      <span className="detail-label">Account</span>
      {isSignedIn ? (
        <>
          <div className="profile-row">
            <UserButton afterSignOutUrl="/" />
            <div>
              <strong>{user?.primaryEmailAddress?.emailAddress || 'Signed in'}</strong>
              <p className="muted small">Your Pro purchase is tied to this account.</p>
            </div>
          </div>
          <button type="button" className="btn btn-ghost full" onClick={() => clerk.signOut()}>
            Sign out
          </button>
          <button
            type="button"
            className="btn btn-danger-ghost full"
            onClick={() => setConfirmDelete(true)}
          >
            Delete account
          </button>
          <Modal
            open={confirmDelete}
            title="Delete your account?"
            onClose={() => (deleting ? null : setConfirmDelete(false))}
            footer={
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                  Cancel
                </button>
                <button className="btn btn-danger" onClick={handleDeleteAccount} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Delete account'}
                </button>
              </div>
            }
          >
            <p>
              This permanently deletes your Keystone account, your Pro purchase record, and
              everything stored on the server for it — cloud-synced data and any shared calendars
              you own. It can't be undone.
            </p>
            <p className="muted small">
              Data already saved on this device isn't touched — that's a separate, local action
              under Settings → Your data if you want it gone too.
            </p>
            {deleteError && <p className="muted small">{deleteError}</p>}
          </Modal>
        </>
      ) : (
        <>
          <p className="muted small">
            Sign in to buy Pro, sync your data, and keep your purchase across devices.
          </p>
          <button className="btn btn-ghost full" onClick={() => clerk.openSignIn()}>
            Sign in
          </button>
        </>
      )}
    </section>
  );
}

// Owns everything that needs a Clerk token (connect/import/disconnect) so
// it can call useAuth() safely — only ever mounted when CLERK_ENABLED, same
// as AccountSection/CloudSyncStatus below, since <ClerkProvider> itself is
// only rendered under that same condition (main.jsx). MorePage's own render
// always runs regardless of CLERK_ENABLED, so useAuth() can't live there.
function GoogleSyncButtons({ isPro, googleConnected, requirePro, actions, showToast, state }) {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // The redirect back from Google's consent screen (see
  // backend/src/routes/google.js's /callback) — mark it connected, pull the
  // first import, and strip the param so a refresh doesn't re-import.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const google = params.get('google');
    if (!google) return;
    navigate('/more', { replace: true });
    if (google === 'connected') {
      actions.setSettings({ googleConnected: true });
      reimportContacts();
    } else {
      showToast('Connecting Google didn’t work — try again.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redirects the browser to Google's consent screen; it comes back to
  // /#/more?google=connected, picked up by the effect above.
  const connectGoogle = async () => {
    try {
      const { url } = await googleAuthUrl(getToken);
      window.location.href = url;
    } catch (err) {
      alert(err.message);
    }
  };

  // Pulls a fresh one-time Contacts import and merges it the same way
  // importVCard's file picker does (data/vcard.js's parseVCard) — same
  // target shapes, just fed from the backend instead of a local file.
  //
  // Calendar is deliberately NOT pulled here, even though the backend's
  // /import response includes it — that's entirely handled by the ongoing
  // two-way sync in data/googleCalendarSync.js instead, which does its own
  // full first pull the moment googleConnected flips true (see App.jsx's
  // GoogleCalendarSync). Importing events here too would create duplicates
  // once that sync also creates them, since the two paths don't share any
  // bookkeeping (this one has no concept of a googleEventId snapshot).
  const reimportContacts = async () => {
    try {
      const { contacts } = await importGoogleData(getToken);
      for (const c of contacts) {
        actions.addContact({
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
        });
      }
      showToast(`Imported ${contacts.length} contact${contacts.length === 1 ? '' : 's'} from Google.`);
    } catch (err) {
      showToast(err.message);
    }
  };

  const disconnectGoogleAccount = async () => {
    if (!confirm('Disconnect Google? You can reconnect any time to import again.')) return;
    try {
      await disconnectGoogle(getToken);
      actions.setSettings({ googleConnected: false });
    } catch (err) {
      alert(err.message);
    }
  };

  if (isPro && backendConfigured() && googleConnected) {
    return (
      <>
        <button className="btn btn-ghost full" onClick={() => requirePro(reimportContacts)}>
          <GoogleIcon /> Import contacts again
        </button>
        <button className="btn btn-ghost full" onClick={disconnectGoogleAccount}>
          Disconnect Google
        </button>
      </>
    );
  }
  return (
    <button
      className="btn btn-ghost full"
      onClick={() =>
        requirePro(() =>
          backendConfigured()
            ? connectGoogle()
            : alert('Google sign-in requires a backend that is not connected in this build yet.')
        )
      }
    >
      <GoogleIcon /> Sign in with Google {!isPro && '· Pro'}
    </button>
  );
}

// Says what the sync is actually doing, rather than asserting that it works.
// "Your data syncs automatically" is a claim; "Last synced 2 min ago" is
// evidence, and when something is wrong it's the difference between noticing
// and not.
function CloudSyncStatus({ cloudSyncOn }) {
  const { isSignedIn } = useAuth();
  const status = useSyncStatus();
  // Re-render on a slow tick so "3 min ago" doesn't sit there saying "just
  // now" for the rest of the session.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  if (!cloudSyncOn) {
    return <p className="muted small">Keep your data synced across devices.</p>;
  }
  if (!isSignedIn) {
    return <p className="muted small">Sign in above to start syncing your data to your account.</p>;
  }
  if (status.phase === 'error') {
    return (
      <p className="muted small">
        Couldn't reach the server — changes are saved on this device and will sync when it's back.
      </p>
    );
  }
  return (
    <p className="muted small">
      {status.phase === 'syncing' ? 'Syncing…' : `Last synced ${describeSyncedAt(status.at)}`} · every
      device you're signed in on stays in step.
    </p>
  );
}

// One row of colour-scheme swatches. Shared by the standard and pastel rows
// so the lock/selection behaviour can't drift between them.
function SchemeRow({ schemes, isPro, current, onPick }) {
  return (
    <div className="scheme-grid">
      {schemes.map((s) => {
        const locked = !isPro && s.value !== 'default';
        const on = current === s.value;
        return (
          <button
            key={s.value}
            className={`scheme-dot${on ? ' scheme-dot--on' : ''}${locked ? ' scheme-dot--locked' : ''}`}
            style={{ background: s.swatch }}
            onClick={() => onPick(s.value)}
            title={s.label}
            aria-label={s.label}
          >
            {locked && <LockIcon />}
          </button>
        );
      })}
    </div>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" fill="currentColor" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M21.6 12.23c0-.68-.06-1.36-.18-2H12v3.79h5.4a4.62 4.62 0 0 1-2 3.03v2.5h3.23c1.9-1.75 2.97-4.33 2.97-7.32z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.97-.89 6.63-2.42l-3.23-2.5c-.9.6-2.05.96-3.4.96-2.6 0-4.8-1.76-5.6-4.12H3.06v2.58A10 10 0 0 0 12 22z"
        fill="#34A853"
      />
      <path d="M6.4 13.92a5.99 5.99 0 0 1 0-3.84V7.5H3.06a10 10 0 0 0 0 9l3.34-2.58z" fill="#FBBC05" />
      <path
        d="M12 6.04c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.5l3.34 2.58C7.2 7.8 9.4 6.04 12 6.04z"
        fill="#EA4335"
      />
    </svg>
  );
}

import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, useActions } from '../data/store.jsx';
import EditorSheet from '../components/EditorSheet.jsx';
import Checkbox from '../components/Checkbox.jsx';
import { Brand } from '../components/Logo.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../data/toast.jsx';
import { todayISO } from '../data/helpers.js';

// Fixed pale tints rather than theme colours — a tinted note forces dark
// text (see .note-card--tinted), so every swatch has to stay light enough
// to read against in either theme. Same set as Home's note editor, kept in
// step deliberately — a note picks its color once and it should look the
// same wherever it's shown.
const NOTE_COLORS = [
  '',
  '#fdf2c9', // butter
  '#ffe3cc', // apricot
  '#ffd6d6', // coral
  '#ffe1e6', // pink
  '#f3e0ff', // violet
  '#e6e6fa', // lavender
  '#dceeff', // sky
  '#cfeef5', // cyan
  '#e1f3ee', // mint
  '#e4f7d4', // sage
  '#f0e9d8', // sand
  '#e6eaf0', // stone
];

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M4 12l5 5 11-11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// A dedicated, searchable home for every note — Home's own notes block only
// ever shows general (unattached) notes, compact, with nothing to search.
// This is the Keep-style full picture: every note including the ones
// written from a contact's timeline (tagged so it's clear where they came
// from), searchable, pinned ones separated from the rest.
export default function NotesPage() {
  const { state } = useStore();
  const actions = useActions();
  const navigate = useNavigate();
  const showToast = useToast();
  const today = todayISO();
  const [query, setQuery] = useState('');

  const contactById = useMemo(
    () => Object.fromEntries((state.contacts || []).map((c) => [c.id, c])),
    [state.contacts]
  );

  const { pinned, others } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (n) => {
      if (!q) return true;
      const inChecklist = (n.checklist || []).some((item) => item.text?.toLowerCase().includes(q));
      return n.title?.toLowerCase().includes(q) || n.body?.toLowerCase().includes(q) || inChecklist;
    };
    const all = (state.notes || []).filter(matches);
    return {
      pinned: all.filter((n) => n.pinned),
      others: all.filter((n) => !n.pinned),
    };
  }, [state.notes, query]);

  const [editingNote, setEditingNote] = useState(null);
  const initialNoteJson = useRef('');
  const [poppedChecklistIdx, setPoppedChecklistIdx] = useState(null);
  const checklistPopTimer = useRef(null);

  const openNewNote = () => {
    const d = { title: '', body: '', checklist: null, color: '', pinned: false };
    setEditingNote(d);
    initialNoteJson.current = JSON.stringify(d);
  };
  const openEditNote = (n) => {
    setEditingNote({ ...n });
    initialNoteJson.current = JSON.stringify(n);
  };
  const noteDirty = editingNote ? JSON.stringify(editingNote) !== initialNoteJson.current : false;
  const deleteNoteWithUndo = (n) => {
    actions.deleteNote(n.id);
    showToast(`"${n.title || 'Note'}" deleted`, 'Undo', () => actions.addNote(n));
  };
  const saveNote = () => {
    if (!editingNote.title.trim() && !editingNote.body.trim() && !(editingNote.checklist || []).length) {
      setEditingNote(null);
      return;
    }
    const payload = { ...editingNote, updatedAt: today };
    if (editingNote.id) actions.updateNote(payload);
    else actions.addNote({ ...payload, createdAt: today });
    setEditingNote(null);
  };
  const toggleChecklist = (checked) => {
    setEditingNote((n) => ({ ...n, checklist: checked ? [] : null }));
  };
  const addChecklistItem = () => {
    setEditingNote((n) => ({ ...n, checklist: [...(n.checklist || []), { text: '', done: false }] }));
  };

  const renderNoteCard = (n) => {
    const linkedContact = n.contactId ? contactById[n.contactId] : null;
    return (
      <button
        key={n.id}
        className={`note-card${n.color ? ' note-card--tinted' : ''}`}
        style={n.color ? { background: n.color } : undefined}
        onClick={() => openEditNote(n)}
      >
        {n.pinned && <span className="note-pin"><Icon name="bookmark" size={14} /></span>}
        {n.title && <strong className="note-title">{n.title}</strong>}
        {n.checklist ? (
          <ul className="note-checklist">
            {n.checklist.slice(0, 5).map((item, i) => (
              <li key={i} className={item.done ? 'note-check--done' : ''}>
                <span className={`note-check-box${item.done ? ' note-check-box--on' : ''}`}>
                  {item.done ? <Icon name="check" size={12} /> : null}
                </span>
                {item.text || 'Item'}
              </li>
            ))}
          </ul>
        ) : (
          <p className="note-body">{n.body}</p>
        )}
        {linkedContact && (
          <span className="note-contact-tag muted small">
            <Icon name="person" size={12} /> {linkedContact.name}
          </span>
        )}
      </button>
    );
  };

  const totalCount = pinned.length + others.length;

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-head-row">
          <button className="icon-btn" onClick={() => navigate('/')} aria-label="Back">
            <Icon name="chevronLeft" size={22} />
          </button>
          <Brand>Notes</Brand>
        </div>
        <input
          className="search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes"
        />
      </header>

      {totalCount === 0 ? (
        <div className="empty">
          <div className="empty-icon"><Icon name="note" size={48} /></div>
          <h2>{query ? 'No matching notes' : 'No notes yet'}</h2>
          <p className="muted">
            {query ? 'Try a different search.' : 'Tap the + button to jot something down.'}
          </p>
        </div>
      ) : (
        <>
          {pinned.length > 0 && (
            <section className="detail-section">
              <div className="section-head">
                <span className="detail-label"><Icon name="bookmark" size={14} /> Pinned</span>
              </div>
              <div className="notes-grid">{pinned.map(renderNoteCard)}</div>
            </section>
          )}
          {others.length > 0 && (
            <section className="detail-section">
              {pinned.length > 0 && (
                <div className="section-head">
                  <span className="detail-label">Others</span>
                </div>
              )}
              <div className="notes-grid">{others.map(renderNoteCard)}</div>
            </section>
          )}
        </>
      )}

      <button className="fab" onClick={openNewNote} aria-label="Add note">
        <Icon name="plus" size={26} />
      </button>

      <EditorSheet
        open={!!editingNote}
        title={editingNote?.id ? 'Edit note' : 'New note'}
        dirty={noteDirty}
        onSave={saveNote}
        onDiscard={() => setEditingNote(null)}
        danger={
          editingNote?.id
            ? { label: 'Delete note', onClick: () => { deleteNoteWithUndo(editingNote); setEditingNote(null); } }
            : undefined
        }
      >
        {editingNote && (
          <div className="form">
            <label className="field">
              <span>Title</span>
              <input
                value={editingNote.title}
                onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                placeholder="Optional"
              />
            </label>

            <label className="check-row">
              <Checkbox
                checked={!!editingNote.checklist}
                onChange={(e) => toggleChecklist(e.target.checked)}
                ariaLabel="Checklist"
              />
              <span>Checklist</span>
            </label>

            {editingNote.checklist ? (
              <div className="field">
                {editingNote.checklist.map((item, i) => (
                  <div className="checklist-row" key={i}>
                    <button
                      type="button"
                      className={`task-check${item.done ? ' task-check--on' : ''}${poppedChecklistIdx === i ? ' task-check--pop' : ''}`}
                      data-haptic={item.done ? 'tap' : 'confirm'}
                      onClick={() => {
                        const next = editingNote.checklist.slice();
                        const nowDone = !next[i].done;
                        next[i] = { ...next[i], done: nowDone };
                        setEditingNote({ ...editingNote, checklist: next });
                        clearTimeout(checklistPopTimer.current);
                        if (nowDone) {
                          setPoppedChecklistIdx(i);
                          checklistPopTimer.current = setTimeout(() => setPoppedChecklistIdx(null), 500);
                        } else {
                          setPoppedChecklistIdx(null);
                        }
                      }}
                    >
                      {item.done && <CheckIcon />}
                      <span className="task-check-sparkles" aria-hidden="true">
                        <i /><i /><i /><i /><i /><i />
                      </span>
                    </button>
                    <input
                      value={item.text}
                      onChange={(e) => {
                        const next = editingNote.checklist.slice();
                        next[i] = { ...next[i], text: e.target.value };
                        setEditingNote({ ...editingNote, checklist: next });
                      }}
                      placeholder="List item"
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => {
                        const next = editingNote.checklist.filter((_, idx) => idx !== i);
                        setEditingNote({ ...editingNote, checklist: next });
                      }}
                      aria-label="Remove item"
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                ))}
                <button type="button" className="btn btn-ghost btn-sm" onClick={addChecklistItem}>
                  + Add item
                </button>
              </div>
            ) : (
              <label className="field">
                <span>Note</span>
                <textarea
                  rows="6"
                  value={editingNote.body}
                  onChange={(e) => setEditingNote({ ...editingNote, body: e.target.value })}
                  placeholder="Write something…"
                />
              </label>
            )}

            <div className="field">
              <span>Color</span>
              <div className="color-grid note-color-grid">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c || 'none'}
                    type="button"
                    className={`color-dot${!c ? ' color-dot--clear' : ''}${editingNote.color === c ? ' color-dot--on' : ''}`}
                    style={c ? { background: c } : undefined}
                    onClick={() => setEditingNote({ ...editingNote, color: c })}
                  >
                    {!c && <Icon name="close" size={15} />}
                  </button>
                ))}
              </div>
            </div>

            <label className="check-row">
              <Checkbox
                checked={!!editingNote.pinned}
                onChange={(e) => setEditingNote({ ...editingNote, pinned: e.target.checked })}
                ariaLabel="Pin to top"
              />
              <span>Pin to top</span>
            </label>
          </div>
        )}
      </EditorSheet>
    </div>
  );
}

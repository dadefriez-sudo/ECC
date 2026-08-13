import { useEffect, useMemo, useRef, useState } from 'react';

// An app-styled replacement for the native <select>, so dropdowns look and
// feel consistent everywhere instead of the browser's default picker UI.
// options: [{ value, label, color? }]
// `searchable`: adds a filter box at the top of the sheet — worth it once a
// list is long enough that scanning beats scrolling (e.g. picking a contact
// out of dozens), not worth the extra tap for a handful of fixed options.
// `multiple`: value/onChange work with an array of values instead of one —
// picking an option toggles it in the array and the sheet stays open (a
// list of choices, not a single pick), with its own Done button to close.
export default function Select({ value, onChange, options, placeholder = 'Choose…', disabled, searchable, multiple }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selectedValues = multiple ? (Array.isArray(value) ? value : []) : null;
  const current = multiple ? null : options.find((o) => o.value === value);
  // When the sheet closes because an option was picked, the trigger button
  // is left sitting right under the finger/cursor — some browsers deliver a
  // follow-up "ghost" click to whatever is now there, instantly reopening
  // the sheet. Swallow one click on the trigger right after closing.
  const suppressReopenRef = useRef(false);
  const closeFromSelection = () => {
    setOpen(false);
    suppressReopenRef.current = true;
    setTimeout(() => {
      suppressReopenRef.current = false;
    }, 350);
  };

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const visibleOptions = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, searchable, query]);

  return (
    <>
      <button
        type="button"
        className="select-trigger"
        onClick={() => {
          if (suppressReopenRef.current) return;
          if (!disabled) setOpen(true);
        }}
        disabled={disabled}
      >
        <span className="select-trigger-label">
          {multiple ? (
            selectedValues.length === 0 ? (
              <span className="muted">{placeholder}</span>
            ) : selectedValues.length === 1 ? (
              options.find((o) => o.value === selectedValues[0])?.label
            ) : (
              `${selectedValues.length} selected`
            )
          ) : (
            <>
              {current?.color && <span className="select-swatch" style={{ background: current.color }} />}
              {current ? current.label : <span className="muted">{placeholder}</span>}
            </>
          )}
        </span>
        <ChevronDown />
      </button>

      {open && (
        <div className="select-backdrop" onClick={closeFromSelection}>
          <div className="select-sheet" role="listbox" onClick={(e) => e.stopPropagation()}>
            <div className="select-grip">
              <span className="modal-handle" />
            </div>
            {searchable && (
              <div className="select-search">
                <input
                  type="text"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                />
              </div>
            )}
            <div className="select-options">
              {visibleOptions.map((o) => {
                const isOn = multiple ? selectedValues.includes(o.value) : o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={isOn}
                    className={`select-option${isOn ? ' select-option--on' : ''}`}
                    onClick={() => {
                      if (multiple) {
                        onChange(
                          isOn ? selectedValues.filter((v) => v !== o.value) : [...selectedValues, o.value]
                        );
                      } else {
                        onChange(o.value);
                        closeFromSelection();
                      }
                    }}
                  >
                    {o.color && <span className="select-swatch" style={{ background: o.color }} />}
                    <span className="select-option-label">{o.label}</span>
                    {isOn && <CheckIcon />}
                  </button>
                );
              })}
              {searchable && visibleOptions.length === 0 && (
                <p className="muted small select-no-results">No matches.</p>
              )}
            </div>
            {multiple && (
              <div className="select-multi-foot">
                <button type="button" className="btn btn-primary full" onClick={closeFromSelection}>
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="select-chevron">
      <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className="select-check">
      <path d="M4 12l5 5 11-11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

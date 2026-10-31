// SearchInput — debounced search box.  Typing updates the field instantly but only calls
// onChange after the user pauses, so lists don't refetch on every keystroke.
// Press "/" anywhere on the page to jump to it; Esc or ✕ clears it.
import { useEffect, useRef, useState } from 'react';

export function SearchInput({ value, onChange, placeholder = 'Search…', delay = 300, width = 260 }) {
  const [text, setText] = useState(value || '');
  const inputRef = useRef(null);
  const committed = useRef(value || '');

  // Follow outside changes (back button, a link with ?q=…) without clobbering typing.
  useEffect(() => {
    if ((value || '') !== committed.current) {
      committed.current = value || '';
      setText(value || '');
    }
  }, [value]);

  useEffect(() => {
    if (text === committed.current) return undefined;
    const t = setTimeout(() => {
      committed.current = text;
      onChange(text.trim() ? text : '');
    }, delay);
    return () => clearTimeout(t);
  }, [text, delay, onChange]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const clear = () => {
    setText('');
    committed.current = '';
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div className="search-input" style={{ width }}>
      <span className="search-icon" aria-hidden="true">⌕</span>
      <input
        ref={inputRef}
        type="search"
        value={text}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape' && text) { e.preventDefault(); clear(); } }}
      />
      {text ? (
        <button type="button" className="search-clear" onClick={clear} aria-label="Clear search">✕</button>
      ) : (
        <kbd className="search-kbd">/</kbd>
      )}
    </div>
  );
}

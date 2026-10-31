// Small presentational building blocks shared by every page.
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../api/client.js';

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="page-header">
      <div>
        {back && <Link className="back-link" to={back.to}>← {back.label}</Link>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <div className="page-subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, bodyless = false }) {
  return (
    <div className="card">
      {(title || actions) && (
        <div className="card-header">
          <div className="card-title">{title}</div>
          {actions}
        </div>
      )}
      {bodyless ? children : <div className="card-body">{children}</div>}
    </div>
  );
}

export function Spinner() {
  return <div className="loading-row"><div className="spinner" /></div>;
}

export function Empty({ title = 'Nothing here yet', children }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {children && <div>{children}</div>}
    </div>
  );
}

export function ErrorAlert({ error, fallback }) {
  if (!error) return null;
  const msg = typeof error === 'string' ? error : errorMessage(error, fallback);
  return <div className="alert alert-error">{msg}</div>;
}

export function Field({ label, hint, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/** Wraps a query's loading / error / empty states around its content. */
export function QueryState({ query, isEmpty, empty, children }) {
  if (query.isLoading) return <Spinner />;
  if (query.isError) return <div className="card-body"><ErrorAlert error={query.error} fallback="Failed to load" /></div>;
  // While a new search/filter loads, the previous rows stay visible but dimmed.
  const stale = query.isFetching && query.isPlaceholderData;
  if (isEmpty) return <div className={stale ? 'is-stale' : ''}>{empty || <Empty />}</div>;
  return <div className={stale ? 'is-stale' : ''} aria-busy={stale}>{children}</div>;
}

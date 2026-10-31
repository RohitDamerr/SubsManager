// useUrlFilters — list filters live in the URL query string (?q=acme&status=ACTIVE),
// so a refresh, the back button or a shared link reopens the same view.
//
//   const [filters, setFilters] = useUrlFilters({ q: '', status: '' });
//   setFilters({ status: 'ACTIVE' });   // merges; '' / null removes the param
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useUrlFilters(defaults) {
  const [params, setParams] = useSearchParams();

  const keys = Object.keys(defaults).join(',');
  const filters = useMemo(() => {
    const out = {};
    for (const k of Object.keys(defaults)) out[k] = params.get(k) ?? defaults[k];
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, keys]);

  const setFilters = useCallback((patch) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v === '' || v == null) next.delete(k);
        else next.set(k, String(v));
      }
      return next;
    }, { replace: true }); // typing in a filter shouldn't flood the history stack
  }, [setParams]);

  return [filters, setFilters];
}

/** Drop empty values so they aren't sent to the API (and don't split the query cache). */
export function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v != null));
}

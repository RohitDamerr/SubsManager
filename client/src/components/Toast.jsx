// Toasts — lightweight success/error notices after mutations.
import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, tone = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.tone}`}>{t.message}</div>)}
      </div>
    </ToastContext.Provider>
  );
}

/** const toast = useToast(); toast('Saved'); toast('Failed', 'error'); */
export function useToast() {
  return useContext(ToastContext);
}

import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';

/** Local-only tools must never claim to save when browser storage rejects a write. */
export function useDurableLocalState<T>(key: string, initial: T, persistir = true) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : initial;
      return (Array.isArray(initial) && !Array.isArray(parsed)) ? initial : parsed as T;
    } catch {
      try {const raw=localStorage.getItem(key);if(raw!==null)localStorage.setItem('cs_corrompido:'+key+':'+Date.now(),raw);}catch{}
      return initial;
    } // Conservar o valor inválido para recuperação, sem bloquear o login.
  });
  const current = useRef(value);
  const initialRef = useRef(initial);
  useEffect(() => {
    const reset = () => { current.current = initialRef.current; setValue(initialRef.current); };
    window.addEventListener('cs:account-changed', reset);
    return () => window.removeEventListener('cs:account-changed', reset);
  }, []);
  const update = useCallback((action: SetStateAction<T>) => {
    const next = typeof action === 'function'
      ? (action as (prev: T) => T)(current.current) : action;
    if(persistir) localStorage.setItem(key, JSON.stringify(next));
    current.current = next;
    setValue(next);
  }, [key, persistir]);
  return [value, update] as const;
}

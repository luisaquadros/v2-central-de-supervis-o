import { useCallback, useRef, useState, type SetStateAction } from 'react';

/** Local-only tools must never claim to save when browser storage rejects a write. */
export function useDurableLocalState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : initial;
  });
  const current = useRef(value);
  const update = useCallback((action: SetStateAction<T>) => {
    const next = typeof action === 'function'
      ? (action as (prev: T) => T)(current.current) : action;
    localStorage.setItem(key, JSON.stringify(next));
    current.current = next;
    setValue(next);
  }, [key]);
  return [value, update] as const;
}

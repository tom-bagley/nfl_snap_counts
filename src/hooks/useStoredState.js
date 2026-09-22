import { useEffect, useState } from 'react';

export default function useStoredState(key, defaultValue, isValid, initialOverride) {
  const [value, setValue] = useState(() => {
    if (initialOverride !== undefined && isValid(initialOverride)) return initialOverride;
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (isValid(parsed)) return parsed;
      }
    } catch {
      // Browsers can disable storage; keep the page usable for this visit.
    }
    return defaultValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage failures while retaining the current selection in memory.
    }
  }, [key, value]);

  return [value, setValue];
}

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'pylontech-theme';

export type Theme = 'light' | 'dark';

function readStored(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);

    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === 'undefined') return 'light';

    return document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* private mode: the class on <html> is still authoritative for this session */
    }
  }, [theme]);

  useEffect(() => {
    if (readStored()) return;
    const query = matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) =>
      setTheme(event.matches ? 'dark' : 'light');

    query.addEventListener('change', onChange);

    return () => query.removeEventListener('change', onChange);
  }, []);

  return [
    theme,
    useCallback(
      () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
      [],
    ),
  ];
}

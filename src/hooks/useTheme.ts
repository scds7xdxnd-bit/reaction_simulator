import { useState, useEffect } from 'react';

const LS_KEY = 'rsi-theme';

function getSystemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyDark(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
}

export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return getSystemDark();
  });

  useEffect(() => {
    applyDark(isDark);
    localStorage.setItem(LS_KEY, isDark ? 'dark' : 'light');
  }, [isDark]);

  // Follow system changes when no manual override is stored
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem(LS_KEY)) setIsDark(e.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  function toggle() {
    setIsDark((v) => !v);
  }

  return { isDark, toggle };
}

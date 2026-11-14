import { useEffect, useState } from 'react';

function read(): string {
  const h = window.location.hash.replace(/^#/, '');
  return h || '/';
}

export function useRoute(): string {
  const [path, setPath] = useState(read);
  useEffect(() => {
    const on = () => {
      setPath(read());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return path;
}

export function go(path: string) {
  if (read() === path) return;
  window.location.hash = path;
}

export function href(path: string) {
  return '#' + path;
}

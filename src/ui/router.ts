import { useEffect, useState } from 'react';

function read(): string {
  let h = window.location.hash.replace(/^#/, '');
  // A challenge link pasted without its "#", or with the hash slash lost, still reaches the challenge screen.
  if (!h && /^\/(fly|case)\//.test(window.location.pathname)) h = window.location.pathname + window.location.search;
  if (h && !h.startsWith('/')) h = '/' + h;
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

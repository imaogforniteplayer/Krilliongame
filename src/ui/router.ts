import { useEffect, useState } from 'react';

/** Hash routing keeps the game working on static hosts like GitHub Pages with no server config. */
function currentPath(): string[] {
  const raw = window.location.hash.replace(/^#\/?/, '');
  return raw.split('/').filter(Boolean);
}

export function useRoute(): string[] {
  const [path, setPath] = useState<string[]>(currentPath);
  useEffect(() => {
    const onChange = () => {
      setPath(currentPath());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return path;
}

export function navigate(to: string): void {
  window.location.hash = `#/${to.replace(/^\/+/, '')}`;
}

import { useEffect, useState } from 'react';

export interface Palette {
  bus: string;
  foil: string;
  metal: string;
  panel: string;
  panelLine: string;
  dish: string;
  edge: string;
  edgeAlpha: number;
  alarm: string;
  ink: string;
  light: number;
  ambient: number;
  dark: boolean;
}

function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return {
    bus: v('--c3-bus') || '#2a2e34',
    foil: v('--c3-foil') || '#3a3a36',
    metal: v('--c3-metal') || '#9aa2ab',
    panel: v('--c3-panel') || '#172540',
    panelLine: v('--c3-panel-line') || '#4b6aa3',
    dish: v('--c3-dish') || '#d8dadb',
    edge: v('--c3-edge') || '#ebe7dc',
    edgeAlpha: parseFloat(v('--c3-edge-alpha')) || 0.3,
    alarm: v('--alarm') || '#ff5b1f',
    ink: v('--ink') || '#ebe7dc',
    light: parseFloat(v('--c3-light')) || 1.4,
    ambient: parseFloat(v('--c3-ambient')) || 0.5,
    dark: (cs.colorScheme || 'dark').includes('dark'),
  };
}

export function usePalette(): Palette {
  const [p, setP] = useState(readPalette);
  useEffect(() => {
    const update = () => setP(readPalette());
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener('change', update);
    window.addEventListener('flown-theme', update);
    return () => {
      mq.removeEventListener('change', update);
      window.removeEventListener('flown-theme', update);
    };
  }, []);
  return p;
}

export function useNarrow(limit = 600) {
  const [narrow, setNarrow] = useState(() => window.innerWidth < limit);
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < limit);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [limit]);
  return narrow;
}

import { useState, useCallback, useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import { storage } from '../services/storage';

export type ViewMode = 'card' | 'table';

const TABLET_BREAKPOINT = 768;

export function useViewPreference(page: string): [ViewMode, (v: ViewMode) => void] {
  const { width } = useWindowDimensions();
  const defaultView: ViewMode = width >= TABLET_BREAKPOINT ? 'table' : 'card';
  const [view, setViewState] = useState<ViewMode>(defaultView);
  const storageKey = `view-pref:${page}`;

  useEffect(() => {
    let mounted = true;
    storage
      .getCache<ViewMode>(storageKey)
      .then((stored) => {
        if (mounted && (stored === 'card' || stored === 'table')) {
          setViewState(stored);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [storageKey]);

  const setView = useCallback(
    (v: ViewMode) => {
      setViewState(v);
      void storage.setCache(storageKey, v).catch(() => {});
    },
    [storageKey]
  );

  return [view, setView];
}

export default useViewPreference;


'use client';

import {useEffect, useState} from 'react';

export interface ApiState<T> {
  data: T | null;
  error: 'not_configured' | 'unavailable' | null;
  loading: boolean;
}

/** Small fetch hook for the read-only data routes. Pass null to skip. */
export function useApi<T>(url: string | null): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({data: null, error: null, loading: Boolean(url)});
  useEffect(() => {
    if (!url) return;
    const ctrl = new AbortController();
    setState(s => ({...s, loading: true}));
    fetch(url, {signal: ctrl.signal})
      .then(async r => {
        if (r.ok) {
          const data = await r.json() as T;
          if (!ctrl.signal.aborted) setState({data, error: null, loading: false});
        } else if (!ctrl.signal.aborted) {
          setState({data: null, error: r.status === 503 ? 'not_configured' : 'unavailable', loading: false});
        }
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setState({data: null, error: 'unavailable', loading: false});
      });
    return () => ctrl.abort();
  }, [url]);
  return state;
}

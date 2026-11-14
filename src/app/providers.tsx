'use client';

import NextLink from 'next/link';
import {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {Theme} from '@astryxdesign/core/theme';
import {LinkProvider} from '@astryxdesign/core/Link';
import {neutralTheme} from '@astryxdesign/theme-neutral/built';
import {dictionaries, type Dict, type Lang} from '@/lib/i18n';

export type Mode = 'light' | 'dark' | 'system';
export type Glow = 'mono' | 'amber' | 'blue' | 'violet' | 'green' | 'off';

interface Settings {
  mode: Mode;
  lang: Lang;
  glow: Glow;
  domain: string; // '' = all research areas
}
// The challenge is about fire safety, so the site opens on combustion; "All areas" ('') stays one click away.
export const DEFAULT_DOMAIN = 'combustion-science';
const DEFAULTS: Settings = {mode: 'system', lang: 'en', glow: 'mono', domain: DEFAULT_DOMAIN};
const KEY = 'igris-settings';
// Bumped when a default changes meaning. Saved settings from an older version keep theme/language/glow,
// but not the research area, because '' (all areas) used to be the default rather than a choice.
const VERSION = 2;

interface Ctx extends Settings {
  t: Dict;
  set: (patch: Partial<Settings>) => void;
}
const SettingsContext = createContext<Ctx>({...DEFAULTS, t: dictionaries.en, set: () => {}});
export const useSettings = () => useContext(SettingsContext);

export function Providers({children}: {children: React.ReactNode}) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  // Preferences are a per-browser convenience; storage can be unavailable, so failures are ignored.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
      if (saved && typeof saved === 'object') {
        const {v, ...rest} = saved as Partial<Settings> & {v?: number};
        if ((v ?? 1) < VERSION) delete rest.domain;
        setSettings(s => ({...s, ...rest}));
      }
    } catch {}
  }, []);

  const set = useCallback((patch: Partial<Settings>) => {
    setSettings(prev => {
      const next = {...prev, ...patch};
      try {
        localStorage.setItem(KEY, JSON.stringify({...next, v: VERSION}));
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = settings.lang;
    document.documentElement.dataset.glow = settings.glow;
  }, [settings.lang, settings.glow]);

  const value = useMemo(() => ({...settings, t: dictionaries[settings.lang], set}), [settings, set]);

  return (
    <SettingsContext.Provider value={value}>
      <Theme theme={neutralTheme} mode={settings.mode}>
        <LinkProvider component={NextLink}>{children}</LinkProvider>
      </Theme>
    </SettingsContext.Provider>
  );
}

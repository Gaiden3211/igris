'use client';

import {AppLink} from '@/components/AppLink';
import {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {Theme} from '@astryxdesign/core/theme';
import {LinkProvider} from '@astryxdesign/core/Link';
import {neutralTheme} from '@astryxdesign/theme-neutral/built';
import {ConversationSessions} from '@/components/ConversationSessions';
import {ChatHistoryProvider} from '@/lib/chatHistory';
import {dictionaries, type Dict, type Lang} from '@/lib/i18n';

export type Mode = 'light' | 'dark';
interface Settings {
  mode: Mode;
  lang: Lang;
  welcomed: boolean;
}
const DEFAULTS: Settings = {mode: 'dark', lang: 'en', welcomed: false};
const KEY = 'igris-settings';

interface Ctx extends Settings {
  t: Dict;
  ready: boolean;
  finishWelcome: () => void;
  set: (patch: Partial<Settings>) => void;
}
const SettingsContext = createContext<Ctx>({...DEFAULTS, t: dictionaries.en, ready: false, finishWelcome: () => {}, set: () => {}});
export const useSettings = () => useContext(SettingsContext);

export function Providers({children}: {children: React.ReactNode}) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
      if (saved && typeof saved === 'object') {
        setSettings({
          mode: saved.mode === 'light' ? 'light' : 'dark',
          lang: saved.lang === 'uk' ? 'uk' : 'en',
          welcomed: saved.welcomed === true,
        });
      }
    } catch {}
    setReady(true);
  }, []);

  const set = useCallback((patch: Partial<Settings>) => setSettings(prev => ({...prev, ...patch})), []);
  const finishWelcome = useCallback(() => set({welcomed: true}), [set]);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
  }, [ready, settings]);

  useEffect(() => {
    document.documentElement.lang = settings.lang;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    themeColor?.setAttribute('content', settings.mode === 'dark' ? '#212121' : '#ffffff');
  }, [settings.lang, settings.mode]);

  const value = useMemo(() => ({
    ...settings, t: dictionaries[settings.lang], ready, set, finishWelcome,
  }), [settings, ready, set, finishWelcome]);

  return (
    <SettingsContext.Provider value={value}>
      <Theme theme={neutralTheme} mode={settings.mode}>
        <LinkProvider component={AppLink}><ChatHistoryProvider><ConversationSessions>{children}</ConversationSessions></ChatHistoryProvider></LinkProvider>
      </Theme>
    </SettingsContext.Provider>
  );
}

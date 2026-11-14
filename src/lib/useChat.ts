'use client';

import {useCallback, useRef, useState} from 'react';
import {useSettings} from '@/app/providers';
import type {Dict} from './i18n';
import {readNdjson, type SourceCardData} from './citations';

// One conversation with /api/chat, shared by the Assistant page and the follow-up box on the Compare page.

export interface ChatStep {
  id: 'plan' | 'search' | 'answer';
  status: 'running' | 'complete';
  detail?: string;
}
export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  steps: ChatStep[];
  cards: SourceCardData[];
  error?: string;
}
export type HistoryItem = {role: 'user' | 'assistant'; content: string};

export const limitText = (t: Dict, code?: string) => (code === 'minute' ? t.limitMinute : code === 'global' ? t.limitGlobal : t.limitDay);

export const userMsg = (content: string): ChatMsg => ({role: 'user', content, steps: [], cards: []});
export const assistantMsg = (content: string, cards: SourceCardData[] = []): ChatMsg => ({role: 'assistant', content, steps: [], cards});

const HISTORY_TURNS = 8; // the server accepts at most 8

/**
 * @param focus  investigation ids the server always retrieves (a conversation about a comparison)
 * @param prefix earlier turns that are not shown in `messages` but belong to the conversation (the comparison itself)
 */
export function useChat({focus, prefix = []}: {focus?: string[] | null; prefix?: HistoryItem[]} = {}) {
  const {t, domain} = useSettings();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [quota, setQuota] = useState<{left: number; perDay: number} | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const patchLast = (fn: (m: ChatMsg) => ChatMsg) => setMessages(list => list.map((m, i) => (i === list.length - 1 ? fn(m) : m)));

  const send = useCallback(
    async (raw: string) => {
      const message = raw.trim();
      if (!message || busy) return;
      setNotice(null);
      setBusy(true);
      const shown = messages.filter(m => m.content && !m.error).map(m => ({role: m.role, content: m.content}));
      // Keep the prefix (the comparison) even in long threads: it is what the follow-ups are about.
      const recent = shown.slice(-Math.max(HISTORY_TURNS - prefix.length, 2));
      const history = [...prefix, ...recent].slice(-HISTORY_TURNS).map(h => ({role: h.role, content: h.content.slice(0, 6000)}));
      setMessages(list => [...list, userMsg(message), assistantMsg('')]);
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify({message, history, domain: domain || null, focus: focus && focus.length ? focus : undefined}),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          const text = res.status === 429 ? limitText(t, body.code) : res.status === 503 ? t.errNotConfigured : t.errModel;
          if (res.status === 429 && body.code !== 'minute') setQuota({left: 0, perDay: body.perDay ?? 30});
          setMessages(list => list.slice(0, -2));
          setNotice(text);
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await readNdjson(res.body, (ev: any) => {
          if (ev.type === 'delta') patchLast(m => ({...m, content: m.content + ev.text}));
          else if (ev.type === 'step')
            patchLast(m => ({...m, steps: [...m.steps.filter(s => s.id !== ev.id), {id: ev.id, status: ev.status, detail: ev.detail}]}));
          else if (ev.type === 'sources') patchLast(m => ({...m, cards: ev.cards}));
          else if (ev.type === 'done') setQuota({left: ev.remainingToday, perDay: ev.perDay});
          else if (ev.type === 'error') patchLast(m => ({...m, error: t.errModel}));
        });
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') patchLast(m => ({...m, error: t.errModel}));
      } finally {
        setBusy(false);
        abort.current = null;
      }
    },
    [busy, messages, domain, focus, prefix, t],
  );

  const stop = () => abort.current?.abort();

  return {messages, setMessages, busy, quota, setQuota, notice, send, stop};
}

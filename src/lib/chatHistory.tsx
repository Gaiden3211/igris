'use client';

import {createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode} from 'react';
import {z} from 'zod';
import type {ChatFocus} from './chatSeed';
import {COMPARE_MAX, comparisonKey} from './compare';
import type {ChatMsg} from './useChat';

const STORAGE_KEY = 'igris-chats-v1';
const MAX_CHATS = 50;
const MAX_MESSAGES = 80;
const MAX_STORAGE_CHARS = 1_500_000;

export interface Conversation {
  id: string;
  focus: ChatFocus | null;
  messages: ChatMsg[];
  comparison?: {ids: string[]; names: string[]; summary: ChatMsg | null};
}

const card = z.object({
  id: z.string().regex(/^(PSI|PUB)-\d+$/),
  kind: z.enum(['investigation', 'publication']),
  title: z.string(),
  subtitle: z.string().optional(),
  url: z.string().refine(url => {
    if (!url) return true;
    try {
      const {protocol} = new URL(url);
      return protocol === 'https:' || protocol === 'http:';
    } catch {
      return false;
    }
  }),
  investigationId: z.string().regex(/^PSI-\d+$/).optional(),
});
const message = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  cards: z.array(card).catch([]),
  error: z.string().optional(),
}).transform(turn => ({...turn, steps: [] as ChatMsg['steps']}));
const conversation = z.object({
  id: z.union([z.uuid(), z.string().regex(/^comparison:PSI-\d{1,6}(,PSI-\d{1,6}){1,3}$/)]),
  focus: z.object({ids: z.array(z.string().regex(/^PSI-\d+$/)).max(4), names: z.array(z.string()).max(4)}).nullable(),
  messages: z.array(message).max(MAX_MESSAGES),
  comparison: z.object({
    ids: z.array(z.string().regex(/^PSI-\d{1,6}$/)).min(2).max(COMPARE_MAX),
    names: z.array(z.string()).min(2).max(COMPARE_MAX),
    summary: message.nullable(),
  }).optional(),
}).refine(chat => chat.comparison
  ? chat.id === comparisonKey(chat.comparison.ids) && new Set(chat.comparison.ids).size === chat.comparison.ids.length
    && chat.comparison.names.length === chat.comparison.ids.length
    && (!chat.comparison.summary || (chat.comparison.summary.role === 'assistant' && Boolean(chat.comparison.summary.content.trim())))
  : !chat.id.startsWith('comparison:'));

function readHistory(): Conversation[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? '[]';
    if (raw.length > MAX_STORAGE_CHARS) return [];
    const saved: unknown = JSON.parse(raw);
    if (!Array.isArray(saved)) return [];
    return saved.slice(0, MAX_CHATS).flatMap(item => {
      const result = conversation.safeParse(item);
      return result.success && (result.data.messages.length || result.data.comparison) ? [result.data] : [];
    });
  } catch {
    return null;
  }
}

function recentMessages(messages: ChatMsg[]) {
  const turns = messages.filter(message => message.content || message.error);
  if (turns.length <= MAX_MESSAGES) return turns;
  // Keep the first question as the title when a long conversation is trimmed.
  return [turns[0], ...turns.slice(-(MAX_MESSAGES - 1))];
}

export const conversationTitle = ({messages, comparison}: Conversation) => {
  if (comparison) return comparison.names.join(' · ');

  return (messages.find(m => m.role === 'user')?.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 100);
};

const ChatHistoryContext = createContext<{
  ready: boolean;
  conversations: Conversation[];
  save: (chat: Conversation, update?: 'messages' | 'summary') => void;
}>({ready: false, conversations: [], save: () => {}});

export const useChatHistory = () => useContext(ChatHistoryContext);

export function ChatHistoryProvider({children}: {children: ReactNode}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [ready, setReady] = useState(false);
  const latest = useRef<Conversation[]>([]);
  const memoryOnly = useRef(false);

  useEffect(() => {
    const load = () => {
      if (memoryOnly.current) return;
      const saved = readHistory();
      if (!saved) return;
      latest.current = saved;
      setConversations(saved);
    };
    load();
    setReady(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) load();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const save = useCallback((chat: Conversation, update?: 'messages' | 'summary') => {
    const validated = conversation.safeParse({
      ...chat,
      messages: recentMessages(chat.messages),
    });
    if (!validated.success || (!validated.data.messages.length && !validated.data.comparison)) return;
    const current = (memoryOnly.current ? null : readHistory()) ?? latest.current;
    const previous = current.find(item => item.id === chat.id);
    const next = validated.data;
    if (next.comparison && previous?.comparison) {
      if (update === 'summary') next.messages = previous.messages;
      if (update === 'messages') next.comparison.summary = previous.comparison.summary;
      else next.comparison.summary ??= previous.comparison.summary;
    }
    if (JSON.stringify(previous) === JSON.stringify(next)) return;
    const updated = [next, ...current.filter(item => item.id !== chat.id)].slice(0, MAX_CHATS);
    if (!memoryOnly.current) {
      let stored = JSON.stringify(updated);
      while (stored.length > MAX_STORAGE_CHARS && updated.length > 1) {
        updated.pop();
        stored = JSON.stringify(updated);
      }
      try {
        if (stored.length > MAX_STORAGE_CHARS) memoryOnly.current = true;
        else localStorage.setItem(STORAGE_KEY, stored);
      } catch {
        memoryOnly.current = true;
      }
    }
    latest.current = updated;
    setConversations(updated);
  }, []);

  return <ChatHistoryContext.Provider value={{ready, conversations, save}}>{children}</ChatHistoryContext.Provider>;
}

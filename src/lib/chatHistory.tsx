'use client';

import {createContext, useCallback, useContext, useEffect, useState, type ReactNode} from 'react';
import {z} from 'zod';
import type {ChatFocus} from './chatSeed';
import type {ChatMsg} from './useChat';

const STORAGE_KEY = 'igris-chats-v1';
const MAX_CHATS = 50;
const MAX_MESSAGES = 80;

export interface Conversation {
  id: string;
  domain: string;
  focus: ChatFocus | null;
  messages: ChatMsg[];
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
  id: z.uuid(),
  domain: z.string().max(128),
  focus: z.object({ids: z.array(z.string().regex(/^PSI-\d+$/)).max(4), names: z.array(z.string()).max(4)}).nullable(),
  messages: z.array(message).max(MAX_MESSAGES),
});

function readHistory(): Conversation[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(saved)) return [];
    return saved.slice(0, MAX_CHATS).flatMap(item => {
      const result = conversation.safeParse(item);
      return result.success && result.data.messages.length ? [result.data] : [];
    });
  } catch {
    return [];
  }
}

export function conversationTitle({messages}: Conversation) {
  return (messages.find(m => m.role === 'user')?.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 100);
}

const ChatHistoryContext = createContext<{
  ready: boolean;
  conversations: Conversation[];
  save: (chat: Conversation) => void;
}>({ready: false, conversations: [], save: () => {}});

export const useChatHistory = () => useContext(ChatHistoryContext);

export function ChatHistoryProvider({children}: {children: ReactNode}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = () => setConversations(readHistory());
    load();
    setReady(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) load();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const save = useCallback((chat: Conversation) => {
    const validated = conversation.safeParse({
      ...chat,
      messages: chat.messages.filter(m => m.content || m.error).slice(-MAX_MESSAGES),
    });
    if (!validated.success || !validated.data.messages.length) return;
    const current = readHistory();
    if (JSON.stringify(current[0]) === JSON.stringify(validated.data)) return;
    const updated = [validated.data, ...current.filter(item => item.id !== chat.id)].slice(0, MAX_CHATS);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
    setConversations(updated);
  }, []);

  return <ChatHistoryContext.Provider value={{ready, conversations, save}}>{children}</ChatHistoryContext.Provider>;
}

'use client';

import {createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode} from 'react';
import {z} from 'zod';
import {conversationTitlesSchema, type ConversationTitles} from './conversationTitle';
import type {ChatFocus} from './chatSeed';
import {COMPARE_MAX, comparisonKey} from './compare';
import {sourceCardSchema, chatRepositorySchema, type ChatMsg, type ChatRepository} from './chatAdapter';

const STORAGE_KEY = 'igris-chats-v1';
const MAX_CHATS = 50;
const MAX_MESSAGES = 80;
const MAX_STORAGE_CHARS = 1_500_000;

export interface Conversation {
  id: string;
  focus: ChatFocus | null;
  pinned?: boolean;
  titles?: ConversationTitles;
  unread?: string;
  messages: ChatMsg[];
  repository?: ChatRepository;
  comparison?: {ids: string[]; names: string[]; summary: ChatMsg | null; publicResearch?: boolean};
}

const card = sourceCardSchema;
const message = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  cards: z.array(card).catch([]),
  error: z.string().optional(),
  errorCode: z.enum(['answer_unverified', 'answer_incomplete', 'model_unavailable']).optional(),
}).transform((turn): ChatMsg => ({...turn,
  errorCode: turn.errorCode ?? (turn.error?.startsWith('Could not confirm the draft')
    || turn.error?.startsWith('Не вдалося підтвердити відповідь') ? 'answer_unverified' as const : undefined),
  steps: [] as ChatMsg['steps'],
}));
const conversation = z.object({
  id: z.union([z.uuid(), z.string().regex(/^comparison:PSI-\d{1,6}(,PSI-\d{1,6}){1,3}$/)]),
  focus: z.object({ids: z.array(z.string().regex(/^PSI-\d+$/)).max(4), names: z.array(z.string()).max(4)}).nullable(),
  messages: z.array(message).max(MAX_MESSAGES),
  repository: chatRepositorySchema.optional().catch(undefined),
  pinned: z.boolean().optional(),
  titles: conversationTitlesSchema.optional().catch(undefined),
  unread: z.string().max(32).optional(),
  comparison: z.object({
    ids: z.array(z.string().regex(/^PSI-\d{1,6}$/)).min(2).max(COMPARE_MAX),
    names: z.array(z.string()).min(2).max(COMPARE_MAX),
    summary: message.nullable(),
    publicResearch: z.boolean().optional(),
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

const TITLE_WORDS = 6;
const TITLE_LENGTH = 42;
const titleIntro = /^(?:(?:hey|hi|hello|привіт|вітаю)[!,.\s]+|(?:please|будь ласка)[,\s]+|(?:could you|can you|would you|можеш|можете|чи можеш|чи можете)[\s]+|(?:tell me about|tell me|find information about|find me|find|explain|show me|розкажи мені про|розкажіть мені про|розкажи про|розкажіть про|поясни|поясніть|знайди інформацію про|знайдіть інформацію про|знайди|знайдіть)[\s]+)+/iu;

export function conversationTitle({messages, comparison, titles}: Conversation, lang?: 'en' | 'uk') {
  if (lang && titles?.[lang]) return titles[lang];
  if (comparison) return comparison.names.join(' · ');

  const firstMessage = (messages.find(m => m.role === 'user')?.content ?? '').replace(/\s+/g, ' ').trim();
  const topic = (firstMessage.replace(titleIntro, '').trim() || firstMessage).replace(/[?!.…]+$/u, '') || firstMessage;
  const words = topic.split(' ');
  const title = words.slice(0, TITLE_WORDS).join(' ');
  if (words.length <= TITLE_WORDS && Array.from(title).length <= TITLE_LENGTH) return title;

  const prefix = Array.from(title).slice(0, TITLE_LENGTH).join('');
  const lastSpace = prefix.lastIndexOf(' ');
  const withinWord = !/^(?:\s|$)/u.test(title.slice(prefix.length));
  return (withinWord && lastSpace > 0 ? prefix.slice(0, lastSpace) : prefix).trimEnd().replace(/\s+(?:and|or|of|the|to|і|та|або|про|для|з|у|в)$/iu, '');
}

const ChatHistoryContext = createContext<{
  ready: boolean;
  conversations: Conversation[];
  save: (chat: Conversation, update?: 'messages' | 'summary') => void;
  saveTitles: (id: string, titles: ConversationTitles) => void;
  togglePin: (id: string) => void;
  removeChat: (id: string) => void;
  running: Record<string, string[]>;
  setRunning: (id: string, token: string, running: boolean) => void;
  setUnread: (id: string, response: string) => void;
  markRead: (id: string, response: string) => void;
  reopen: (id: string) => void;
}>({ready: false, conversations: [], save: () => {}, saveTitles: () => {}, togglePin: () => {}, removeChat: () => {}, running: {}, setRunning: () => {}, setUnread: () => {}, markRead: () => {}, reopen: () => {}});

export const useChatHistory = () => useContext(ChatHistoryContext);

export function ChatHistoryProvider({children}: {children: ReactNode}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [running, updateRunning] = useState<Record<string, string[]>>({});
  const [ready, setReady] = useState(false);
  const latest = useRef<Conversation[]>([]);
  const memoryOnly = useRef(false);
  const removedChats = useRef(new Set<string>());

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
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      const previous = latest.current;
      load();
      const currentIds = new Set(latest.current.map(chat => chat.id));
      for (const chat of previous) {
        if (!currentIds.has(chat.id)) removedChats.current.add(chat.id);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const writeHistory = useCallback((updated: Conversation[]) => {
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

  const save = useCallback((chat: Conversation, update?: 'messages' | 'summary') => {
    if (removedChats.current.has(chat.id)) return;
    const validated = conversation.safeParse({
      ...chat,
      messages: recentMessages(chat.messages),
    });
    if (!validated.success || (!validated.data.messages.length && !validated.data.comparison)) return;
    const current = (memoryOnly.current ? null : readHistory()) ?? latest.current;
    const previous = current.find(item => item.id === chat.id);
    const next = validated.data;
    next.pinned = previous?.pinned;
    next.titles = previous?.titles;
    next.unread = previous?.unread;
    if (next.comparison && previous?.comparison) {
      if (update === 'summary') { next.messages = previous.messages; next.repository = previous.repository; }
      if (update === 'messages') {
        next.comparison.summary = previous.comparison.summary;
        next.comparison.publicResearch = previous.comparison.publicResearch;
      }
      else next.comparison.summary ??= previous.comparison.summary;
    }
    const normalized = conversation.parse(next);
    if (JSON.stringify(previous) === JSON.stringify(normalized)) return;
    const updated = [normalized, ...current.filter(item => item.id !== chat.id)].slice(0, MAX_CHATS);
    writeHistory(updated);
  }, [writeHistory]);

  const saveTitles = useCallback((id: string, titles: ConversationTitles) => {
    const validated = conversationTitlesSchema.safeParse(titles);
    if (!validated.success || removedChats.current.has(id)) return;
    const current = (memoryOnly.current ? null : readHistory()) ?? latest.current;
    if (!current.some(chat => chat.id === id)) return;
    writeHistory(current.map(chat => chat.id === id ? {...chat, titles: validated.data} : chat));
  }, [writeHistory]);

  const togglePin = useCallback((id: string) => {
    const current = (memoryOnly.current ? null : readHistory()) ?? latest.current;
    const chat = current.find(chat => chat.id === id);
    if (!chat) return;
    writeHistory(current.map(item => item.id === id ? {...item, pinned: !item.pinned} : item));
  }, [writeHistory]);

  const removeChat = useCallback((id: string) => {
    const current = (memoryOnly.current ? null : readHistory()) ?? latest.current;
    if (!current.some(chat => chat.id === id)) return;
    removedChats.current.add(id);
    writeHistory(current.filter(chat => chat.id !== id));
  }, [writeHistory]);

  const setRunning = useCallback((id: string, token: string, active: boolean) => {
    updateRunning(previous => {
      const tokens = new Set(previous[id] ?? []);
      if (tokens.has(token) === active) return previous;
      if (active) tokens.add(token); else tokens.delete(token);
      return {...previous, [id]: [...tokens]};
    });
  }, []);
  const setUnread = useCallback((id: string, response: string) => {
    writeHistory(latest.current.map(chat => chat.id === id ? {...chat, unread: response} : chat));
  }, [writeHistory]);
  const markRead = useCallback((id: string, response: string) => {
    if (!latest.current.some(chat => chat.id === id && chat.unread === response)) return;
    writeHistory(latest.current.map(chat => chat.id === id ? {...chat, unread: undefined} : chat));
  }, [writeHistory]);
  const reopen = useCallback((id: string) => { removedChats.current.delete(id); }, []);

  return <ChatHistoryContext.Provider value={{ready, conversations, save, saveTitles, togglePin, removeChat, running, setRunning, setUnread, markRead, reopen}}>{children}</ChatHistoryContext.Provider>;
}

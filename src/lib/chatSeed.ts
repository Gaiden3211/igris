'use client';

import type {SourceCardData} from './citations';

// Hands a comparison (and any follow-up questions asked under it) over to the Assistant page: the Compare page saves
// it, the chat picks it up once on load. sessionStorage keeps it to this tab and drops it when the tab closes.

const KEY = 'igris-chat-seed';

export interface ChatFocus {
  ids: string[];
  names: string[];
}
export interface SeedMessage {
  role: 'user' | 'assistant';
  content: string;
  cards: SourceCardData[];
}
export interface ChatSeed {
  focus: ChatFocus;
  messages: SeedMessage[];
}

export function saveChatSeed(seed: ChatSeed) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(seed));
    return true;
  } catch {
    return false;
  }
}

/** Returns the saved conversation and removes it, so a reload or a later visit starts a normal chat. */
export function takeChatSeed(): ChatSeed | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as ChatSeed;
    if (!Array.isArray(s?.focus?.ids) || !Array.isArray(s.messages)) return null;
    const ids = s.focus.ids.filter(id => /^PSI-\d+$/.test(id)).slice(0, 4);
    const messages = s.messages
      .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content)
      .map(m => ({role: m.role, content: m.content, cards: Array.isArray(m.cards) ? m.cards : []}));
    return {focus: {ids, names: s.focus.names ?? ids}, messages};
  } catch {
    return null;
  }
}

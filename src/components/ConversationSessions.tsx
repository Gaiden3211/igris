'use client';

import {createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import {useChatHistory} from '@/lib/chatHistory';
import {ConversationTitle} from './ConversationTitle';
import {createPortal} from 'react-dom';

interface Session {
  id: string;
  container: HTMLDivElement;
  content: ReactNode;
  attached: boolean;
}
const Visibility = createContext(false);
const Sessions = createContext<{
  attach: (id: string, content: ReactNode, slot: HTMLElement) => () => void;
  remove: (id: string) => void;
} | null>(null);
export const useConversationSessions = () => useContext(Sessions);
export const useSessionVisible = () => useContext(Visibility);

/** Keep runtime owners mounted across route changes. Moving the same portal container
 * changes its location, not its React identity, so assistant-ui can finish its run. */
export function ConversationSessions({children}: {children: ReactNode}) {
  const {running} = useChatHistory();
  const activeRuns = useRef(running);
  useEffect(() => { activeRuns.current = running; }, [running]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const entries = useRef(new Map<string, Session>());
  const publish = useCallback(() => setSessions([...entries.current.values()]), []);
  const attach = useCallback((id: string, content: ReactNode, slot: HTMLElement) => {
    let session = entries.current.get(id);
    if (!session) {
      const container = document.createElement('div');
      container.className = 'igris-session';
      session = {id, container, content, attached: true};
      entries.current.set(id, session);
    }
    // Retain ten recently visited idle sessions; never evict an active run.
    entries.current.delete(id);
    entries.current.set(id, session);
    session.attached = true;
    const idle = [...entries.current.values()].filter(entry => !entry.attached && !activeRuns.current[entry.id]?.length);
    for (const old of idle.slice(0, Math.max(0, idle.length - 10))) entries.current.delete(old.id);
    slot.appendChild(session.container);
    publish();
    return () => {
      if (session.container.parentElement !== slot) return;
      session.container.remove();
      session.attached = false;
      publish();
    };
  }, [publish]);
  const remove = useCallback((id: string) => {
    entries.current.get(id)?.container.remove();
    entries.current.delete(id);
    publish();
  }, [publish]);
  return <Sessions.Provider value={{attach, remove}}>
    {children}
    {sessions.map(session => createPortal(
      <Visibility.Provider value={session.attached}><ConversationTitle id={session.id} />{session.content}</Visibility.Provider>, session.container, session.id,
    ))}
  </Sessions.Provider>;
}

export function ConversationSlot({id, children}: {id: string; children: ReactNode}) {
  const host = useConversationSessions();
  const {reopen} = useChatHistory();
  const slot = useRef<HTMLDivElement>(null);
  const content = useRef(children);
  const attach = host?.attach;
  useLayoutEffect(() => {
    reopen(id);
    if (slot.current && attach) return attach(id, content.current, slot.current);
  }, [id, attach, reopen]);
  return host ? <div ref={slot} className="igris-session" /> : children;
}

/** A response is read only when its end is on screen in the active, visible tab. */
export function useResponseViewed(onView: () => void) {
  const active = useSessionVisible();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active || !end.current) return;
    let visible = false;
    const read = () => { if (visible && document.visibilityState === 'visible') onView(); };
    const observer = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      read();
    });
    observer.observe(end.current);
    document.addEventListener('visibilitychange', read);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', read); };
  }, [active, onView]);
  return end;
}

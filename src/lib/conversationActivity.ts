'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {useChatHistory} from './chatHistory';
import {useResponseViewed} from '@/components/ConversationSessions';

// Stable, small identity for the answer, not its contents in storage.
function responseId(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return `${text.length}:${hash >>> 0}`;
}

export function useConversationActivity(id: string, busy: boolean, answer: string) {
  const {setRunning, setUnread, markRead, conversations} = useChatHistory();
  const [token] = useState(() => crypto.randomUUID());
  const wasBusy = useRef(false);
  const response = responseId(answer);
  const unread = conversations.find(chat => chat.id === id)?.unread;

  useEffect(() => {
    setRunning(id, token, busy);
    return () => setRunning(id, token, false);
  }, [id, token, busy, setRunning]);
  useEffect(() => {
    if (wasBusy.current && !busy && answer) setUnread(id, response);
    wasBusy.current = busy;
  }, [id, busy, answer, response, setUnread]);
  const read = useCallback(() => {
    if (!busy && unread === response) markRead(id, response);
  }, [id, busy, unread, response, markRead]);
  return useResponseViewed(read);
}

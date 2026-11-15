'use client';

import {useEffect, useRef} from 'react';
import {useChatHistory} from '@/lib/chatHistory';
import {conversationTitlesSchema} from '@/lib/conversationTitle';

/** Small background metadata request; never delays or changes the actual answer. */
export function ConversationTitle({id}: {id: string}) {
  const {conversations, running, saveTitles} = useChatHistory();
  const chat = conversations.find(chat => chat.id === id);
  const latest = useRef(chat);
  useEffect(() => { latest.current = chat; }, [chat]);
  const attempted = useRef(false);
  const hasTitles = Boolean(chat?.titles);
  const eligible = Boolean(chat && !running[id]?.length && (chat.comparison?.summary || chat.messages.some(turn => turn.role === 'assistant' && turn.content)));
  useEffect(() => {
    if (!eligible || hasTitles || attempted.current) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const current = latest.current;
      if (!current) return;
      attempted.current = true;
      const turns = current.comparison?.summary ? [current.comparison.summary] : current.messages.slice(0, 6);
      try {
        const response = await fetch('/api/conversation-title', {
          method: 'POST', headers: {'content-type': 'application/json'},
          signal: controller.signal,
          body: JSON.stringify({surface: current.comparison ? 'comparison' : 'chat',
            studies: (current.comparison?.names ?? current.focus?.names ?? []).map(name => name.slice(0, 180)),
            turns: turns.map(({role, content}) => ({role, content: content.slice(0, 700)})),
          }),
        });
        if (!response.ok) return;
        const titles = conversationTitlesSchema.safeParse(await response.json());
        if (titles.success && !controller.signal.aborted) saveTitles(id, titles.data);
      } catch { /* Keep the readable local fallback; never interrupt a conversation for metadata. */ }
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); attempted.current = false; };
  }, [id, eligible, hasTitles, saveTitles]);
  return null;
}

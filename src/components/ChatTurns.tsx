'use client';

import {ChatMessage, ChatMessageBubble, ChatToolCalls} from '@astryxdesign/core/Chat';
import {Markdown} from '@astryxdesign/core/Markdown';
import {Text} from '@astryxdesign/core/Text';
import {useSettings} from '@/app/providers';
import {linkCitations} from '@/lib/citations';
import type {ChatMsg, ChatStep} from '@/lib/useChat';
import {SourceCards} from '@/components/SourceCards';

/** Renders conversation turns: user bubbles, and assistant answers with steps, cited text and source cards. */
export function ChatTurns({messages, busy}: {messages: ChatMsg[]; busy: boolean}) {
  const {t} = useSettings();
  const stepLabel = (s: ChatStep) => (s.id === 'plan' ? t.stepPlan : s.id === 'search' ? t.stepSearch : t.stepAnswer);
  return (
    <>
      {messages.map((m, i) =>
        m.role === 'user' ? (
          <ChatMessage key={i} sender="user">
            <ChatMessageBubble>{m.content}</ChatMessageBubble>
          </ChatMessage>
        ) : (
          <ChatMessage key={i} sender="assistant">
            {m.steps.length > 0 && (
              <ChatToolCalls label={t.stepsLabel} calls={m.steps.map(s => ({name: stepLabel(s), target: s.detail ?? '', status: s.status}))} />
            )}
            {m.content && (
              <ChatMessageBubble variant="ghost">
                <Markdown density="compact">{linkCitations(m.content, m.cards)}</Markdown>
              </ChatMessageBubble>
            )}
            {m.error && (
              <ChatMessageBubble variant="ghost">
                <Text color="secondary">{m.error}</Text>
              </ChatMessageBubble>
            )}
            {m.cards.length > 0 && !(busy && i === messages.length - 1) && (
              <ChatMessageBubble variant="ghost" width="100%">
                <SourceCards cards={m.cards} title={t.sources} note={t.aiNote} />
              </ChatMessageBubble>
            )}
          </ChatMessage>
        ),
      )}
    </>
  );
}

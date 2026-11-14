'use client';

import {useEffect, useState} from 'react';
import {ChatComposer, ChatLayout, ChatMessageList} from '@astryxdesign/core/Chat';
import {ClickableCard} from '@astryxdesign/core/ClickableCard';
import {Button} from '@astryxdesign/core/Button';
import {Heading, Text} from '@astryxdesign/core/Text';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {useSettings} from '@/app/providers';
import {useChat} from '@/lib/useChat';
import {takeChatSeed, type ChatFocus} from '@/lib/chatSeed';
import {ChatTurns} from '@/components/ChatTurns';

export function ChatView() {
  const {t} = useSettings();
  // Set when the chat was opened from the Compare page: those investigations stay in every search.
  const [focus, setFocus] = useState<ChatFocus | null>(null);
  const {messages, setMessages, busy, quota, notice, send, stop} = useChat({focus: focus?.ids});

  const newChat = () => {
    setMessages([]);
    setFocus(null);
  };

  // "Discuss in chat" on the Compare page leaves a seed; "Ask about this investigation" links arrive as /?q=...
  useEffect(() => {
    const seed = takeChatSeed();
    if (seed) {
      setFocus(seed.focus);
      setMessages(seed.messages.map(m => ({...m, steps: []})));
      return;
    }
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) {
      window.history.replaceState(null, '', '/');
      void send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const composer = (
    <ChatComposer
      onSubmit={send}
      onStop={stop}
      isStopShown={busy}
      placeholder={t.chatPlaceholder}
      status={notice ? {type: 'warning', message: notice} : undefined}
      headerContext={
        quota ? (
          <Text type="supporting" color="secondary">
            {t.remaining(quota.left, quota.perDay)}
          </Text>
        ) : undefined
      }
    />
  );

  if (messages.length === 0) {
    return (
      <div className="igris-page igris-chat">
        <div className="igris-landing">
          <VStack gap={2}>
            <Heading level={1}>{t.chatTitle}</Heading>
            <Text color="secondary">{t.chatSubtitle}</Text>
          </VStack>
          {composer}
          <div className="igris-grid-2">
            {t.chatExamples.map(q => (
              <ClickableCard key={q} label={q} onClick={() => send(q)} variant="muted" padding={3}>
                <Text type="label">{q}</Text>
              </ClickableCard>
            ))}
          </div>
          <Text type="supporting" color="secondary">{t.aiNote}</Text>
        </div>
      </div>
    );
  }

  return (
    <div className="igris-page igris-chat">
      <HStack hAlign={focus ? 'between' : 'end'} vAlign="center" gap={2} wrap="wrap" style={{padding: 'var(--spacing-2) var(--spacing-4)'}}>
        {focus && (
          <HStack gap={2} vAlign="center" wrap="wrap" style={{flex: 1, minWidth: 0}}>
            <Text type="supporting" color="secondary">{t.chatFocus(focus.names.join(', '))}</Text>
            <Button label={t.chatFocusClear} variant="ghost" size="sm" isDisabled={busy} onClick={() => setFocus(null)} />
          </HStack>
        )}
        <Button label={t.newChat} variant="ghost" size="sm" isDisabled={busy} onClick={newChat} />
      </HStack>
      <ChatLayout density="spacious" style={{flex: 1, minHeight: 0}} composer={composer}>
        <ChatMessageList>
          <ChatTurns messages={messages} busy={busy} />
        </ChatMessageList>
      </ChatLayout>
    </div>
  );
}

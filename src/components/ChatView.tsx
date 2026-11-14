'use client';

import {useSearchParams} from 'next/navigation';
import {useCallback, useEffect, useRef, useState} from 'react';
import {ChatComposer, ChatLayout, ChatMessageList} from '@astryxdesign/core/Chat';
import {Button} from '@astryxdesign/core/Button';
import {Heading, Text} from '@astryxdesign/core/Text';
import {HStack} from '@astryxdesign/core/Layout';
import {useSettings} from '@/app/providers';
import {useChat, type ChatMsg} from '@/lib/useChat';
import {takeChatSeed, type ChatFocus} from '@/lib/chatSeed';
import {useChatHistory, type Conversation} from '@/lib/chatHistory';
import {compareHref} from '@/lib/compare';
import {ChatTurns} from '@/components/ChatTurns';

const CHAT_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function ChatView() {
  const search = useSearchParams();
  const {ready, conversations} = useChatHistory();
  const [draftId, setDraftId] = useState('');
  const handledEntry = useRef<string | null>(null);
  const [entry, setEntry] = useState<{id: string; initial?: Conversation; question: string | null}>();
  const requestedId = search.get('chat') ?? '';
  const saved = conversations.find(chat => chat.id === requestedId);
  const hasChatId = CHAT_ID.test(requestedId) || Boolean(saved?.comparison);
  const id = hasChatId ? requestedId : draftId;
  const question = search.get('q');
  const fromCompare = search.get('from') === 'compare';

  useEffect(() => {
    if (requestedId && requestedId === draftId) setDraftId('');
    else if (!hasChatId && !draftId) setDraftId(crypto.randomUUID());
  }, [requestedId, draftId, hasChatId]);

  useEffect(() => {
    if (!question && !fromCompare) {
      handledEntry.current = null;
      return;
    }
    const entryKey = JSON.stringify([question, fromCompare]);
    if (!ready || handledEntry.current === entryKey) return;
    handledEntry.current = entryKey;
    const newId = crypto.randomUUID();
    const seed = fromCompare ? takeChatSeed() : null;
    setEntry({
      id: newId,
      question,
      initial: seed ? {
        id: newId,
        focus: seed.focus,
        messages: seed.messages.map(message => ({...message, steps: []})),
      } : undefined,
    });
    window.history.replaceState(null, '', `/?chat=${newId}`);
  }, [ready, question, fromCompare]);

  if (!ready || !id || question || fromCompare) return null;
  return (
    <ChatSession
      key={id}
      id={id}
      initial={saved ?? (entry?.id === id ? entry.initial : undefined)}
      question={entry?.id === id ? entry.question : null}
      imported={entry?.id === id && Boolean(entry.initial)}
    />
  );
}

function ChatSession({id, initial, question, imported}: {
  id: string;
  initial?: Conversation;
  question: string | null;
  imported: boolean;
}) {
  const {t} = useSettings();
  const {save} = useChatHistory();
  const comparison = initial?.comparison;
  const [focus, setFocus] = useState<ChatFocus | null>(initial?.focus ?? null);
  const changed = useRef(imported);
  const seededQuestionSent = useRef(false);

  const persist = useCallback((messages: ChatMsg[]) => {
    if (!messages.some(m => m.content || m.error)) return;
    save({id, messages, focus, comparison}, 'messages');
  }, [id, focus, comparison, save]);

  const onQuestion = useCallback((messages: ChatMsg[]) => {
    changed.current = true;
    persist(messages);
    if (!new URLSearchParams(window.location.search).has('chat')) {
      window.history.replaceState(null, '', `/?chat=${id}`);
    }
  }, [id, persist]);

  const prefix = comparison ? [
    {role: 'user' as const, content: t.compareSeedQuestion(comparison.names.join(', '))},
    ...(comparison.summary ? [{role: 'assistant' as const, content: comparison.summary.content}] : []),
  ] : undefined;
  const {messages, busy, quota, notice, send, stop} = useChat({
    initialMessages: initial?.messages, focus: comparison?.ids ?? focus?.ids, onQuestion, prefix,
  });

  useEffect(() => {
    if (!question || seededQuestionSent.current) return;
    const timer = window.setTimeout(() => {
      seededQuestionSent.current = true;
      void send(question);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [question, send]);

  useEffect(() => {
    if (!busy && changed.current) persist(messages);
  }, [busy, messages, persist]);

  const composer = (
    <ChatComposer
      onSubmit={send}
      onStop={stop}
      isStopShown={busy}
      placeholder={t.chatPlaceholder}
      status={notice ? {type: 'warning', message: notice} : undefined}
      headerContext={quota ? (
        <Text type="supporting" color="secondary">{t.remaining(quota.left, quota.perDay)}</Text>
      ) : undefined}
    />
  );

  if (messages.length === 0 && !comparison) return (
    <div className="igris-page igris-chat">
      <div className="igris-landing">
        <Heading level={1}>{t.chatTitle}</Heading>
        {composer}
      </div>
    </div>
  );

  return (
    <div className="igris-page igris-chat">
      {focus && (
        <HStack vAlign="center" gap={2} wrap="wrap" style={{padding: '8px 16px'}}>
          <Text type="supporting" color="secondary">{t.chatFocus(focus.names.join(', '))}</Text>
          {comparison
            ? <Button label={t.openComparison} variant="ghost" size="sm" href={compareHref(comparison.ids)} />
            : <Button label={t.chatFocusClear} variant="ghost" size="sm" isDisabled={busy} onClick={() => { changed.current = true; setFocus(null); }} />}
        </HStack>
      )}
      <ChatLayout density="spacious" style={{flex: 1, minHeight: 0}} composer={composer}>
        <ChatMessageList>
          <ChatTurns messages={comparison?.summary ? [comparison.summary, ...messages] : messages} busy={busy} />
        </ChatMessageList>
      </ChatLayout>
    </div>
  );
}

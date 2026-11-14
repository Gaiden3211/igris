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
import {useApi} from '@/lib/useApi';
import {ChatTurns} from '@/components/ChatTurns';

const CHAT_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function ChatView() {
  const search = useSearchParams();
  const {ready, conversations} = useChatHistory();
  const [draftId, setDraftId] = useState('');
  const handledEntry = useRef<string | null>(null);
  const [entry, setEntry] = useState<{id: string; initial?: Conversation; question: string | null}>();
  const requestedId = search.get('chat') ?? '';
  const id = CHAT_ID.test(requestedId) ? requestedId : draftId;
  const question = search.get('q');
  const fromCompare = search.get('from') === 'compare';

  useEffect(() => {
    if (requestedId && requestedId === draftId) setDraftId('');
    else if (!CHAT_ID.test(requestedId) && !draftId) setDraftId(crypto.randomUUID());
  }, [requestedId, draftId]);

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
        domain: '',
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
      initial={conversations.find(chat => chat.id === id) ?? (entry?.id === id ? entry.initial : undefined)}
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
  const [domain, setDomain] = useState(initial?.domain ?? '');
  const [focus, setFocus] = useState<ChatFocus | null>(initial?.focus ?? null);
  const changed = useRef(imported);
  const seededQuestionSent = useRef(false);
  const meta = useApi<{domains: {id: string; name: string}[]}>('/api/meta');

  const persist = useCallback((messages: ChatMsg[]) => {
    if (!messages.some(m => m.content || m.error)) return;
    save({id, messages, domain, focus});
  }, [id, domain, focus, save]);

  const onQuestion = useCallback((messages: ChatMsg[]) => {
    changed.current = true;
    persist(messages);
    if (!new URLSearchParams(window.location.search).has('chat')) {
      window.history.replaceState(null, '', `/?chat=${id}`);
    }
  }, [id, persist]);

  const {messages, busy, quota, notice, send, stop} = useChat({
    initialMessages: initial?.messages, focus: focus?.ids, domain, onQuestion,
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
      footerActions={(meta.data?.domains.length || domain) ? (
        <label className="igris-chat-area">
          <span>{t.area}</span>
          <select value={domain} disabled={busy} onChange={event => { changed.current = true; setDomain(event.target.value); }}>
            <option value="">{t.allAreas}</option>
            {meta.data?.domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
      ) : undefined}
      headerContext={quota ? (
        <Text type="supporting" color="secondary">{t.remaining(quota.left, quota.perDay)}</Text>
      ) : undefined}
    />
  );

  if (messages.length === 0) return (
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
          <Button label={t.chatFocusClear} variant="ghost" size="sm" isDisabled={busy} onClick={() => { changed.current = true; setFocus(null); }} />
        </HStack>
      )}
      <ChatLayout density="spacious" style={{flex: 1, minHeight: 0}} composer={composer}>
        <ChatMessageList>
          <ChatTurns messages={messages} busy={busy} />
        </ChatMessageList>
      </ChatLayout>
    </div>
  );
}

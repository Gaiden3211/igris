'use client';

import {AssistantRuntimeProvider, type AssistantRuntime} from '@assistant-ui/react';
import {useRouter, useSearchParams} from 'next/navigation';
import {useCallback, useEffect, useRef, useState} from 'react';
import {ChatComposer, ChatLayout, ChatMessageList} from '@astryxdesign/core/Chat';
import {Button} from '@astryxdesign/core/Button';
import {Heading, Text} from '@astryxdesign/core/Text';
import {HStack} from '@astryxdesign/core/Layout';
import {useSettings} from '@/app/providers';
import {useChat, useChatRuntime} from '@/lib/useChat';
import {latestResponseText, type ChatMsg, type ChatRepository} from '@/lib/chatAdapter';
import {takeChatSeed, type ChatFocus} from '@/lib/chatSeed';
import {useChatHistory, type Conversation} from '@/lib/chatHistory';
import {exportRepository} from '@/lib/chatRepository';
import {compareHref, comparisonIds} from '@/lib/compare';
import {ConversationSlot} from './ConversationSessions';
import {useConversationActivity} from '@/lib/conversationActivity';
import {ChatTurns} from '@/components/ChatTurns';

const CHAT_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function ChatView() {
  const search = useSearchParams();
  const router = useRouter();
  const {ready, conversations} = useChatHistory();
  const [draftId, setDraftId] = useState('');
  const handledEntry = useRef<string | null>(null);
  const [entry, setEntry] = useState<{id: string; initial?: Conversation; question: string | null}>();
  const requestedId = search.get('chat') ?? '';
  const saved = conversations.find(chat => chat.id === requestedId);
  const legacyComparison = requestedId.startsWith('comparison:') ? comparisonIds(requestedId.slice('comparison:'.length)) : [];
  const comparisonDestination = legacyComparison.length >= 2 ? compareHref(saved?.comparison?.ids ?? legacyComparison) : null;
  const hasChatId = CHAT_ID.test(requestedId);
  const id = hasChatId ? requestedId : draftId;
  const question = search.get('q');
  const fromCompare = search.get('from') === 'compare';

  useEffect(() => {
    if (ready && comparisonDestination) router.replace(comparisonDestination);
  }, [ready, comparisonDestination, router]);

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

  if (!ready || !id || question || fromCompare || comparisonDestination) return null;
  return (
    <ConversationSlot key={id} id={id}><ChatSession
      key={id}
      id={id}
      initial={saved ?? (entry?.id === id ? entry.initial : undefined)}
      question={entry?.id === id ? entry.question : null}
      imported={entry?.id === id && Boolean(entry.initial)}
    /></ConversationSlot>
  );
}

interface ChatSessionProps {
  id: string;
  initial?: Conversation;
  question: string | null;
  imported: boolean;
}

function ChatSession(props: ChatSessionProps) {
  const {save} = useChatHistory();
  const {id, initial, imported} = props;
  const [focus, setFocus] = useState<ChatFocus | null>(initial?.focus ?? null);
  const changed = useRef(imported);
  const persist = useCallback((messages: ChatMsg[], repository?: ChatRepository) => {
    if (!messages.some(message => message.content || message.error)) return;
    save({id, messages, focus, repository}, 'messages');
  }, [id, focus, save]);

  const onQuestion = useCallback((messages: ChatMsg[]) => {
    changed.current = true;
    if (!initial?.messages.length) persist(messages);
    if (window.location.pathname === '/' && !new URLSearchParams(window.location.search).has('chat')) {
      window.history.replaceState(null, '', `/?chat=${id}`);
    }
  }, [id, initial?.messages.length, persist]);
  const runtime = useChatRuntime({
    initialMessages: initial?.messages,
    focus: focus?.ids,
    onQuestion,
  });

  return <AssistantRuntimeProvider runtime={runtime}>
    <ChatSessionContent
      id={id} runtime={runtime} repository={initial?.repository}
      question={props.question} focus={focus} persist={persist} changed={changed}
      clearFocus={() => { changed.current = true; setFocus(null); }}
    />
  </AssistantRuntimeProvider>;
}

function ChatSessionContent({id, runtime, repository, question, focus, persist, changed, clearFocus}: {
  id: string;
  runtime: AssistantRuntime;
  repository?: ChatRepository;
  question: string | null;
  focus: ChatFocus | null;
  persist: (messages: ChatMsg[], repository?: ChatRepository) => void;
  changed: React.RefObject<boolean>;
  clearFocus: () => void;
}) {
  const {t} = useSettings();
  const seededQuestionSent = useRef(false);
  const {ready, messages, busy, send, stop} = useChat(runtime, repository);

  const viewed = useConversationActivity(id, busy, latestResponseText(messages));

  useEffect(() => {
    if (!ready || !question || seededQuestionSent.current) return;
    const timer = window.setTimeout(() => {
      seededQuestionSent.current = true;
      void send(question);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [ready, question, send]);

  useEffect(() => {
    if (ready && !busy && changed.current) persist(messages, exportRepository(runtime));
  }, [ready, busy, messages, persist, runtime, changed]);

  const composer = (
    <ChatComposer
      isDisabled={!ready || busy}
      onSubmit={send}
      onStop={stop}
      isStopShown={busy}
      placeholder={messages.length ? t.chatFollowUp : t.chatPlaceholder}
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
          <Button label={t.chatFocusClear} variant="ghost" size="sm" isDisabled={busy} onClick={clearFocus} />
        </HStack>
      )}
      <ChatLayout density="spacious" style={{flex: 1, minHeight: 0}} composer={composer}>
        <ChatMessageList isStreaming={busy}>
          <ChatTurns />
          <div ref={viewed} />
        </ChatMessageList>
      </ChatLayout>
    </div>
  );
}

'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';
import {useAuiState, useLocalRuntime, type AssistantRuntime} from '@assistant-ui/react';
import {useSettings} from '@/app/providers';
import {createChatAdapter, fromRuntimeMessage, toRuntimeMessage, type ChatMsg, type ChatOptions, type ChatRepository} from './chatAdapter';
import {restoreRepository} from './chatRepository';

export function useChatRuntime({initialMessages, onQuestion, ...options}: ChatOptions & {
  initialMessages?: ChatMsg[];
  onQuestion?: (messages: ChatMsg[]) => void;
}) {
  const {t} = useSettings();
  const [seed] = useState(() => initialMessages?.map(toRuntimeMessage));
  return useLocalRuntime(createChatAdapter({...options, t, onQuestion}), {initialMessages: seed});
}

/** Read the mounted thread from inside its AssistantRuntimeProvider. */
export function useChat(runtime: AssistantRuntime, repository?: ChatRepository) {
  const [savedRepository] = useState(repository);
  const [restored, setRestored] = useState(!savedRepository);
  const loading = useAuiState(s => s.thread.isLoading);
  const busy = useAuiState(s => s.thread.isRunning);
  const turns = useAuiState(s => s.thread.messages);
  const ready = !loading && restored;

  useEffect(() => {
    if (loading || restored || !savedRepository) return;
    runtime.thread.import(restoreRepository(savedRepository));
    setRestored(true);
  }, [loading, restored, runtime, savedRepository]);

  const messages = useMemo(() => turns.map(fromRuntimeMessage), [turns]);
  const send = useCallback((raw: string) => {
    const text = raw.trim();
    if (!ready || !text) return;
    const thread = runtime.thread;
    if (!thread.getState().isRunning) thread.append(text);
  }, [ready, runtime]);
  const stop = useCallback(() => {
    if (ready && runtime.thread.getState().isRunning) runtime.thread.cancelRun();
  }, [ready, runtime]);
  return {ready, messages, busy, send, stop};
}

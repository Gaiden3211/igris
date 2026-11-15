'use client';

import {useState} from 'react';

import {ThreadPrimitive, ActionBarPrimitive, BranchPickerPrimitive, useAui, useAuiState} from '@assistant-ui/react';
import {ChatComposer, ChatMessage, ChatMessageBubble} from '@astryxdesign/core/Chat';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Button} from '@astryxdesign/core/Button';
import {Icon} from '@astryxdesign/core/Icon';
import {HStack} from '@astryxdesign/core/Layout';
import {Markdown} from '@astryxdesign/core/Markdown';
import {Text} from '@astryxdesign/core/Text';
import {CheckIcon, ClipboardIcon, ArrowPathIcon, PencilSquareIcon, ChevronLeftIcon, ChevronRightIcon} from '@heroicons/react/24/outline';
import {useSettings} from '@/app/providers';
import {linkCitations} from '@/lib/citations';
import {fromRuntimeMessage, type ChatMsg, type ChatStep} from '@/lib/chatAdapter';
import {SourceCards} from './SourceCards';

export function ChatTurns() {
  return <ThreadPrimitive.Messages components={{Message: RuntimeMessage, EditComposer: EditMessage}} />;
}

function EditMessage() {
  const aui = useAui();
  const {t} = useSettings();
  const initialText = useAuiState(s => s.message.composer.text);
  const [draft, setDraft] = useState(initialText);
  const submit = (text: string) => {
    const composer = aui.message().composer();
    composer.setText(text);
    composer.send();
  };
  return <ChatMessage sender="user">
    <ChatComposer value={draft} onChange={setDraft}
      onSubmit={submit} placeholder={t.chatPlaceholder}
      footerActions={<Button label={t.cancel} size="sm" variant="ghost" onClick={() => aui.message().composer().cancel()} />} />
  </ChatMessage>;
}

function RuntimeMessage() {
  const {t} = useSettings();
  const message = useAuiState(s => s.message);
  const busy = useAuiState(s => s.thread.isRunning);
  const turn = fromRuntimeMessage(message);
  const copyLabel = message.isCopied ? t.copied : t.copyAnswer;
  const retryLabel = turn.content ? t.regenerate : t.compareRetry;
  const streaming = message.role === 'assistant' && message.status.type === 'running';
  const actions = !streaming && <HStack className="igris-message-actions" gap={0} vAlign="center" role="group" aria-label={t.chatActions}>
    {turn.content && <ActionBarPrimitive.Copy asChild>
      <IconButton label={copyLabel} tooltip={copyLabel} icon={<Icon icon={message.isCopied ? CheckIcon : ClipboardIcon} />} variant="ghost" size="sm" />
    </ActionBarPrimitive.Copy>}
    {message.role === 'assistant' ? <ActionBarPrimitive.Reload asChild>
      <IconButton label={retryLabel} tooltip={retryLabel} icon={<Icon icon={ArrowPathIcon} />} variant="ghost" size="sm" isDisabled={busy} />
    </ActionBarPrimitive.Reload> : <ActionBarPrimitive.Edit asChild>
      <IconButton label={t.editMessage} tooltip={t.editMessage} icon={<Icon icon={PencilSquareIcon} />} variant="ghost" size="sm" isDisabled={busy} />
    </ActionBarPrimitive.Edit>}
    <BranchPickerPrimitive.Root hideWhenSingleBranch asChild>
      <HStack gap={0} vAlign="center">
        <BranchPickerPrimitive.Previous asChild><IconButton label={t.previousVersion} icon={<Icon icon={ChevronLeftIcon} />} variant="ghost" size="sm" isDisabled={busy} /></BranchPickerPrimitive.Previous>
        <Text type="supporting" color="secondary"><BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count /></Text>
        <BranchPickerPrimitive.Next asChild><IconButton label={t.nextVersion} icon={<Icon icon={ChevronRightIcon} />} variant="ghost" size="sm" isDisabled={busy} /></BranchPickerPrimitive.Next>
      </HStack>
    </BranchPickerPrimitive.Root>
  </HStack>;
  return <TurnContent message={turn} busy={streaming} actions={actions} />;
}

function TurnContent({message: m, busy, actions}: {message: ChatMsg; busy: boolean; actions: React.ReactNode}) {
  const {t} = useSettings();
  const stepLabel = (s: ChatStep) => s.id === 'context' ? t.stepContext : s.id === 'plan' ? t.stepPlan : s.id === 'search' ? t.stepSearch : s.id === 'web' ? t.stepWeb : s.id === 'verify' ? t.stepVerify : t.stepAnswer;
  const active = m.steps.findLast(step => step.status === 'running');
  return <ChatMessage sender={m.role}>
    {m.role === 'user' ? <ChatMessageBubble>{m.content}</ChatMessageBubble> : <>
      {busy && !m.content && <Text type="supporting" color="secondary" role="status">{active ? stepLabel(active) : t.thinking}</Text>}
      {m.content && (
        <ChatMessageBubble variant="ghost" width="100%">
          <Markdown className="igris-chat-answer" density="compact">{linkCitations(m.content, m.cards)}</Markdown>
        </ChatMessageBubble>
      )}
      {m.error && <ChatMessageBubble variant="ghost"><Text type="supporting" color="secondary" role="alert">
        {m.errorCode === 'answer_unverified' ? t.errUnverified : m.errorCode === 'answer_incomplete' ? t.errIncomplete : m.errorCode === 'model_unavailable' ? t.errModel : m.error}
      </Text></ChatMessageBubble>}
      {m.cards.length > 0 && !busy && <ChatMessageBubble variant="ghost" width="100%"><SourceCards cards={m.cards} title={t.sources} answer={m.content} /></ChatMessageBubble>}
    </>}
    {actions && (m.role === 'user'
      ? <div className="igris-message-footer--user">{actions}</div>
      : <ChatMessageBubble variant="ghost" width="100%">{actions}</ChatMessageBubble>)}
  </ChatMessage>;
}

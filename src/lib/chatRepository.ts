import {ExportedMessageRepository, type AssistantRuntime} from '@assistant-ui/react';
import {fromRuntimeMessage, toRuntimeMessage, chatRepositorySchema, type ChatRepository} from './chatAdapter';

export function restoreRepository(saved: ChatRepository) {
  return ExportedMessageRepository.fromBranchableArray(saved.messages.map(({parentId, message}) => ({
    parentId, message: {...toRuntimeMessage(message), id: message.id},
  })), {headId: saved.headId});
}
export function exportRepository(runtime: AssistantRuntime): ChatRepository | undefined {
  const repository = runtime.thread.export();
  if (repository.messages.length <= runtime.thread.getState().messages.length) return;
  const parsed = chatRepositorySchema.safeParse({headId: repository.headId ?? null, messages: repository.messages.map(({parentId, message}) => ({
    parentId, message: {...fromRuntimeMessage(message), id: message.id},
  }))});
  // Long threads retain the existing bounded active-path history instead.
  return parsed.success ? parsed.data : undefined;
}

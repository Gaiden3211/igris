import Link from 'next/link';
import {EllipsisHorizontalIcon, PaperClipIcon, TrashIcon} from '@heroicons/react/24/outline';
import {DropdownMenu, DropdownMenuItem} from '@astryxdesign/core/DropdownMenu';
import {useSettings} from '@/app/providers';
import {conversationTitle, type Conversation} from '@/lib/chatHistory';

export function ChatHistoryRow({chat, onOpen, onPin, onDelete}: {
  chat: Conversation;
  onOpen: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  const {t} = useSettings();
  const label = conversationTitle(chat) || t.navChat;
  const pinLabel = chat.pinned ? t.unpinChat : t.pinChat;
  const link = (
    <Link href={`/?chat=${encodeURIComponent(chat.id)}`} className="igris-nav-link" title={label} prefetch={false} onClick={onOpen}>
      <span>{label}</span>
    </Link>
  );

  if (chat.comparison) return link;
  return (
    <div className="igris-history-row">
      {link}
      <div className="igris-history-actions">
        <button type="button" className="igris-icon-button" aria-label={pinLabel} title={pinLabel}
          aria-pressed={Boolean(chat.pinned)} onClick={onPin}>
          <PaperClipIcon aria-hidden="true" />
        </button>
        <DropdownMenu className="igris-history-menu" alignment="end" menuWidth={150}
          renderTrigger={props => (
            <button {...props} type="button" className="igris-icon-button" aria-label={t.chatActions} title={t.chatActions}>
              <EllipsisHorizontalIcon aria-hidden="true" />
            </button>
          )}>
          <DropdownMenuItem label={t.deleteChat} icon={<TrashIcon />} variant="destructive" onClick={onDelete} />
        </DropdownMenu>
      </div>
    </div>
  );
}

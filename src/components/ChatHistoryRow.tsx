import Link from 'next/link';
import {EllipsisHorizontalIcon, TrashIcon} from '@heroicons/react/24/outline';
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
          <svg aria-hidden="true" viewBox="0 0 24 24" fill={chat.pinned ? 'currentColor' : 'none'}
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m16 3 5 5-2.5 1-3 3v4l-1 1L7 9.5l1-1h4l3-3L16 3Z" />
            <path d="m10.75 13.25-6.5 6.5" />
          </svg>
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

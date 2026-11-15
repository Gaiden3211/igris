import {useState, type SVGProps} from 'react';
import {ContextMenu} from '@astryxdesign/core/ContextMenu';
import {Spinner} from '@astryxdesign/core/Spinner';
import Link from 'next/link';
import {EllipsisHorizontalIcon, TrashIcon} from '@heroicons/react/24/outline';
import {DropdownMenu, DropdownMenuItem} from '@astryxdesign/core/DropdownMenu';
import {compareHref} from '@/lib/compare';
import {useSettings} from '@/app/providers';
import {conversationTitle, useChatHistory, type Conversation} from '@/lib/chatHistory';


function PinIcon(props: SVGProps<SVGSVGElement>) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="m16 3 5 5-2.5 1-3 3v4l-1 1L7 9.5l1-1h4l3-3L16 3Z" />
    <path d="m10.75 13.25-6.5 6.5" />
  </svg>;
}

export function ChatHistoryRow({chat, onOpen, onPin, onDelete}: {
  chat: Conversation;
  onOpen: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  const {t, lang} = useSettings();
  const {running} = useChatHistory();
  const [menuOpen, setMenuOpen] = useState(false);
  const busy = Boolean(running[chat.id]?.length);
  const label = conversationTitle(chat, lang) || t.navChat;
  const pinLabel = chat.pinned ? t.unpinChat : t.pinChat;
  const link = (
    <Link href={chat.comparison ? compareHref(chat.comparison.ids) : `/?chat=${encodeURIComponent(chat.id)}`} className="igris-nav-link" title={label} prefetch={false} onClick={onOpen}>
      <span>{label}</span>
    </Link>
  );

  const pinIcon = <PinIcon fill={chat.pinned ? 'currentColor' : 'none'} />;
  const deleteLabel = chat.comparison ? t.deleteComparison : t.deleteChat;
  return (
    <ContextMenu label={t.chatActions} presentation="popover" menuWidth={210} onOpenChange={setMenuOpen}
      menuContent={<>
        <DropdownMenuItem label={pinLabel} icon={PinIcon} onClick={onPin} />
        <DropdownMenuItem label={deleteLabel} icon={TrashIcon} variant="destructive" onClick={onDelete} />
      </>}>
    <div className="igris-history-row" data-menu-open={menuOpen}>
      {link}
      <div className="igris-history-status">
        {chat.pinned && <span className="igris-history-pinned" aria-label={pinLabel}>{pinIcon}</span>}
        {busy ? <Spinner size="sm" shade="inherit" aria-label={t.assistantWorking} />
          : chat.unread ? <span className="igris-unread" role="img" aria-label={t.newAnswer} /> : null}
      </div>
      <div className="igris-history-actions">
        <button type="button" className="igris-icon-button" aria-label={pinLabel} title={pinLabel}
          aria-pressed={Boolean(chat.pinned)} onClick={onPin}>
          {pinIcon}
        </button>
        <DropdownMenu className="igris-history-menu" alignment="end" menuWidth={150}
          renderTrigger={props => (
            <button {...props} type="button" className="igris-icon-button" aria-label={t.chatActions} title={t.chatActions}>
              <EllipsisHorizontalIcon aria-hidden="true" />
            </button>
          )}>
          <DropdownMenuItem label={deleteLabel} icon={TrashIcon} variant="destructive" onClick={onDelete} />
        </DropdownMenu>
      </div>
    </div>
    </ContextMenu>
  );
}

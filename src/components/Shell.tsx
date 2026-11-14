'use client';

import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {useEffect, useRef, useState, type ReactNode} from 'react';
import {
  Bars3Icon, ChartBarIcon, ChatBubbleLeftRightIcon, Cog6ToothIcon, PencilSquareIcon, Squares2X2Icon, XMarkIcon,
} from '@heroicons/react/24/outline';
import {conversationTitle, useChatHistory} from '@/lib/chatHistory';
import {useSettings} from '@/app/providers';

export function Shell({children}: {children: ReactNode}) {
  const path = usePathname();
  const router = useRouter();
  const {conversations} = useChatHistory();
  const {t, mode, lang, set, ready, welcomed, finishWelcome} = useSettings();
  const drawer = useRef<HTMLDialogElement>(null);
  const settings = useRef<HTMLDialogElement>(null);
  const welcome = useRef<HTMLDialogElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const dialog = welcome.current;
    if (ready && !welcomed && dialog && !dialog.open) dialog.showModal();
  }, [ready, welcomed]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 769px)');
    const closeDrawer = () => { if (desktop.matches) drawer.current?.close(); };
    desktop.addEventListener('change', closeDrawer);
    return () => desktop.removeEventListener('change', closeDrawer);
  }, []);

  const nav = [
    {href: '/', label: t.navChat, icon: ChatBubbleLeftRightIcon, active: path === '/'},
    {href: '/catalog', label: t.navCatalog, icon: Squares2X2Icon, active: /^(\/catalog|\/investigations|\/compare)/.test(path)},
    {href: '/analytics', label: t.navAnalytics, icon: ChartBarIcon, active: path === '/analytics'},
  ];

  const sidebar = (mobile: boolean) => (
    <div className="igris-sidebar-inner">
      <div className="igris-sidebar-header">
        <Link href="/" className="igris-wordmark" onClick={() => drawer.current?.close()}>Igris</Link>
        <button type="button" className="igris-icon-button" aria-label={mobile ? t.close : t.hideSidebar}
          onClick={() => mobile ? drawer.current?.close() : setCollapsed(true)}>
          {mobile ? <XMarkIcon /> : <Bars3Icon />}
        </button>
      </div>
      <button type="button" className="igris-nav-link igris-new-chat" onClick={() => {
        drawer.current?.close();
        router.push(`/?chat=${crypto.randomUUID()}`);
      }}>
        <PencilSquareIcon aria-hidden="true" />{t.newChat}
      </button>
      <nav className="igris-sidebar-nav" aria-label={t.navigation}>
        {nav.map(({href, label, icon: Icon, active}) => (
          <Link key={href} href={href} className="igris-nav-link" aria-current={active ? 'page' : undefined}
            onClick={() => drawer.current?.close()}>
            <Icon aria-hidden="true" />{label}
          </Link>
        ))}
      </nav>
      <div className="igris-sidebar-chats">
        {conversations.length > 0 && (
          <nav aria-label={t.chatHistory}>
            <h2>{t.chatHistory}</h2>
            {conversations.map(chat => {
              const title = conversationTitle(chat) || t.navChat;
              return (
                <Link key={chat.id} href={`/?chat=${chat.id}`} className="igris-nav-link" title={title} prefetch={false}
                  onClick={() => drawer.current?.close()}>
                  <span>{title}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>
      <div className="igris-sidebar-footer">
        <span>{t.anonymous}</span>
        <button type="button" className="igris-icon-button" aria-label={t.settings} aria-haspopup="dialog" onClick={() => {
          settings.current?.showModal();
        }}>
          <Cog6ToothIcon />
        </button>
      </div>
    </div>
  );

  return (
    <div className="igris-shell" data-collapsed={collapsed}>
      <a className="igris-skip" href="#igris-main">{t.skip}</a>
      <aside className="igris-sidebar">{sidebar(false)}</aside>
      <div className="igris-shell-body">
        <header className="igris-topbar">
          <button type="button" className="igris-icon-button" aria-label={t.showSidebar} onClick={() => {
            if (window.matchMedia('(min-width: 769px)').matches) setCollapsed(false);
            else drawer.current?.showModal();
          }}>
            <Bars3Icon />
          </button>
          <Link href="/" className="igris-wordmark">Igris</Link>
        </header>
        <main id="igris-main" tabIndex={-1} className="igris-main">{children}</main>
      </div>

      <dialog ref={drawer} className="igris-drawer" aria-label={t.navigation} onClick={event => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}>
        {sidebar(true)}
      </dialog>

      <dialog ref={settings} className="igris-dialog" aria-labelledby="igris-settings-title" onClick={event => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}>
        <div className="igris-dialog-content">
          <div className="igris-dialog-heading">
            <h2 id="igris-settings-title">{t.settings}</h2>
            <button type="button" className="igris-icon-button" aria-label={t.close} onClick={() => settings.current?.close()}><XMarkIcon /></button>
          </div>
          <label className="igris-setting">
            {t.theme}
            <select value={mode} onChange={event => set({mode: event.target.value === 'dark' ? 'dark' : 'light'})}>
              <option value="light">{t.themeLight}</option>
              <option value="dark">{t.themeDark}</option>
            </select>
          </label>
          <label className="igris-setting">
            {t.language}
            <select value={lang} onChange={event => set({lang: event.target.value === 'uk' ? 'uk' : 'en'})}>
              <option value="en" lang="en">English</option>
              <option value="uk" lang="uk">Українська</option>
            </select>
          </label>
          <section className="igris-settings-info">
            <h3>{t.additionalInfo}</h3>
            <Link href="/sources" onClick={() => {
              settings.current?.close();
              drawer.current?.close();
            }}>{t.navSources}</Link>
            <a href="https://github.com/Gaiden3211/igris">{t.projectRepository}</a>
          </section>
        </div>
      </dialog>

      <dialog ref={welcome} className="igris-dialog" aria-labelledby="igris-welcome-title" onCancel={event => event.preventDefault()}>
        <form className="igris-dialog-content" onSubmit={event => {
          event.preventDefault();
          finishWelcome();
          welcome.current?.close();
        }}>
          <h2 id="igris-welcome-title">{t.welcomeTitle}</h2>
          <label className="igris-setting">
            {t.language}
            <select value={lang} onChange={event => set({lang: event.target.value === 'uk' ? 'uk' : 'en'})}>
              <option value="en" lang="en">English</option>
              <option value="uk" lang="uk">Українська</option>
            </select>
          </label>
          <button className="igris-primary" type="submit">{t.continue}</button>
        </form>
      </dialog>
    </div>
  );
}

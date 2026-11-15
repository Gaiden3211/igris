'use client';

import NextLink from 'next/link';
import type {ComponentProps} from 'react';

const investigationPath = /^\/investigations\/PSI-\d{1,6}$/;
const backKey = 'igrisInvestigationBack';
let pendingPath: string | undefined;

/** Track same-tab investigation visits through Astryx links. Next.js owns the history entries. */
export function AppLink({href, onNavigate, replace, ...props}: ComponentProps<typeof NextLink>) {
  return <NextLink {...props} href={href} replace={replace} onNavigate={event => {
    onNavigate?.(event);
    if (!replace && typeof href === 'string' && investigationPath.test(href) && window.location.pathname !== href) {
      pendingPath = href;
    }
  }} />;
}

export function markInvestigationEntry() {
  if (pendingPath !== window.location.pathname) return;
  pendingPath = undefined;
  window.history.replaceState({...window.history.state, [backKey]: window.location.pathname}, '');
}

export function openedInsideIgris() {
  return window.history.state?.[backKey] === window.location.pathname && window.history.length > 1;
}

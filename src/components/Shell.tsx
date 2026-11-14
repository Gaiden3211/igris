'use client';

import {usePathname} from 'next/navigation';
import {useEffect, useState} from 'react';
import {AppShell} from '@astryxdesign/core/AppShell';
import {SideNav, SideNavHeading, SideNavItem, SideNavSection} from '@astryxdesign/core/SideNav';
import {Selector} from '@astryxdesign/core/Selector';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {VStack} from '@astryxdesign/core/Layout';
import {Text} from '@astryxdesign/core/Text';
import {
  ChatBubbleLeftRightIcon,
  Squares2X2Icon,
  ChartBarIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline';
import {useSettings, type Glow, type Mode} from '@/app/providers';
import type {Lang} from '@/lib/i18n';
import {useApi} from '@/lib/useApi';

interface Meta {
  domains: {id: string; name: string}[];
}

export function Shell({children}: {children: React.ReactNode}) {
  const path = usePathname();
  const {t, mode, lang, glow, domain, set} = useSettings();
  const meta = useApi<Meta>('/api/meta');
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const nav = [
    {href: '/', label: t.navChat, icon: ChatBubbleLeftRightIcon, on: path === '/'},
    {href: '/catalog', label: t.navCatalog, icon: Squares2X2Icon, on: path.startsWith('/catalog') || path.startsWith('/investigations') || path.startsWith('/compare')},
    {href: '/analytics', label: t.navAnalytics, icon: ChartBarIcon, on: path.startsWith('/analytics')},
    {href: '/sources', label: t.navSources, icon: BookOpenIcon, on: path.startsWith('/sources')},
  ];

  const domainOptions = [{value: 'all', label: t.allAreas}, ...(meta.data?.domains ?? []).map(d => ({value: d.id, label: d.name}))];

  return (
    <AppShell
      height="fill"
      contentPadding={0}
      sideNav={
        <SideNav
          collapsible
          header={<SideNavHeading heading="Igris" subheading={t.appTagline} headingHref="/" />}
          footer={
            mounted ? (
              <VStack gap={3}>
                <Selector
                  label={t.area}
                  size="sm"
                  options={domainOptions}
                  value={domain || 'all'}
                  onChange={v => set({domain: !v || v === 'all' ? '' : v})}
                />
                <Selector
                  label={t.glow}
                  size="sm"
                  options={[
                    {value: 'mono', label: t.glowMono},
                    {value: 'amber', label: t.glowAmber},
                    {value: 'blue', label: t.glowBlue},
                    {value: 'violet', label: t.glowViolet},
                    {value: 'green', label: t.glowGreen},
                    {value: 'off', label: t.glowOff},
                  ]}
                  value={glow}
                  onChange={v => v && set({glow: v as Glow})}
                />
                <VStack gap={1}>
                  <Text type="supporting" color="secondary">{t.theme}</Text>
                  <SegmentedControl label={t.theme} size="sm" layout="fill" value={mode} onChange={v => set({mode: v as Mode})}>
                    <SegmentedControlItem value="light" label={t.themeLight} />
                    <SegmentedControlItem value="dark" label={t.themeDark} />
                    <SegmentedControlItem value="system" label={t.themeSystem} />
                  </SegmentedControl>
                </VStack>
                <VStack gap={1}>
                  <Text type="supporting" color="secondary">{t.language}</Text>
                  <SegmentedControl label={t.language} size="sm" layout="fill" value={lang} onChange={v => set({lang: v as Lang})}>
                    <SegmentedControlItem value="en" label="English" />
                    <SegmentedControlItem value="uk" label="Українська" />
                  </SegmentedControl>
                </VStack>
              </VStack>
            ) : null
          }>
          <SideNavSection title="Igris" isHeaderHidden>
            {nav.map(n => (
              <SideNavItem key={n.href} label={n.label} href={n.href} icon={n.icon} isSelected={n.on} />
            ))}
          </SideNavSection>
        </SideNav>
      }>
      {children}
    </AppShell>
  );
}

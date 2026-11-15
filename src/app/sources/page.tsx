'use client';

import {Card} from '@astryxdesign/core/Card';
import {Link} from '@astryxdesign/core/Link';
import {Heading, Text} from '@astryxdesign/core/Text';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {useSettings} from '@/app/providers';
import {challengeSourceLink, challengeSources} from '@/lib/agent/challenge-sources';
import {associationsForSource} from '@/lib/agent/source-links';
import {safeSourceUrl} from '@/lib/citations';
import {useApi} from '@/lib/useApi';
import {BackArrow} from '@/components/BackArrow';
import {useOpenSettings} from '@/components/Shell';
import {PageHeader} from '@/components/PageHeader';

interface Meta {
  sources: {
    kind: string;
    title: string;
    url: string;
  }[];
  model: string;
}

export default function SourcesPage() {
  const {t, lang} = useSettings();
  const openSettings = useOpenSettings();
  const meta = useApi<Meta>('/api/meta');
  const kinds: [string, string][] = [
    ['data', t.kindData], ['reference', t.kindReference], ['image', t.kindImage],
  ];
  const challengeUrls = new Set(challengeSources.map(source => challengeSourceLink(source).url));
  const radiumUrl = safeSourceUrl(meta.data?.sources.find(source => source.kind === 'ai')?.url);

  return (
    <div className="igris-page">
      <div className="igris-content">
        <VStack gap={5}>
          <HStack gap={2} vAlign="center">
            <BackArrow label={t.backToSettings} onClick={openSettings} />
            <PageHeader title={t.sourcesTitle} />
          </HStack>
          <Card>
            <VStack gap={2}>
              <Heading level={2}>{t.dataFlowTitle}</Heading>
              {t.dataFlow.map(line => <Text key={line}>{line}</Text>)}
            </VStack>
          </Card>
          <Card>
            <VStack gap={2}>
              <Heading level={2}>{t.aiUseTitle}</Heading>
              {t.aiUse.map(line => (
                <Text key={line}>• {line}</Text>
              ))}
            </VStack>
          </Card>
          {meta.error && <EmptyState title={meta.error === 'not_configured' ? t.errNoDb : t.errData} />}
          <Card>
            <VStack gap={3}>
              <Heading level={2}>{t.challengeSourcesTitle}</Heading>
              {challengeSources.map(source => {
                const link = challengeSourceLink(source);
                const associations = associationsForSource(link.id);
                return (
                  <VStack key={link.id} gap={0}>
                    <Link href={link.url}>{source.title}</Link>
                    {source.supportingUrls?.map(url => <Link key={url} href={safeSourceUrl(url)}>{lang === 'uk' ? 'Додаткове першоджерело' : 'Supporting primary source'}</Link>)}
                    {associations.length > 0 ? (
                      <HStack gap={2} wrap="wrap">
                        {associations.map(item => (
                          <Link key={item.investigationId} href={`/investigations/${item.investigationId}`}>
                            {item.investigationId} – {t.sourceRelations[item.relation]}
                          </Link>
                        ))}
                      </HStack>
                    ) : null}
                  </VStack>
                );
              })}
            </VStack>
          </Card>
          {kinds.map(([kind, label]) => {
            const items = (meta.data?.sources ?? []).filter(s => s.kind === kind && !challengeUrls.has(s.url));
            if (items.length === 0) return null;
            return (
              <Card key={kind}>
                <VStack gap={3}>
                  <Heading level={2}>{label}</Heading>
                  {items.map(s => {
                    const href = safeSourceUrl(s.url);
                    return (
                      <VStack key={s.url} gap={0}>
                        {href ? <Link href={href}>{s.title}</Link> : <Text>{s.title}</Text>}
                      </VStack>
                    );
                  })}
                </VStack>
              </Card>
            );
          })}
          {meta.data && (
            <Card>
              <VStack gap={2}>
                <Heading level={2}>{t.kindAi}</Heading>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  {radiumUrl ? <Link href={radiumUrl}>Radium API</Link> : <Text>Radium API</Text>}
                  <Text>{t.model}: {meta.data.model}</Text>
                </HStack>
              </VStack>
            </Card>
          )}
          <Text type="supporting" color="secondary">{t.disclaimer}</Text>
        </VStack>
      </div>
    </div>
  );
}

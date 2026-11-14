'use client';

import {Card} from '@astryxdesign/core/Card';
import {Link} from '@astryxdesign/core/Link';
import {Heading, Text} from '@astryxdesign/core/Text';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {VStack} from '@astryxdesign/core/Layout';
import {useSettings} from '@/app/providers';
import {useApi} from '@/lib/useApi';
import {PageHeader} from '@/components/PageHeader';

interface Meta {
  sources: {kind: string; title: string; url: string; publisher: string | null; license_note: string | null; used_for: string | null}[];
  model: string;
}

export default function SourcesPage() {
  const {t} = useSettings();
  const meta = useApi<Meta>('/api/meta');
  const kinds: [string, string][] = [
    ['data', t.kindData], ['reference', t.kindReference], ['image', t.kindImage],
  ];
  const radiumUrl = meta.data?.sources.find(source => source.kind === 'ai')?.url;

  return (
    <div className="igris-page">
      <div className="igris-content">
        <VStack gap={5}>
          <PageHeader title={t.sourcesTitle} />
          <Card>
            <VStack gap={2}>
              <Heading level={2}>{t.aiUseTitle}</Heading>
              {t.aiUse.map(line => (
                <Text key={line}>• {line}</Text>
              ))}
            </VStack>
          </Card>
          {meta.error && <EmptyState title={meta.error === 'not_configured' ? t.errNoDb : t.errData} />}
          {kinds.map(([kind, label]) => {
            const items = (meta.data?.sources ?? []).filter(s => s.kind === kind);
            if (items.length === 0) return null;
            return (
              <Card key={kind}>
                <VStack gap={3}>
                  <Heading level={2}>{label}</Heading>
                  {items.map(s => (
                    <VStack key={s.url} gap={0}>
                      <Link href={s.url}>{s.title}</Link>
                      <Text type="supporting" color="secondary">
                        {[s.publisher, s.used_for, s.license_note].filter(Boolean).join(' · ')}
                      </Text>
                    </VStack>
                  ))}
                </VStack>
              </Card>
            );
          })}
          {meta.data && (
            <Card>
              <VStack gap={2}>
                <Heading level={2}>{t.kindAi}</Heading>
                {radiumUrl ? <Link href={radiumUrl}>Radium API</Link> : <Text>Radium API</Text>}
                <Text color="secondary">{t.model}: {meta.data.model}</Text>
              </VStack>
            </Card>
          )}
          <Text type="supporting" color="secondary">{t.disclaimer}</Text>
        </VStack>
      </div>
    </div>
  );
}

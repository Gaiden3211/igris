'use client';

import {use} from 'react';
import {Card} from '@astryxdesign/core/Card';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {Link} from '@astryxdesign/core/Link';
import {Heading, Text} from '@astryxdesign/core/Text';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Spinner} from '@astryxdesign/core/Spinner';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {useSettings} from '@/app/providers';
import {useApi} from '@/lib/useApi';

interface Detail {
  investigation: {
    id: string; acronym: string | null; title: string; doi: string | null; sub_research_area: string | null; project_type: string | null;
    start_date: string | null; end_date: string | null; description: string | null; objective: string | null; hypothesis: string | null;
    approach: string | null; impacts: string | null; hardware: string[]; platform: string | null; file_count: number; table_count: number;
    total_bytes: number | null; publication_count: number; source_url: string;
  } | null;
  parameters: {parameter_id: string; value_num: number | null; value_min: number | null; value_max: number | null; value_text: string | null; unit: string | null; origin: string; source_url: string | null}[];
  publications: {id: number; title: string; authors: string | null; year: number | null; doi: string | null; url: string | null}[];
  files: {file_name: string; bytes: number | null; kind: string}[];
  related: {id: string; acronym: string | null; title: string}[];
}
interface Meta {
  parameters: {id: string; label_en: string; label_uk: string}[];
}

const size = (b: number | null) => {
  if (b == null) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = b;
  let i = 0;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
};

function Block({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <Card>
      <VStack gap={3}>
        <Heading level={2}>{title}</Heading>
        {children}
      </VStack>
    </Card>
  );
}

export default function InvestigationPage({params}: {params: Promise<{id: string}>}) {
  const {id} = use(params);
  const {t, lang} = useSettings();
  const res = useApi<Detail>(`/api/investigations/${encodeURIComponent(id)}`);
  const meta = useApi<Meta>('/api/meta');
  const inv = res.data?.investigation;

  if (res.loading) return <div className="igris-content"><HStack hAlign="center"><Spinner /></HStack></div>;
  if (!inv)
    return (
      <div className="igris-content">
        <EmptyState
          title={res.error === 'not_configured' ? t.errNoDb : res.error ? t.errData : t.notFound}
          actions={<Button label={t.back} href="/catalog" />}
        />
      </div>
    );

  const d = res.data!;
  const paramLabel = (pid: string) => {
    const def = meta.data?.parameters.find(p => p.id === pid);
    return def ? (lang === 'uk' ? def.label_uk : def.label_en) : pid;
  };
  const paramValue = (p: Detail['parameters'][number]) =>
    p.value_text ?? (p.value_min != null || p.value_max != null ? `${p.value_min ?? '?'} – ${p.value_max ?? '?'}` : String(p.value_num ?? '—'));
  const texts: [string, string | null][] = [
    [t.objective, inv.objective], [t.hypothesis, inv.hypothesis], [t.approach, inv.approach], [t.impacts, inv.impacts], [t.description, inv.description],
  ];
  const facts: [string, string][] = [
    [t.type, inv.project_type ?? '—'],
    [t.dates, [inv.start_date, inv.end_date].filter(Boolean).join(' → ') || '—'],
    [t.hardware, inv.hardware.join(', ') || '—'],
    [t.platform, inv.platform ?? '—'],
    [t.totalSize, size(inv.total_bytes)],
  ];
  const question = lang === 'uk' ? `Розкажи про дослідження ${inv.id} (${inv.acronym ?? inv.title})` : `Summarize investigation ${inv.id} (${inv.acronym ?? inv.title})`;

  return (
    <div className="igris-page">
      <div className="igris-content">
        <VStack gap={5}>
          <VStack gap={2}>
            <Link href="/catalog">← {t.back}</Link>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Badge label={inv.id} />
              {inv.sub_research_area && <Badge label={inv.sub_research_area} variant="info" />}
            </HStack>
            <Heading level={1}>{inv.acronym ?? inv.title}</Heading>
            {inv.acronym && <Text color="secondary">{inv.title}</Text>}
            <HStack gap={2} wrap="wrap">
              <Button label={t.askAbout} variant="primary" href={`/?q=${encodeURIComponent(question)}`} />
              <Button label={t.viewSource} href={inv.source_url} />
              {inv.doi && <Button label={`${t.doi}: ${inv.doi}`} variant="ghost" href={`https://doi.org/${inv.doi}`} />}
            </HStack>
          </VStack>

          <Block title={t.overview}>
            <div className="igris-grid-4">
              {facts.map(([k, v]) => (
                <VStack key={k} gap={0}>
                  <Text type="supporting" color="secondary">{k}</Text>
                  <Text>{v}</Text>
                </VStack>
              ))}
            </div>
            {texts.filter(([, v]) => v).map(([k, v]) => (
              <VStack key={k} gap={1}>
                <Text type="label" weight="semibold">{k}</Text>
                <Text className="igris-prose">{v}</Text>
              </VStack>
            ))}
          </Block>

          <Block title={t.conditions}>
            {d.parameters.length === 0 ? (
              <Text color="secondary">{t.noConditions}</Text>
            ) : (
              <div className="igris-grid-4">
                {d.parameters.map((p, i) => (
                  <VStack key={i} gap={0}>
                    <Text type="supporting" color="secondary">{paramLabel(p.parameter_id)}</Text>
                    <Text>{paramValue(p)}{p.unit ? ` ${p.unit}` : ''}</Text>
                    {p.origin === 'ai_extracted' && <Text type="supporting" color="secondary">{t.aiExtracted}</Text>}
                  </VStack>
                ))}
              </div>
            )}
          </Block>

          <Block title={`${t.files} (${(inv.file_count + inv.table_count).toLocaleString()})`}>
            <VStack gap={1}>
              {d.files.map(f => (
                <HStack key={f.kind + f.file_name} hAlign="between" gap={3}>
                  <Text className="igris-prose">{f.file_name}</Text>
                  <Text color="secondary">{size(f.bytes)}</Text>
                </HStack>
              ))}
              {inv.file_count + inv.table_count > d.files.length && (
                <Text color="secondary">{t.andMore(inv.file_count + inv.table_count - d.files.length)}</Text>
              )}
              <Link href={inv.source_url}>{t.viewSource}</Link>
            </VStack>
          </Block>

          <Block title={`${t.publications} (${d.publications.length})`}>
            <VStack gap={2}>
              {d.publications.map(p => {
                const href = p.url ?? (p.doi ? `https://doi.org/${p.doi}` : null);
                return (
                  <VStack key={p.id} gap={0}>
                    {href ? <Link href={href}>{p.title}</Link> : <Text>{p.title}</Text>}
                    <Text type="supporting" color="secondary">{[p.authors, p.year].filter(Boolean).join(' · ')}</Text>
                  </VStack>
                );
              })}
            </VStack>
          </Block>

          {d.related.length > 0 && (
            <Block title={t.related}>
              <VStack gap={1}>
                {d.related.map(r => (
                  <Link key={r.id} href={`/investigations/${r.id}`}>{r.id} · {r.acronym ?? r.title}</Link>
                ))}
              </VStack>
            </Block>
          )}
        </VStack>
      </div>
    </div>
  );
}

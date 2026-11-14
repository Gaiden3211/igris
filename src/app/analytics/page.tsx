'use client';

import {Chart, ChartAxis, ChartGrid, bar, dot} from '@astryxdesign/charts';
import {Card} from '@astryxdesign/core/Card';
import {Heading, Text} from '@astryxdesign/core/Text';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Spinner} from '@astryxdesign/core/Spinner';
import {Link} from '@astryxdesign/core/Link';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {useSettings} from '@/app/providers';
import {useApi} from '@/lib/useApi';
import {PageHeader} from '@/components/PageHeader';

type Tally = {label: string; count: number};
interface Analytics {
  total: number; withFiles: number; withTables: number; publications: number;
  byYear: Tally[]; bySub: Tally[]; byHardware: Tally[];
  conditions: {id: string; label: string; oxygen: number; pressure: number}[];
}
interface Meta {
  scenarios: {id: string; name_en: string; name_uk: string; description_en: string | null; description_uk: string | null}[];
}

function BarCard({title, data, countLabel, linkParam}: {title: string; data: Tally[]; countLabel: string; linkParam?: string}) {
  return (
    <Card>
      <VStack gap={3}>
        <Chart
          title={title}
          data={data}
          xKey="label"
          series={[bar('count', {label: countLabel})]}
          height={280}
          yBaseline="zero"
          grid={<ChartGrid horizontal />}
          axes={
            <>
              <ChartAxis position="bottom" truncate={14} maxTicks={12} />
              <ChartAxis position="left" />
            </>
          }
          tooltip
        />
        {linkParam && (
          <HStack gap={3} wrap="wrap">
            {data.slice(0, 8).map(d => (
              <Link key={d.label} href={`/catalog?${linkParam}=${encodeURIComponent(d.label)}`}>
                {d.label} ({d.count})
              </Link>
            ))}
          </HStack>
        )}
      </VStack>
    </Card>
  );
}

export default function AnalyticsPage() {
  const {t, lang, domain} = useSettings();
  const res = useApi<Analytics>(`/api/analytics${domain ? `?domain=${domain}` : ''}`);
  const meta = useApi<Meta>('/api/meta');
  const a = res.data;

  return (
    <div className="igris-page">
      <div className="igris-content">
        <VStack gap={5}>
          <PageHeader title={t.analyticsTitle} subtitle={t.analyticsSubtitle} />
          {res.loading && !a ? (
            <HStack hAlign="center"><Spinner /></HStack>
          ) : res.error || !a ? (
            <EmptyState title={res.error === 'not_configured' ? t.errNoDb : t.errData} />
          ) : a.total === 0 ? (
            <EmptyState title={t.emptyDbTitle} description={t.emptyDbBody} />
          ) : (
            <>
              <div className="igris-grid-4">
                {[
                  [t.kpiInvestigations, a.total],
                  [t.kpiWithFiles, a.withFiles],
                  [t.kpiWithTables, a.withTables],
                  [t.kpiPublications, a.publications],
                ].map(([label, value]) => (
                  <Card key={label as string}>
                    <VStack gap={1}>
                      <Text type="supporting" color="secondary">{label}</Text>
                      <Heading level={2}>{(value as number).toLocaleString()}</Heading>
                    </VStack>
                  </Card>
                ))}
              </div>
              <BarCard title={t.chartByYear} data={a.byYear} countLabel={t.count} />
              <BarCard title={t.chartBySub} data={a.bySub} countLabel={t.count} linkParam="sub" />
              {a.byHardware.length > 0 && <BarCard title={t.chartByHardware} data={a.byHardware} countLabel={t.count} linkParam="hardware" />}
              <Card>
                <VStack gap={3}>
                  {a.conditions.length === 0 ? (
                    <>
                      <Heading level={2}>{t.chartConditions}</Heading>
                      <Text color="secondary">{t.chartConditionsEmpty}</Text>
                    </>
                  ) : (
                    <Chart
                      title={t.chartConditions}
                      subtitle="x: O₂ (% vol), y: kPa"
                      data={a.conditions}
                      xKey="oxygen"
                      series={[dot('pressure', {label: 'kPa'})]}
                      height={320}
                      xDomain={[0, 100]}
                      grid={<ChartGrid horizontal />}
                      axes={
                        <>
                          <ChartAxis position="bottom" />
                          <ChartAxis position="left" />
                        </>
                      }
                      tooltip
                    />
                  )}
                  <Text type="label" weight="semibold">{t.scenarios}</Text>
                  <VStack gap={1}>
                    {(meta.data?.scenarios ?? []).map(s => (
                      <Text key={s.id} color="secondary">
                        {lang === 'uk' ? s.name_uk : s.name_en}: {lang === 'uk' ? s.description_uk : s.description_en}
                      </Text>
                    ))}
                  </VStack>
                </VStack>
              </Card>
            </>
          )}
        </VStack>
      </div>
    </div>
  );
}

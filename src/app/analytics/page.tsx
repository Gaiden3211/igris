'use client';

import {Chart, ChartAxis, ChartGrid, bar, dot} from '@astryxdesign/charts';
import {ChevronDownIcon} from '@heroicons/react/24/outline';
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

function Categories({title, data, filter}: {title: string; data: Tally[]; filter: 'sub' | 'hardware'}) {
  const max = Math.max(1, ...data.map(item => item.count));
  return (
    <Card>
      <VStack gap={3}>
        <Heading level={2}>{title}</Heading>
        <ul className="igris-chart-categories">
          {data.map(({label, count}) => (
            <li key={label}>
              <Link href={`/catalog?${filter}=${encodeURIComponent(label)}`}>{label}</Link>
              <span className="igris-chart-bar" aria-hidden="true">
                <span style={{width: `${count / max * 100}%`}} />
              </span>
              <span className="igris-chart-count">{count.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </VStack>
    </Card>
  );
}

export default function AnalyticsPage() {
  const {t, lang} = useSettings();
  const res = useApi<Analytics>('/api/analytics');
  const meta = useApi<Meta>('/api/meta');
  const a = res.data;
  const scenarios = meta.data?.scenarios ?? [];

  return (
    <div className="igris-page">
      <div className="igris-content">
        <VStack gap={5}>
          <PageHeader title={t.analyticsTitle} />
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
              {a.byYear.length > 0 && (
                <Card>
                  <Chart
                    title={t.chartByYear}
                    data={a.byYear}
                    xKey="label"
                    series={[bar('count', {label: t.count, color: 'var(--igris-chart-fill)'})]}
                    height={240}
                    yDomain={[0, Math.max(1, ...a.byYear.map(item => item.count))]}
                    grid={<ChartGrid horizontal />}
                    axes={<><ChartAxis position="bottom" maxTicks={5} /><ChartAxis position="left" /></>}
                    tooltip
                  />
                </Card>
              )}
              {a.bySub.length > 0 && <Categories title={t.chartBySub} data={a.bySub} filter="sub" />}
              {a.byHardware.length > 0 && <Categories title={t.chartByHardware} data={a.byHardware} filter="hardware" />}
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
                  {scenarios.length > 0 && (
                    <details className="igris-scenarios">
                      <summary>
                        <span>{t.scenarios}</span><ChevronDownIcon aria-hidden="true" />
                      </summary>
                      <dl>
                        {scenarios.map(s => (
                          <div key={s.id}>
                            <dt>{lang === 'uk' ? s.name_uk : s.name_en}</dt>
                            <dd>{lang === 'uk' ? s.description_uk : s.description_en}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  )}
                </VStack>
              </Card>
            </>
          )}
        </VStack>
      </div>
    </div>
  );
}

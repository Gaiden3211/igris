'use client';

import {useEffect, useMemo, useState} from 'react';
import {Table, pixel, proportional, useTableSelection, useTableSelectionState, type TableColumn} from '@astryxdesign/core/Table';
import {Token} from '@astryxdesign/core/Token';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Selector} from '@astryxdesign/core/Selector';
import {Button} from '@astryxdesign/core/Button';
import {Link} from '@astryxdesign/core/Link';
import {Text} from '@astryxdesign/core/Text';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Spinner} from '@astryxdesign/core/Spinner';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {MagnifyingGlassIcon} from '@heroicons/react/24/outline';
import {useSettings} from '@/app/providers';
import {useApi} from '@/lib/useApi';
import {PageHeader} from '@/components/PageHeader';
import type {InvestigationRow} from '@/lib/catalog';
import {COMPARE_MAX, compareHref} from '@/lib/compare';

const SELECTION_KEY = 'igris-compare';

/** Ids ticked for comparison. Kept for the browser session so going to Compare and back keeps the selection. */
function useCompareSelection() {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SELECTION_KEY) ?? '[]');
      if (Array.isArray(saved)) setSelected(new Set(saved.filter((x): x is string => typeof x === 'string').slice(0, COMPARE_MAX)));
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    // Do not overwrite the saved selection with the empty initial state before it has been read.
    if (!loaded) return;
    try {
      sessionStorage.setItem(SELECTION_KEY, JSON.stringify([...selected]));
    } catch {}
  }, [selected, loaded]);
  return [selected, setSelected] as const;
}

interface Facet {
  value: string;
  count: number;
}
interface CatalogResponse {
  total: number;
  rows: InvestigationRow[];
  facets: {sub: Facet[]; hardware: Facet[]; data: Facet[]};
  sort: string;
}

const years = (r: InvestigationRow) => {
  const a = r.start_date?.slice(0, 4);
  const b = r.end_date?.slice(0, 4);
  return a && b && a !== b ? `${a}–${b}` : (a ?? b ?? '—');
};

export default function CatalogPage() {
  const {t} = useSettings();
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [sub, setSub] = useState('');
  const [hardware, setHardware] = useState('');
  const [data, setData] = useState('');
  const [sort, setSort] = useState('');

  // Deep links from Analytics and the assistant: /catalog?q=...&sub=...
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setInput(p.get('q') ?? '');
    setQ(p.get('q') ?? '');
    setSub(p.get('sub') ?? '');
    setHardware(p.get('hardware') ?? '');
    setData(p.get('data') ?? '');
  }, []);

  const url = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries({q, sub, hardware, data, sort}).forEach(([k, v]) => v && p.set(k, v));
    return `/api/investigations?${p}`;
  }, [q, sub, hardware, data, sort]);
  const res = useApi<CatalogResponse>(url);

  // Selection for comparison: at most COMPARE_MAX rows; "select all" fills up to the cap in the current order.
  const rows = useMemo(() => res.data?.rows ?? [], [res.data]);
  const [selected, setSelected] = useCompareSelection();
  const [labels, setLabels] = useState<Record<string, string>>({});
  useEffect(() => {
    if (rows.length) setLabels(l => ({...l, ...Object.fromEntries(rows.map(r => [r.id, r.acronym ?? r.id]))}));
  }, [rows]);
  const {selectionConfig} = useTableSelectionState<InvestigationRow>({
    data: rows,
    idKey: 'id',
    selectedKeys: selected,
    setSelectedKeys: setSelected,
    getIsItemEnabled: r => selected.has(r.id) || selected.size < COMPARE_MAX,
  });
  const selectionPlugin = useTableSelection<InvestigationRow>({
    ...selectionConfig,
    getRowLabel: r => r.acronym ?? r.title,
    onSelectAll: ({isAllSelected}) =>
      isAllSelected
        ? setSelected(prev => {
            const next = new Set(prev);
            for (const r of rows) if (next.size < COMPARE_MAX) next.add(r.id);
            return next;
          })
        : setSelected(new Set()),
  });
  const unselect = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const facetOptions = (items: Facet[] | undefined, label?: (v: string) => string) => [
    {value: 'any', label: t.any},
    ...(items ?? []).map(f => ({value: f.value, label: `${label ? label(f.value) : f.value} (${f.count})`})),
  ];
  const dataLabel = (v: string) => (v === 'files' ? t.dataFiles : v === 'tables' ? t.dataTables : t.dataNone);
  const pick = (setter: (v: string) => void) => (v: string | null) => setter(!v || v === 'any' ? '' : v);
  const hasFilters = Boolean(q || sub || hardware || data);

  const columns: TableColumn<InvestigationRow>[] = [
    {key: 'id', header: t.colId, width: pixel(90)},
    {
      key: 'title',
      header: t.colName,
      width: proportional(3, {minWidth: 260}),
      renderCell: r => (
        <VStack gap={0}>
          <Link href={`/investigations/${r.id}`}>{r.acronym ?? r.title}</Link>
          {r.acronym && <Text type="supporting" color="secondary">{r.title}</Text>}
        </VStack>
      ),
    },
    {key: 'sub_research_area', header: t.colTopic, width: proportional(2, {minWidth: 160}), renderCell: r => r.sub_research_area ?? '—'},
    {key: 'start_date', header: t.colYears, width: pixel(110), renderCell: r => years(r)},
    {key: 'file_count', header: t.colFiles, width: pixel(90), align: 'end', renderCell: r => r.file_count.toLocaleString()},
    {key: 'publication_count', header: t.colPubs, width: pixel(90), align: 'end'},
  ];

  return (
    <div className="igris-page">
      <div className="igris-content">
        <VStack gap={5}>
          <PageHeader title={t.catalogTitle} />

          <HStack gap={2} vAlign="end">
            <div style={{flex: 1, minWidth: 0}}>
              <TextInput
                type="search"
                label={t.search}
                isLabelHidden
                placeholder={t.searchPlaceholder}
                startIcon={MagnifyingGlassIcon}
                value={input}
                onChange={setInput}
                onEnter={() => setQ(input.trim())}
              />
            </div>
            <Button label={t.search} variant="primary" onClick={() => setQ(input.trim())} />
          </HStack>

          <div className="igris-filters">
            <Selector label={t.filterSub} options={facetOptions(res.data?.facets.sub)} value={sub || 'any'} onChange={pick(setSub)} />
            <Selector label={t.filterHardware} options={facetOptions(res.data?.facets.hardware)} value={hardware || 'any'} onChange={pick(setHardware)} />
            <Selector label={t.filterData} options={facetOptions(res.data?.facets.data, dataLabel)} value={data || 'any'} onChange={pick(setData)} />
            <Selector
              label={t.sort}
              options={[
                ...(q ? [{value: 'relevance', label: t.sortRelevance}] : []),
                {value: 'newest', label: t.sortNewest},
                {value: 'oldest', label: t.sortOldest},
                {value: 'files', label: t.sortFiles},
                {value: 'publications', label: t.sortPublications},
              ]}
              value={sort || res.data?.sort || 'newest'}
              onChange={v => setSort(v ?? '')}
            />
          </div>

          {hasFilters && (
            <HStack hAlign="end">
              <Button
                label={t.clearFilters}
                variant="ghost"
                size="sm"
                onClick={() => {
                  setInput('');
                  setQ('');
                  setSub('');
                  setHardware('');
                  setData('');
                }}
              />
            </HStack>
          )}

          {res.loading && !res.data ? (
            <HStack hAlign="center"><Spinner /></HStack>
          ) : res.error ? (
            <EmptyState title={res.error === 'not_configured' ? t.errNoDb : t.errData} />
          ) : res.data && res.data.total === 0 ? (
            hasFilters ? (
              <EmptyState title={t.emptyCatalogTitle} description={t.emptyCatalogBody} />
            ) : (
              <EmptyState title={t.emptyDbTitle} description={t.emptyDbBody} />
            )
          ) : (
            <div className="igris-scroll-x" role="region" aria-label={t.catalogTitle} tabIndex={0}>
              <Table<InvestigationRow>
                data={rows}
                columns={columns}
                idKey="id"
                density="balanced"
                hasHover
                verticalAlign="top"
                plugins={{selection: selectionPlugin}}
              />
            </div>
          )}

          {selected.size > 0 && (
            <div className="igris-compare-bar" role="region" aria-label={t.compare}>
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Text weight="semibold">{t.compareSelected(selected.size, COMPARE_MAX)}</Text>
                {[...selected].map(id => (
                  <Token key={id} label={labels[id] ?? id} size="sm" onRemove={() => unselect(id)} />
                ))}
              </HStack>
              <HStack className="igris-compare-actions" gap={2} vAlign="center" wrap="wrap">
                <Button label={t.clearSelection} variant="ghost" size="sm" onClick={() => setSelected(new Set())} />
                <Button
                  label={t.compare}
                  variant="primary"
                  size="sm"
                  isDisabled={selected.size < 2}
                  href={selected.size >= 2 ? compareHref(selected) : undefined}
                />
              </HStack>
            </div>
          )}
        </VStack>
      </div>
    </div>
  );
}

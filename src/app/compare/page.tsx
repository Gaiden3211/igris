'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Card} from '@astryxdesign/core/Card';
import {Button} from '@astryxdesign/core/Button';
import {Link} from '@astryxdesign/core/Link';
import {Heading, Text} from '@astryxdesign/core/Text';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Spinner} from '@astryxdesign/core/Spinner';
import {Markdown} from '@astryxdesign/core/Markdown';
import {ChatComposer, ChatToolCalls} from '@astryxdesign/core/Chat';
import {Table, pixel, proportional, type TableColumn} from '@astryxdesign/core/Table';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {DEFAULT_DAILY_LIMIT} from '@/lib/quota';
import {useSettings} from '@/app/providers';
import {BackArrow} from '@/components/BackArrow';
import {PageHeader} from '@/components/PageHeader';
import {SourceCards} from '@/components/SourceCards';
import {ChatTurns} from '@/components/ChatTurns';
import {limitText, useChat, type HistoryItem} from '@/lib/useChat';
import {linkCitations, readNdjson, type SourceCardData} from '@/lib/citations';
import {COMPARE_MAX} from '@/lib/compare';
import {useApi} from '@/lib/useApi';
import {saveChatSeed} from '@/lib/chatSeed';
import {useRouter} from 'next/navigation';

interface Detail {
  investigation: {
    id: string; acronym: string | null; title: string; sub_research_area: string | null; project_type: string | null;
    start_date: string | null; end_date: string | null; hardware: string[]; platform: string | null;
    file_count: number; table_count: number; publication_count: number; source_url: string;
  } | null;
  parameters: {parameter_id: string; value_num: number | null; value_min: number | null; value_max: number | null; value_text: string | null; unit: string | null; origin: string}[];
  publications: unknown[];
}
type Inv = NonNullable<Detail['investigation']> & {params: Detail['parameters']; pubs: number};
interface Step {
  id: 'search' | 'answer';
  status: 'running' | 'complete';
  detail?: string;
}
type FactRow = {key: string; label: string} & Record<string, unknown>;

const years = (i: Inv) => {
  const a = i.start_date?.slice(0, 4);
  const b = i.end_date?.slice(0, 4);
  return a && b && a !== b ? `${a}–${b}` : (a ?? b ?? '—');
};
const paramText = (p: Detail['parameters'][number]) =>
  (p.value_text ?? (p.value_min != null || p.value_max != null ? `${p.value_min ?? '?'}–${p.value_max ?? '?'}` : String(p.value_num ?? '—'))) +
  (p.unit ? ` ${p.unit}` : '');

export default function ComparePage() {
  const {t, lang} = useSettings();
  const [ids, setIds] = useState<string[] | null>(null);
  const [invs, setInvs] = useState<Inv[] | null>(null);
  const [factsError, setFactsError] = useState(false);

  const [steps, setSteps] = useState<Step[]>([]);
  const [cards, setCards] = useState<SourceCardData[]>([]);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<{left: number; perDay: number} | null>(null);
  const started = useRef(false);
  const meta = useApi<{parameters: {id: string; label_en: string; label_uk: string}[]}>('/api/meta');

  // /compare?ids=PSI-25,PSI-98
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('ids') ?? '';
    setIds([...new Set(raw.split(',').map(s => s.trim().toUpperCase()).filter(s => /^PSI-\d+$/.test(s)))].slice(0, COMPARE_MAX));
  }, []);

  // Key facts come straight from the database, no AI involved.
  useEffect(() => {
    if (!ids || ids.length < 2) return;
    Promise.all(ids.map(id => fetch(`/api/investigations/${encodeURIComponent(id)}`).then(r => (r.ok ? (r.json() as Promise<Detail>) : null))))
      .then(list => {
        const found = list.flatMap(d => (d?.investigation ? [{...d.investigation, params: d.parameters, pubs: d.publications.length}] : []));
        setInvs(found);
        if (found.length === 0) setFactsError(true);
      })
      .catch(() => setFactsError(true));
  }, [ids]);

  const run = useCallback(async () => {
    if (!ids || ids.length < 2) return;
    setBusy(true);
    setError(null);
    setSteps([]);
    setCards([]);
    setAnswer('');
    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({ids, lang}),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 429 && body.code !== 'minute') setQuota({left: 0, perDay: body.perDay ?? DEFAULT_DAILY_LIMIT});
        setError(res.status === 429 ? limitText(t, body.code) : res.status === 503 ? t.errNotConfigured : t.errModel);
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await readNdjson(res.body, (ev: any) => {
        if (ev.type === 'delta') setAnswer(a => a + ev.text);
        else if (ev.type === 'step') setSteps(s => [...s.filter(x => x.id !== ev.id), {id: ev.id, status: ev.status, detail: ev.detail}]);
        else if (ev.type === 'sources') setCards(ev.cards);
        else if (ev.type === 'done') setQuota({left: ev.remainingToday, perDay: ev.perDay});
        else if (ev.type === 'error') setError(t.errModel);
      });
    } catch {
      setError(t.errModel);
    } finally {
      setBusy(false);
    }
  }, [ids, lang, t]);

  // Follow-up questions under the comparison. The comparison itself is the start of the conversation (prefix),
  // and the compared ids are always retrieved (focus), so "which one is newer?" knows what "one" means.
  const names = useMemo(() => (ids ?? []).map(id => invs?.find(i => i.id === id)?.acronym ?? id), [ids, invs]);
  const seedQuestion = t.compareSeedQuestion(names.join(', '));
  const prefix = useMemo<HistoryItem[]>(
    () => (answer && !busy ? [{role: 'user', content: seedQuestion}, {role: 'assistant', content: answer}] : []),
    [answer, busy, seedQuestion],
  );
  const followUp = useChat({focus: ids, prefix});

  // Continue in the assistant with the comparison and every follow-up so far.
  const router = useRouter();
  const openChat = () => {
    if (!ids) return;
    saveChatSeed({
      focus: {ids, names},
      messages: [
        {role: 'user', content: seedQuestion, cards: []},
        {role: 'assistant', content: answer, cards},
        ...followUp.messages.filter(m => m.content && !m.error).map(m => ({role: m.role, content: m.content, cards: m.cards})),
      ],
    });
    router.push('/?from=compare');
  };

  // Start the AI comparison once when the page opens.
  useEffect(() => {
    if (ids && ids.length >= 2 && !started.current) {
      started.current = true;
      void run();
    }
  }, [ids, run]);

  if (ids === null) return null;
  if (ids.length < 2)
    return (
      <div className="igris-page">
        <div className="igris-content">
          <EmptyState title={t.compareTitle} description={t.compareNeedTwo} actions={<BackArrow href="/catalog" label={t.back} />} />
        </div>
      </div>
    );

  const list = invs ?? [];
  const cell = (fn: (i: Inv) => React.ReactNode) => Object.fromEntries(list.map(i => [i.id, fn(i)]));
  const paramIds = [...new Set(list.flatMap(i => i.params.map(p => p.parameter_id)))];
  const facts: FactRow[] = [
    {key: 'title', label: t.colName, ...cell(i => <Link href={`/investigations/${i.id}`}>{i.title}</Link>)},
    {key: 'topic', label: t.colTopic, ...cell(i => i.sub_research_area ?? '—')},
    {key: 'type', label: t.type, ...cell(i => i.project_type ?? '—')},
    {key: 'years', label: t.colYears, ...cell(years)},
    {key: 'hardware', label: t.hardware, ...cell(i => i.hardware.join(', ') || '—')},
    {key: 'platform', label: t.platform, ...cell(i => i.platform ?? '—')},
    {key: 'files', label: t.colFiles, ...cell(i => i.file_count.toLocaleString())},
    {key: 'tables', label: t.dataTables, ...cell(i => (i.table_count > 0 ? `${t.yes} (${i.table_count})` : t.no))},
    {key: 'pubs', label: t.colPubs, ...cell(i => i.pubs.toLocaleString())},
    ...paramIds.map(pid => ({
      key: `p-${pid}`,
      label: (() => {
        const def = meta.data?.parameters.find(p => p.id === pid);
        return def ? (lang === 'uk' ? def.label_uk : def.label_en) : pid;
      })(),
      ...cell(i => {
        const p = i.params.filter(x => x.parameter_id === pid);
        if (p.length === 0) return '—';
        return p.map(paramText).join('; ') + (p.some(x => x.origin === 'ai_extracted') ? ` (${t.aiExtracted})` : '');
      }),
    })),
    {key: 'source', label: t.viewSource, ...cell(i => <Link href={i.source_url}>PSI ↗</Link>)},
  ];
  const columns: TableColumn<FactRow>[] = [
    {key: 'label', header: t.compareAttribute, width: pixel(150), renderCell: r => <Text weight="semibold">{r.label}</Text>},
    ...list.map(i => ({
      key: i.id,
      header: i.acronym ?? i.id,
      width: proportional(1, {minWidth: 180}),
      renderCell: (r: FactRow) => r[i.id] as React.ReactNode,
    })),
  ];

  return (
    <div className="igris-page">
      <div className="igris-content">
        <VStack gap={5}>
          <HStack gap={2} vAlign="center">
            <BackArrow href="/catalog" label={t.back} />
            <PageHeader title={t.compareTitle} />
          </HStack>

          <Card>
            <VStack gap={3}>
              <Heading level={2}>{t.compareFacts}</Heading>
              {factsError ? (
                <Text color="secondary">{t.errData}</Text>
              ) : !invs ? (
                <HStack hAlign="center"><Spinner /></HStack>
              ) : (
                <div className="igris-table">
                  <Table<FactRow> aria-label={t.compareFacts} data={facts} columns={columns} idKey="key" density="balanced" verticalAlign="top" />
                </div>
              )}
            </VStack>
          </Card>

          <Card>
            <VStack gap={3}>
              <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
                <Heading level={2}>{t.compareAi}</Heading>
                {(followUp.quota ?? quota) && (
                  <Text type="supporting" color="secondary">
                    {t.remaining((followUp.quota ?? quota)!.left, (followUp.quota ?? quota)!.perDay)}
                  </Text>
                )}
              </HStack>
              {steps.length > 0 && (
                <ChatToolCalls
                  label={t.stepsLabel}
                  calls={steps.map(s => ({
                    name: s.id === 'search' ? t.compareStepLoad : t.compareStepWrite,
                    target: s.detail ?? '',
                    status: s.status,
                  }))}
                />
              )}
              {busy && !answer && <HStack hAlign="center"><Spinner /></HStack>}
              {answer && <Markdown density="compact">{linkCitations(answer, cards)}</Markdown>}
              {error && (
                <HStack gap={3} vAlign="center" wrap="wrap">
                  <Text color="secondary">{error}</Text>
                  <Button label={t.compareRetry} size="sm" onClick={() => void run()} isDisabled={busy} />
                </HStack>
              )}
              {cards.length > 0 && !busy && <SourceCards cards={cards} title={t.sources} />}
            </VStack>
          </Card>

          {answer && !busy && !error && (
            <Card>
              <VStack gap={3}>
                <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
                  <Heading level={2}>{t.compareAskTitle}</Heading>
                  <Button label={t.compareToChat} variant="ghost" size="sm" isDisabled={followUp.busy} onClick={openChat} />
                </HStack>
                {followUp.messages.length > 0 && (
                  <VStack gap={3}>
                    <ChatTurns messages={followUp.messages} busy={followUp.busy} />
                  </VStack>
                )}
                <ChatComposer
                  onSubmit={followUp.send}
                  onStop={followUp.stop}
                  isStopShown={followUp.busy}
                  placeholder={t.compareAskPlaceholder}
                  status={followUp.notice ? {type: 'warning', message: followUp.notice} : undefined}
                />
              </VStack>
            </Card>
          )}
        </VStack>
      </div>
    </div>
  );
}

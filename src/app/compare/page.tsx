'use client';

import {AssistantRuntimeProvider, type AssistantRuntime} from '@assistant-ui/react';

import {useCallback, useEffect, Suspense, useMemo, useRef, useState} from 'react';
import {Card} from '@astryxdesign/core/Card';
import {Button} from '@astryxdesign/core/Button';
import {Link} from '@astryxdesign/core/Link';
import {Heading, Text} from '@astryxdesign/core/Text';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Spinner} from '@astryxdesign/core/Spinner';
import {Markdown} from '@astryxdesign/core/Markdown';
import {ChatComposer} from '@astryxdesign/core/Chat';
import {Table, pixel, proportional, type TableColumn} from '@astryxdesign/core/Table';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {useSettings} from '@/app/providers';
import {ConversationSlot} from '@/components/ConversationSessions';
import {useConversationActivity} from '@/lib/conversationActivity';
import {PageHeader} from '@/components/PageHeader';
import {SourceCards} from '@/components/SourceCards';
import {exportRepository} from '@/lib/chatRepository';
import {ChatTurns} from '@/components/ChatTurns';
import {MessageActions} from '@/components/MessageActions';
import {useChat, useChatRuntime} from '@/lib/useChat';
import {assistantMsg, chatEventSchema, limitText, latestResponseText, type ChatMsg, type ChatStep, type HistoryItem} from '@/lib/chatAdapter';
import {linkCitations, ndjsonEvents, type SourceCardData} from '@/lib/citations';
import {comparisonIds, comparisonKey} from '@/lib/compare';
import {useChatHistory, type Conversation} from '@/lib/chatHistory';
import {useApi} from '@/lib/useApi';
import {useSearchParams} from 'next/navigation';

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
  return <Suspense><ComparisonRoute /></Suspense>;
}

function ComparisonRoute() {
  const {t} = useSettings();
  const {ready, conversations} = useChatHistory();
  const raw = useSearchParams().get('ids') ?? '';
  const ids = useMemo(() => comparisonIds(raw), [raw]);
  const id = comparisonKey(ids);
  if (!ready) return null;
  if (ids.length < 2) return (
    <div className="igris-page">
      <div className="igris-content">
        <EmptyState title={t.compareTitle} description={t.compareNeedTwo} />
      </div>
    </div>
  );

  const saved = conversations.find(chat => chat.id === id);
  return <ConversationSlot key={id} id={id}><Comparison id={id} ids={saved?.comparison?.ids ?? ids} saved={saved} /></ConversationSlot>;
}

function Comparison({id, ids: requestedIds, saved}: {id: string; ids: string[]; saved?: Conversation}) {
  const [ids] = useState(requestedIds);
  const {t, lang} = useSettings();
  const {save} = useChatHistory();
  const [invs, setInvs] = useState<Inv[] | null>(null);
  const [factsError, setFactsError] = useState(false);
  const [steps, setSteps] = useState<ChatStep[]>([]);
  const [cards, setCards] = useState<SourceCardData[]>(saved?.comparison?.summary?.cards ?? []);
  const [answer, setAnswer] = useState(saved?.comparison?.summary?.content ?? '');
  const [summary, setSummary] = useState<ChatMsg | null>(saved?.comparison?.summary ?? null);
  const [publicResearch, setPublicResearch] = useState(saved?.comparison?.publicResearch === true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasSaved = useRef(Boolean(saved));
  const request = useRef<AbortController | null>(null);
  const autoStarted = useRef(false);
  const meta = useApi<{parameters: {id: string; label_en: string; label_uk: string}[]}>('/api/meta');

  useEffect(() => {
    const controller = new AbortController();
    Promise.all(ids.map(id => fetch(`/api/investigations/${encodeURIComponent(id)}`, {signal: controller.signal})
      .then(r => (r.ok ? (r.json() as Promise<Detail>) : null))))
      .then(list => {
        if (controller.signal.aborted) return;
        const found = list.flatMap(d => (d?.investigation ? [{...d.investigation, params: d.parameters, pubs: d.publications.length}] : []));
        setInvs(found);
        if (found.length !== ids.length) setFactsError(true);
      })
      .catch(() => { if (!controller.signal.aborted) setFactsError(true); });
    return () => controller.abort();
  }, [ids]);

  useEffect(() => () => request.current?.abort(), []);

  const run = useCallback(async (regenerate = false) => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    const names = ids.map(invId => invs?.find(inv => inv.id === invId)?.acronym ?? invId);
    save({id, messages: [], focus: {ids, names}, comparison: {ids, names, summary, publicResearch}}, 'summary');
    setError(null);
    setSteps([]);

    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({ids, lang, regenerate}),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(70_000)]),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 429) setError(limitText(t, body.code));
        else if (res.status === 409) setError(t.comparePending);
        else if (res.status === 404) setError(t.errData);
        else setError(body.error === 'not_configured' ? t.errNotConfigured : t.errModel);
        return;
      }
      let text = '';
      let sources: SourceCardData[] = [];
      let completed = false;
      let errorCode: string | undefined;
      for await (const raw of ndjsonEvents(res.body)) {
        const ev = chatEventSchema.parse(raw);
        if (ev.type === 'delta') {
          text += ev.text;

        } else if (ev.type === 'replace') {
          text = ev.text;

        } else if (ev.type === 'step') {
          setSteps(s => [...s.filter(x => x.id !== ev.id), {id: ev.id, status: ev.status, detail: ev.detail}]);
        } else if (ev.type === 'sources') {
          sources = ev.cards;

        } else if (ev.type === 'done') {
          completed = true;
          break;
        } else if (ev.type === 'error') {
          errorCode = ev.code ?? 'model_unavailable';
          break;
        }
      }
      if (completed && !errorCode && text.trim()) {
        setSummary(assistantMsg(text, sources));
        setAnswer(text);
        setCards(sources);
        setPublicResearch(res.headers.get('x-comparison-public-research') === 'enabled');
      }
      else setError(errorCode === 'answer_unverified' ? t.errUnverified : errorCode === 'answer_incomplete' ? t.errIncomplete : t.errModel);
    } catch {
      if (!controller.signal.aborted) setError(t.errModel);
    } finally {
      setSteps(steps => steps.map(s => s.status === 'running' ? {...s, status: 'error'} : s));
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }, [id, ids, invs, lang, t, save, summary, publicResearch]);

  const names = useMemo(() => saved?.comparison?.names ?? ids.map(invId => invs?.find(inv => inv.id === invId)?.acronym ?? invId), [saved?.comparison?.names, ids, invs]);

  useEffect(() => {
    if (!invs || factsError || hasSaved.current || autoStarted.current) return;
    const timer = window.setTimeout(() => {
      autoStarted.current = true;
      void run();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [invs, factsError, run]);

  useEffect(() => {
    if (!invs || factsError || busy || (!saved && !autoStarted.current)) return;
    if (saved && summary?.content === saved.comparison?.summary?.content
      && publicResearch === (saved.comparison?.publicResearch === true)) return;
    save({id, messages: [], focus: {ids, names}, comparison: {ids, names, summary, publicResearch}}, 'summary');
  }, [invs, factsError, busy, saved, summary, publicResearch, save, id, ids, names]);

  const viewed = useConversationActivity(id, busy, answer + (error ?? ''));

  const activeStep = steps.findLast(step => step.status === 'running')?.id;
  const progressLabel = activeStep === 'web' ? t.stepWeb : activeStep === 'verify' ? t.stepVerify : activeStep === 'answer' ? t.compareStepWrite : t.compareStepLoad;
  const list = invs ?? [];
  const cell = (fn: (i: Inv) => React.ReactNode) => Object.fromEntries(list.map(i => [i.id, fn(i)]));
  const paramIds = [...new Set(list.flatMap(i => i.params.map(p => p.parameter_id)))];
  const facts = ([
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
  ] as FactRow[]).filter(row => list.some(investigation => row[investigation.id] !== '—'));
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
          <PageHeader title={t.compareTitle} />

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
                {summary && !publicResearch && !busy && !error && (
                  <Button label={t.comparePublicSources} variant="secondary" size="sm" onClick={() => void run()} />
                )}
              </HStack>
              {busy && <Text type="supporting" color="secondary" role="status">
                {progressLabel}
              </Text>}
              {answer && <Markdown density="compact">{linkCitations(answer, cards)}</Markdown>}
              {answer && !busy && <MessageActions text={answer} onRetry={() => void run(true)} />}
              {error && (
                <HStack gap={3} vAlign="center" wrap="wrap">
                  <Text color="secondary">{error}</Text>
                  <Button label={t.compareRetry} size="sm" onClick={() => void run()} isDisabled={busy} />
                </HStack>
              )}
              {saved && !summary && !busy && !error && (
                <Button label={t.compareGenerate} size="sm" onClick={() => void run()} />
              )}
              <div ref={viewed} />
              {cards.length > 0 && !busy && <SourceCards cards={cards} title={t.sources} answer={answer} />}
            </VStack>
          </Card>

          {invs && !factsError && (
            <ComparisonFollowUp id={id} ids={ids} names={names} summary={summary} saved={saved} visible={!busy} />
          )}
        </VStack>
      </div>
    </div>
  );
}

interface ComparisonFollowUpProps {
  id: string;
  ids: string[];
  names: string[];
  summary: ChatMsg | null;
  saved?: Conversation;
  visible: boolean;
}

function ComparisonFollowUp(props: ComparisonFollowUpProps) {
  const {t} = useSettings();
  const prefix: HistoryItem[] = [{role: 'user', content: t.compareSeedQuestion(props.names.join(', '))}];
  if (props.summary) prefix.push({role: 'assistant', content: props.summary.content});
  const runtime = useChatRuntime({
    surface: 'comparison',
    focus: props.ids,
    prefix,
    contextCards: props.summary?.cards,
    initialMessages: props.saved?.messages,
  });
  return <AssistantRuntimeProvider runtime={runtime}>
    <ComparisonFollowUpContent {...props} runtime={runtime} />
  </AssistantRuntimeProvider>;
}

function ComparisonFollowUpContent({id, ids, names, summary, saved, visible, runtime}: ComparisonFollowUpProps & {
  runtime: AssistantRuntime;
}) {
  const {t} = useSettings();
  const {save} = useChatHistory();
  const followUp = useChat(runtime, saved?.repository);
  const viewed = useConversationActivity(id, followUp.busy, latestResponseText(followUp.messages));
  const lastSaved = useRef<typeof followUp.messages | null>(null);

  useEffect(() => {
    if (!followUp.ready || followUp.busy || !followUp.messages.length || lastSaved.current === followUp.messages) return;
    lastSaved.current = followUp.messages;
    save({
      id,
      messages: followUp.messages,
      focus: {ids, names},
      comparison: {ids, names, summary},
      repository: exportRepository(runtime),
    }, 'messages');
  }, [followUp.ready, followUp.busy, followUp.messages, id, ids, names, summary, runtime, save]);

  if (!visible) return null;
  return (
    <Card>
      <VStack gap={3}>
        <Heading level={2}>{t.compareAskTitle}</Heading>
        {followUp.messages.length > 0 && (
          <VStack gap={3}>
            <ChatTurns />
          </VStack>
        )}
        <div ref={viewed} />
        <ChatComposer
          isDisabled={!followUp.ready || followUp.busy}
          onSubmit={followUp.send}
          onStop={followUp.stop}
          isStopShown={followUp.busy}
          placeholder={t.compareAskPlaceholder}
        />
      </VStack>
    </Card>
  );
}

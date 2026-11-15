import {OriginalSourceLink} from './OriginalSourceLink';
import {useSettings} from '@/app/providers';
import {Collapsible} from '@astryxdesign/core/Collapsible';
import {List, ListItem} from '@astryxdesign/core/List';
import {Text} from '@astryxdesign/core/Text';
import {Link} from '@astryxdesign/core/Link';
import {cardHref, inspectAnswerCitations, type SourceCardData} from '@/lib/citations';

export function SourceCards({cards, title, answer}: {cards: SourceCardData[]; title: string; answer?: string}) {
  const {t} = useSettings();
  const citedIds = new Set(answer ? inspectAnswerCitations(answer, cards.map(card => card.id)).ids : []);
  const cited = cards.filter(card => citedIds.has(card.id));
  const extra = cards.filter(card => !citedIds.has(card.id));
  const shown = cited.length ? cited : cards;
  const row = (card: SourceCardData) => {
    const href = cardHref(card);
    return <ListItem key={card.id}
      label={href ? <Link href={href}>{card.title}</Link> : <Text>{card.title}</Text>}
      endContent={card.kind === 'investigation' && card.url ? <OriginalSourceLink url={card.url} iconOnly /> : undefined}
    />;
  };
  return (
    <SourceDisclosure label={`${cited.length ? t.citedSources : title} (${shown.length})`}>
      <List density="compact">{shown.map(row)}</List>
      {cited.length > 0 && extra.length > 0 && <SourceDisclosure label={`${t.otherSources} (${extra.length})`}>
        <List density="compact">{extra.map(row)}</List>
      </SourceDisclosure>}
    </SourceDisclosure>
  );
}

function SourceDisclosure({label, children}: {label: string; children: React.ReactNode}) {
  return <Collapsible className="igris-source-disclosure" chevronPosition="end"
    trigger={<Text type="supporting" color="secondary">{label}</Text>} defaultIsOpen={false}>
    {children}
  </Collapsible>;
}

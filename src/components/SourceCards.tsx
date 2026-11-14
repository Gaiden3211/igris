import {Link} from '@astryxdesign/core/Link';
import {cardHref, type SourceCardData} from '@/lib/citations';

export function SourceCards({cards, title}: {cards: SourceCardData[]; title: string}) {
  return (
    <details className="igris-sources">
      <summary>{title} <span>({cards.length})</span></summary>
      <ul>
        {cards.map(card => (
          <li key={card.id}>
            <span>{card.id}</span>
            <Link href={cardHref(card)}>{card.title}</Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

'use client';

import {ClickableCard} from '@astryxdesign/core/ClickableCard';
import {Badge} from '@astryxdesign/core/Badge';
import {Text} from '@astryxdesign/core/Text';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {cardHref, type SourceCardData} from '@/lib/citations';

/** Grid of cited records under an AI answer. */
export function SourceCards({cards, title, note}: {cards: SourceCardData[]; title: string; note?: string}) {
  return (
    <VStack gap={2}>
      <Text type="label" weight="semibold">{title}</Text>
      <div className="igris-grid-2">
        {cards.map(c => (
          <ClickableCard key={c.id} label={c.title} href={cardHref(c)} variant="muted" padding={3}>
            <VStack gap={1}>
              <HStack gap={2} vAlign="center">
                <Badge label={c.id} variant={c.kind === 'investigation' ? 'neutral' : 'info'} />
              </HStack>
              <Text type="label" weight="semibold">{c.title}</Text>
              {c.subtitle && <Text type="supporting" color="secondary">{c.subtitle}</Text>}
            </VStack>
          </ClickableCard>
        ))}
      </div>
      {note && <Text type="supporting" color="secondary">{note}</Text>}
    </VStack>
  );
}

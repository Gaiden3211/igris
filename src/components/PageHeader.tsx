import {Heading, Text} from '@astryxdesign/core/Text';
import {VStack} from '@astryxdesign/core/Layout';

export function PageHeader({title, subtitle}: {title: string; subtitle?: string}) {
  return (
    <VStack gap={1}>
      <Heading level={1}>{title}</Heading>
      {subtitle && <Text color="secondary">{subtitle}</Text>}
    </VStack>
  );
}

import {ArrowTopRightOnSquareIcon} from '@heroicons/react/24/outline';
import {Button} from '@astryxdesign/core/Button';
import {IconButton} from '@astryxdesign/core/IconButton';
import {useSettings} from '@/app/providers';
import {safeSourceUrl} from '@/lib/citations';

export function OriginalSourceLink({url, iconOnly = false}: {url?: string | null; iconOnly?: boolean}) {
  const {t} = useSettings();
  const href = safeSourceUrl(url);
  if (!href) return null;
  const icon = <ArrowTopRightOnSquareIcon aria-hidden="true" />;
  return iconOnly
    ? <IconButton label={t.viewSource} tooltip={t.viewSource} icon={icon} size="sm" variant="ghost" href={href} />
    : <Button label={t.originalSource} aria-label={t.viewSource} icon={icon} size="sm" variant="ghost" href={href} />;
}

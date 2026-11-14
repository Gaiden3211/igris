import Link from 'next/link';
import {ArrowLeftIcon} from '@heroicons/react/24/outline';

type Props = {label: string} & ({href: string; onClick?: never} | {href?: never; onClick: () => void});

export function BackArrow({label, href, onClick}: Props) {
  const icon = <ArrowLeftIcon aria-hidden="true" />;
  return href
    ? <Link href={href} className="igris-icon-button" aria-label={label} title={label}>{icon}</Link>
    : <button type="button" className="igris-icon-button" aria-label={label} title={label} onClick={onClick}>{icon}</button>;
}

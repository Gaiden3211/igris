'use client';

import {ArrowLeftIcon} from '@heroicons/react/24/outline';
import {IconButton} from '@astryxdesign/core/IconButton';

export function BackArrow({label, onClick}: {label: string; onClick: () => void}) {
  return <IconButton label={label} tooltip={label} icon={<ArrowLeftIcon aria-hidden="true" />} variant="ghost" onClick={onClick} />;
}

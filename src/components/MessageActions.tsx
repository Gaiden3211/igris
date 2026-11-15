'use client';

import {useEffect, useRef, useState} from 'react';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Icon} from '@astryxdesign/core/Icon';
import {CheckIcon, ClipboardIcon, ArrowPathIcon} from '@heroicons/react/24/outline';
import {HStack} from '@astryxdesign/core/Layout';
import {Text} from '@astryxdesign/core/Text';
import {useSettings} from '@/app/providers';

export function MessageActions({text, onRetry, disabled = false}: {text: string; onRetry?: () => void; disabled?: boolean}) {
  const {t} = useSettings();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
    } catch { setCopyState('failed'); }
    timer.current = setTimeout(() => setCopyState('idle'), 2500);
  };
  const copyLabel = copyState === 'copied' ? t.copied : t.copyAnswer;
  const retryLabel = text ? t.regenerate : t.compareRetry;
  return (
    <HStack className="igris-message-actions" gap={0} vAlign="center" wrap="wrap" role="group" aria-label={t.chatActions}>
      {text && <IconButton label={copyLabel} tooltip={copyLabel} icon={<Icon icon={copyState === 'copied' ? CheckIcon : ClipboardIcon} />} variant="ghost" size="sm" onClick={() => void copy()} isDisabled={disabled} />}
      {onRetry && <IconButton label={retryLabel} tooltip={retryLabel} icon={<Icon icon={ArrowPathIcon} />} variant="ghost" size="sm" onClick={onRetry} isDisabled={disabled} />}
      {copyState === 'failed' && <Text type="supporting" color="secondary">{t.copyFailed}</Text>}
      <Text className="igris-sr-only" role="status">{copyState === 'failed' ? t.copyFailed : copyState === 'copied' ? t.copied : ''}</Text>
    </HStack>
  );
}

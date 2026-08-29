import type { BaseState, CellState } from '@libs/protocol';
import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  Minus,
  TriangleAlert,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { isNormal, stateSeverity } from '@/lib/severity';

const BASE_ICON = {
  Charge: ArrowUp,
  Dischg: ArrowDown,
  Idle: Minus,
} as const;

export function BaseStatePill({ state }: { state: BaseState }) {
  const Icon =
    state === 'Charge'
      ? BASE_ICON.Charge
      : state === 'Dischg'
        ? BASE_ICON.Dischg
        : BASE_ICON.Idle;
  const variant =
    state === 'Absent' ? 'critical' : state === 'Idle' ? 'outline' : 'ok';

  return (
    <Badge variant={variant} className="uppercase">
      <Icon className="size-3" aria-hidden />
      {state}
    </Badge>
  );
}

/** Only the abnormal states get an icon and a border, so a healthy row stays quiet. */
export function StateChip({
  label,
  state,
}: {
  label: string;
  state: CellState;
}) {
  const severity = stateSeverity(state);

  if (isNormal(state)) {
    return (
      <span className="flex items-baseline justify-between gap-2 text-[11px] text-ink-dim">
        <span>{label}</span>
        <span className="text-ink-dim">Normal</span>
      </span>
    );
  }

  const Icon = severity === 'critical' ? CircleAlert : TriangleAlert;

  return (
    <span className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-ink-dim">{label}</span>
      <Badge variant={severity === 'critical' ? 'critical' : 'warn'}>
        <Icon className="size-3" aria-hidden />
        {state}
      </Badge>
    </span>
  );
}

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  detail: string;
  action?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  detail,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 bg-panel px-4 py-12 text-center">
      <Icon className="size-6 text-ink-faint" aria-hidden />
      <p className="text-sm font-semibold">{title}</p>
      <p className="max-w-md text-xs text-ink-dim">{detail}</p>
      {action}
    </div>
  );
}

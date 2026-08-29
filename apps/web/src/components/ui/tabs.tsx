import { cn } from '@/lib/utils';

export interface TabDef<T extends string> {
  id: T;
  label: string;
  /** Right-hand count or flag, e.g. the number of live protection trips. */
  badge?: string;
  tone?: 'warn' | 'critical';
}

export interface TabsProps<T extends string> {
  tabs: Array<TabDef<T>>;
  active: T;
  onSelect: (id: T) => void;
}

/** Panel selector, styled as instrument tabs sitting on the rule rather than as buttons. */
export function Tabs<T extends string>({
  tabs,
  active,
  onSelect,
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label="Panels"
      className="flex items-end gap-px overflow-x-auto border-b border-rule bg-ground px-2"
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(tab.id)}
            className={cn(
              'relative -mb-px flex items-center gap-1.5 border border-transparent px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none',
              selected
                ? 'border-rule border-b-panel bg-panel text-ink'
                : 'text-ink-faint hover:text-ink-dim',
            )}
          >
            {tab.label}
            {tab.badge ? (
              <span
                className={cn(
                  'tnum rounded-sm px-1 text-[10px] leading-[1.5] font-semibold',
                  tab.tone === 'critical'
                    ? 'bg-[var(--critical-soft)] text-[var(--critical)]'
                    : tab.tone === 'warn'
                      ? 'bg-[var(--warn-soft)] text-[var(--warn)]'
                      : 'bg-panel-sunken text-ink-faint',
                )}
              >
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

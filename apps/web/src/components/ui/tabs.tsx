import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

export interface TabDef<T extends string> {
  id: T;
  label: string;
  /** Right-hand count or flag, e.g. the number of live protection trips. */
  badge?: string;
  tone?: 'warn' | 'critical';
}

/** An address outside the app, sitting on the same rule but opening in its own window. */
export interface TabLinkDef {
  id: string;
  label: string;
  href: string;
}

export type TabEntry<T extends string> = TabDef<T> | TabLinkDef;

export interface TabsProps<T extends string> {
  tabs: Array<TabEntry<T>>;
  active: T;
  onSelect: (id: T) => void;
}

const isLink = <T extends string>(entry: TabEntry<T>): entry is TabLinkDef =>
  'href' in entry;

const ITEM =
  'relative -mb-px flex items-center gap-1.5 border border-transparent px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none';

/** Panel selector, styled as instrument tabs sitting on the rule rather than as buttons. */
export function Tabs<T extends string>({
  tabs,
  active,
  onSelect,
}: TabsProps<T>) {
  const { t } = useTranslation();
  const panels = tabs.filter((entry): entry is TabDef<T> => !isLink(entry));
  const links = tabs.filter(isLink);

  return (
    <div className="flex items-end gap-px overflow-x-auto border-b border-rule bg-ground px-2">
      {/* A link is not a tab, so it stays outside the tablist rather than lying about its role. */}
      {panels.length > 0 ? (
        <div
          role="tablist"
          aria-label={t('tabs.ariaLabel')}
          className="flex items-end gap-px"
        >
          {panels.map((tab) => {
            const selected = tab.id === active;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onSelect(tab.id)}
                className={cn(
                  ITEM,
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
      ) : null}

      {links.map((link) => (
        <a
          key={link.id}
          href={link.href}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={`${link.label} (opens in a new window)`}
          className={cn(ITEM, 'text-ink-faint hover:text-ink-dim')}
        >
          {link.label}
          <ExternalLink className="size-3 opacity-70" aria-hidden />
        </a>
      ))}
    </div>
  );
}

import { useEffect } from 'react';
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
  'caps relative flex h-9 shrink-0 items-center gap-1.5 px-2 text-[11px] whitespace-nowrap transition-colors focus-visible:ring-1 focus-visible:ring-[var(--ring)] focus-visible:outline-none';

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/**
 * Panel selector. Each panel carries a numeral, and the numeral is a real shortcut — press it
 * anywhere on the page — so the superscript is an instruction, not a decoration.
 */
export function Tabs<T extends string>({
  tabs,
  active,
  onSelect,
}: TabsProps<T>) {
  const { t } = useTranslation();
  const panels = tabs.filter((entry): entry is TabDef<T> => !isLink(entry));
  const links = tabs.filter(isLink);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditable(event.target)
      ) {
        return;
      }

      const index = Number(event.key) - 1;
      const target = panels[index];

      if (Number.isInteger(index) && target) {
        onSelect(target.id);
      }
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [panels, onSelect]);

  return (
    <div className="flex items-stretch gap-1 overflow-x-auto px-1">
      {/* A link is not a tab, so it stays outside the tablist rather than lying about its role. */}
      <div
        role="tablist"
        aria-label={t('tabs.ariaLabel')}
        className="flex items-stretch gap-1"
      >
        {panels.map((tab, index) => {
          const selected = tab.id === active;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-keyshortcuts={String(index + 1)}
              onClick={() => onSelect(tab.id)}
              className={cn(
                ITEM,
                selected ? 'text-ink' : 'text-ink-faint hover:text-ink-dim',
              )}
            >
              <span className="key" aria-hidden>
                {index + 1}
              </span>
              {tab.label}
              {tab.badge ? (
                <span
                  className={cn(
                    'tnum px-1 text-[10px] leading-[1.6]',
                    tab.tone === 'critical'
                      ? 'bg-critical-soft text-critical'
                      : tab.tone === 'warn'
                        ? 'bg-warn-soft text-warn'
                        : 'bg-panel-sunken text-ink-faint',
                  )}
                >
                  {tab.badge}
                </span>
              ) : null}
              {selected ? (
                <span
                  className="absolute inset-x-2 bottom-0 h-px bg-accent"
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>

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
          <span className="text-accent" aria-hidden>
            ↗
          </span>
        </a>
      ))}
    </div>
  );
}

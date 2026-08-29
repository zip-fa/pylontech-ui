import type { PackCells } from '@libs/protocol';
import { BatteryWarning, Loader2, PlugZap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CellMatrix } from '@/components/cell-matrix';
import { CellTable } from '@/components/cell-table';
import { Degradation } from '@/components/degradation';
import { EmptyState } from '@/components/empty-state';
import { PackFaultCounters, PackHistory } from '@/components/pack-history';
import { PackIdentity } from '@/components/pack-identity';
import { PackMetrics } from '@/components/pack-metrics';
import { StackBand } from '@/components/stack-band';
import { TopRail } from '@/components/top-rail';
import { Panel, PanelBody, PanelHead } from '@/components/ui/card';
import { Tabs, type TabEntry } from '@/components/ui/tabs';
import { POLL_INTERVAL_MS, useSnapshotFeed } from '@/hooks/use-snapshot';
import { useTheme } from '@/hooks/use-theme';
import { toCellRows } from '@/lib/cell-rows';

const TAB_IDS = [
  'cells',
  'degradation',
  'lifetime',
  'protection',
  'hardware',
] as const;

type TabId = (typeof TAB_IDS)[number];

function isTabId(value: string): value is TabId {
  return (TAB_IDS as readonly string[]).includes(value);
}

/** The open panel lives in the hash, so a reload — or a shared link — lands where you left off. */
function useHashTab(): [TabId, (id: TabId) => void] {
  const [tab, setTab] = useState<TabId>(() => {
    const fromHash = globalThis.location?.hash.replace('#', '') ?? '';

    return isTabId(fromHash) ? fromHash : 'cells';
  });

  useEffect(() => {
    const onHashChange = () => {
      const next = globalThis.location.hash.replace('#', '');

      if (isTabId(next)) {
        setTab(next);
      }
    };

    globalThis.addEventListener('hashchange', onHashChange);

    return () => globalThis.removeEventListener('hashchange', onHashChange);
  }, []);

  return [
    tab,
    (id: TabId) => {
      globalThis.location.hash = id;
      setTab(id);
    },
  ];
}

export function App() {
  const { t } = useTranslation();
  const [theme, toggleTheme] = useTheme();
  const [tab, setTab] = useHashTab();
  const [now, setNow] = useState(() => Date.now());

  const feed = useSnapshotFeed();
  const snapshot = feed.snapshot;

  // The "last updated" age has to keep counting between polls.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(timer);
  }, []);

  const packs = useMemo(
    () =>
      (snapshot?.packs ?? [])
        .filter((pack) => pack.present)
        .sort((a, b) => a.address - b.address),
    [snapshot],
  );

  const addresses = useMemo(() => packs.map((pack) => pack.address), [packs]);

  const cellPacks = useMemo<PackCells[]>(
    () =>
      addresses
        .map((address) => snapshot?.cells[address])
        .filter(
          (entry): entry is PackCells =>
            Boolean(entry) && (entry?.cells.length ?? 0) > 0,
        ),
    [addresses, snapshot],
  );

  const cellRows = useMemo(() => toCellRows(cellPacks), [cellPacks]);

  // Every protection counter that is not zero, across every pack: the badge on the Protection tab.
  const trips = useMemo(
    () =>
      addresses.reduce((total, address) => {
        const faults = snapshot?.stats[address]?.faults ?? {};

        return (
          total + Object.values(faults).filter((value) => value > 0).length
        );
      }, 0),
    [addresses, snapshot],
  );

  // Vite proxies /metrics to the daemon in development, so one relative href works everywhere.
  const metricsTab = {
    id: 'metrics',
    label: t('tabs.metrics'),
    href: '/metrics',
  };

  const tabs: Array<TabEntry<TabId>> = [
    { id: 'cells', label: t('tabs.cells') },
    { id: 'degradation', label: t('tabs.degradation') },
    { id: 'lifetime', label: t('tabs.lifetime') },
    {
      id: 'protection',
      label: t('tabs.protection'),
      badge: trips > 0 ? String(trips) : undefined,
      tone: 'critical',
    },
    { id: 'hardware', label: t('tabs.hardware') },
    metricsTab,
  ];

  return (
    <div className="flex min-h-full flex-col">
      <TopRail
        snapshot={snapshot}
        health={feed.health}
        fetchError={feed.fetchError}
        now={now}
        theme={theme}
        onToggleTheme={toggleTheme}
        onRefresh={feed.refresh}
      />

      {feed.isPending && !snapshot ? (
        <>
          <Tabs tabs={[metricsTab]} active={tab} onSelect={setTab} />
          <EmptyState
            icon={Loader2}
            title={t('empty.contactingTitle')}
            detail={t('empty.contactingDetail')}
          />
        </>
      ) : !snapshot ? (
        <>
          <Tabs tabs={[metricsTab]} active={tab} onSelect={setTab} />
          <EmptyState
            icon={PlugZap}
            title={t('empty.noSnapshotTitle')}
            detail={t('empty.noSnapshotDetail')}
          />
        </>
      ) : packs.length === 0 ? (
        <>
          <Tabs tabs={[metricsTab]} active={tab} onSelect={setTab} />
          <EmptyState
            icon={BatteryWarning}
            title={t('empty.noPacksTitle')}
            detail={
              snapshot.connected
                ? t('empty.noPacksConnected')
                : t('empty.noPacksDisconnected')
            }
          />
        </>
      ) : (
        <>
          {snapshot.totals ? (
            <div className="border-b border-rule">
              <StackBand totals={snapshot.totals} />
            </div>
          ) : null}

          <Tabs tabs={tabs} active={tab} onSelect={setTab} />

          <main className="flex-1 bg-ground">
            {tab === 'cells' ? (
              <div className="bed flex flex-col gap-px">
                {cellPacks.length > 0 ? (
                  <CellMatrix packs={cellPacks} />
                ) : (
                  <EmptyState
                    icon={BatteryWarning}
                    title={t('empty.noCellsTitle')}
                    detail={t('empty.noCellsDetail')}
                  />
                )}

                <div className="bed grid grid-cols-1 gap-px xl:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]">
                  <Panel>
                    <PanelHead
                      title={t('panels.packReadings')}
                      note={t('panels.everySeconds', {
                        seconds: POLL_INTERVAL_MS / 1000,
                      })}
                    />
                    <PanelBody>
                      <PackMetrics packs={packs} cells={snapshot.cells} />
                    </PanelBody>
                  </Panel>

                  <Panel>
                    <PanelHead
                      title={t('panels.everyCell')}
                      note={t('panels.cellsSortable', {
                        count: cellRows.length,
                      })}
                    />
                    <PanelBody>
                      {cellRows.length > 0 ? (
                        <CellTable rows={cellRows} />
                      ) : (
                        <p className="p-3 text-xs text-ink-faint">
                          {t('empty.waitingCells')}
                        </p>
                      )}
                    </PanelBody>
                  </Panel>
                </div>
              </div>
            ) : null}

            {tab === 'degradation' ? (
              <Degradation
                addresses={addresses}
                euro={snapshot.euro}
                info={snapshot.info}
                stats={snapshot.stats}
              />
            ) : null}

            {tab === 'lifetime' ? (
              <Panel>
                <PanelHead
                  title={t('panels.lifetimeCounters')}
                  note={t('panels.lifetimeNote')}
                />
                <PanelBody>
                  <PackHistory addresses={addresses} stats={snapshot.stats} />
                </PanelBody>
              </Panel>
            ) : null}

            {tab === 'protection' ? (
              <Panel>
                <PanelHead
                  title={t('panels.protectionCounters')}
                  note={
                    trips > 0
                      ? t('panels.protectionNote', { count: trips })
                      : t('panels.protectionNoneNote')
                  }
                />
                <PanelBody>
                  <PackFaultCounters
                    addresses={addresses}
                    stats={snapshot.stats}
                  />
                </PanelBody>
              </Panel>
            ) : null}

            {tab === 'hardware' ? (
              <Panel>
                <PanelHead
                  title={t('panels.hardware')}
                  note={t('panels.hardwareNote')}
                />
                <PanelBody>
                  <PackIdentity addresses={addresses} info={snapshot.info} />
                </PanelBody>
              </Panel>
            ) : null}
          </main>
        </>
      )}
    </div>
  );
}

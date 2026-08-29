import type { PackCells } from '@libs/protocol';
import { BatteryWarning, Loader2, PlugZap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

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
import { Tabs, type TabDef } from '@/components/ui/tabs';
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

      if (isTabId(next)) setTab(next);
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

  const tabs: Array<TabDef<TabId>> = [
    { id: 'cells', label: 'Cells & pack stats' },
    { id: 'degradation', label: 'Degradation' },
    { id: 'lifetime', label: 'Lifetime' },
    {
      id: 'protection',
      label: 'Protection',
      badge: trips > 0 ? String(trips) : undefined,
      tone: 'critical',
    },
    { id: 'hardware', label: 'Firmware & hardware' },
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
        <EmptyState
          icon={Loader2}
          title="Contacting the daemon"
          detail="Polling /api/state. Nothing has arrived yet."
        />
      ) : !snapshot ? (
        <EmptyState
          icon={PlugZap}
          title="No snapshot available"
          detail="The daemon did not return a readable snapshot. Start it with `npm run daemon`."
        />
      ) : packs.length === 0 ? (
        <EmptyState
          icon={BatteryWarning}
          title="No packs reporting"
          detail={
            snapshot.connected
              ? 'The console is open but no pack answered the last poll. Check the link cabling and pack addressing.'
              : 'The serial port is not open, so no pack data can be read.'
          }
        />
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
                    title="No cell readings yet"
                    detail="Packs are present but the first per-cell sweep has not returned."
                  />
                )}

                <div className="bed grid grid-cols-1 gap-px xl:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]">
                  <Panel>
                    <PanelHead
                      title="Pack readings"
                      note={`every ${POLL_INTERVAL_MS / 1000}s`}
                    />
                    <PanelBody>
                      <PackMetrics packs={packs} cells={snapshot.cells} />
                    </PanelBody>
                  </Panel>

                  <Panel>
                    <PanelHead
                      title="Every cell"
                      note={`${cellRows.length} cells · sortable`}
                    />
                    <PanelBody>
                      {cellRows.length > 0 ? (
                        <CellTable rows={cellRows} />
                      ) : (
                        <p className="p-3 text-xs text-ink-faint">
                          Waiting for the first per-cell sweep.
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
                  title="Lifetime counters"
                  note="cumulative since the pack left the factory"
                />
                <PanelBody>
                  <PackHistory addresses={addresses} stats={snapshot.stats} />
                </PanelBody>
              </Panel>
            ) : null}

            {tab === 'protection' ? (
              <Panel>
                <PanelHead
                  title="Protection counters"
                  note={
                    trips > 0
                      ? `${trips} counter${trips === 1 ? '' : 's'} above zero`
                      : 'every counter at zero'
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
                  title="Firmware and hardware"
                  note="read once, then refreshed on the slow sweep"
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

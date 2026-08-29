import type { Snapshot } from '@libs/protocol';
import { useQuery } from '@tanstack/react-query';

import {
  describeFetchError,
  fetchHealth,
  fetchSnapshot,
  type Health,
} from '@/lib/api';

export const POLL_INTERVAL_MS = 5000;

export interface SnapshotFeed {
  snapshot: Snapshot | null;
  health: Health | null;
  isPending: boolean;
  fetchError: string | null;
  dataUpdatedAt: number;
  refresh: () => void;
}

export function useSnapshotFeed(): SnapshotFeed {
  const state = useQuery({
    queryKey: ['state'],
    queryFn: fetchSnapshot,
    refetchInterval: POLL_INTERVAL_MS,
    // Just under the poll interval, so returning to the tab always pulls a fresh reading.
    staleTime: POLL_INTERVAL_MS - 500,
    refetchOnWindowFocus: true,
    retry: false,
  });

  // Health is a separate, cheaper endpoint that still answers while /api/state is failing.
  const health = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    enabled: state.isError,
    refetchInterval: POLL_INTERVAL_MS,
    retry: false,
  });

  return {
    snapshot: state.data ?? null,
    health: health.data ?? null,
    isPending: state.isPending,
    fetchError: state.isError ? describeFetchError(state.error) : null,
    dataUpdatedAt: state.dataUpdatedAt,
    refresh: () => void state.refetch(),
  };
}

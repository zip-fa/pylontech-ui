import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A failed poll is not worth retrying: the next tick is 5s away anyway.
      retry: false,
      refetchOnWindowFocus: true,
      gcTime: 5 * 60_000,
    },
  },
});

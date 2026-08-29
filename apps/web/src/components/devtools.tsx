import { Suspense, lazy } from 'react';

const Panel = lazy(() =>
  import('@tanstack/react-query-devtools').then((module) => ({
    default: module.ReactQueryDevtools,
  })),
);

/** Dev-only: the import stays in its own chunk that a production bundle never loads. */
export function QueryDevtools() {
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <Panel initialIsOpen={false} buttonPosition="bottom-left" />
    </Suspense>
  );
}

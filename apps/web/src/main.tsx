import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/App';
import { QueryDevtools } from '@/components/devtools';
import { TooltipProvider } from '@/components/ui/tooltip';
import '@/i18n';
import { queryClient } from '@/lib/query-client';

import '@/index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('#root missing from index.html');
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={80}>
        <App />
      </TooltipProvider>
      <QueryDevtools />
    </QueryClientProvider>
  </StrictMode>,
);

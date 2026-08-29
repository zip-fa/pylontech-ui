import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Panel, PanelBody, PanelHead } from '@/components/ui/card';

export interface ChartPanelProps {
  title: string;
  note?: ReactNode;
  /** False when the query came back with nothing to draw, so the axes are not drawn empty. */
  hasData: boolean;
  /** Fixed rather than aspect-driven: these charts are read side by side and must line up. */
  height?: number;
  children: ReactNode;
}

export function ChartPanel({
  title,
  note,
  hasData,
  height = 200,
  children,
}: ChartPanelProps) {
  const { t } = useTranslation();

  return (
    <Panel>
      <PanelHead title={title} note={note} />
      <PanelBody>
        <div style={{ height }} className="w-full px-1 pt-2 pb-1">
          {hasData ? (
            children
          ) : (
            <div className="flex h-full items-center justify-center text-[11px] text-ink-faint">
              {t('history.noPoints')}
            </div>
          )}
        </div>
      </PanelBody>
    </Panel>
  );
}

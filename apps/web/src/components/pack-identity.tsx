import type { PackInfo } from '@libs/protocol';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';

import { MetricGrid, type MetricRow } from '@/components/metric-grid';
import { int, num, text } from '@/lib/format';

export interface PackIdentityProps {
  addresses: number[];
  info: Record<number, PackInfo>;
}

/** Everything `info` reports. Firmware and barcode are the fields that differ between batches. */
export function PackIdentity({ addresses, info }: PackIdentityProps) {
  const { t } = useTranslation();

  const row = (
    key: ParseKeys,
    render: (info: PackInfo | undefined) => string,
    group?: boolean,
  ): MetricRow => ({
    id: key,
    label: t(key),
    group,
    cells: addresses.map((address) => ({ value: render(info[address]) })),
  });

  const rows: MetricRow[] = [
    row('hardware.manufacturer', (i) => text(i?.manufacturer)),
    row('hardware.model', (i) => text(i?.deviceName)),
    row('hardware.nameplate', (i) => text(i?.specification)),
    row('hardware.cells', (i) => int(i?.cellNumber)),
    row('hardware.maxCharge', (i) => num(i?.maxChargeCurrent, 0, 'A')),
    row('hardware.maxDischarge', (i) => num(i?.maxDischargeCurrent, 0, 'A')),

    row('hardware.mainFirmware', (i) => text(i?.mainSoftVersion), true),
    row('hardware.software', (i) => text(i?.softVersion)),
    row('hardware.bootloader', (i) => text(i?.bootVersion)),
    row('hardware.commProtocol', (i) => text(i?.commVersion)),
    row('hardware.releaseDate', (i) => text(i?.releaseDate)),

    row('hardware.board', (i) => text(i?.board), true),
    row('hardware.boardVersion', (i) => text(i?.boardVersion)),
    row('hardware.barcode', (i) => text(i?.barcode)),
    row('hardware.factoryTest', (i) => text(i?.deviceTestTime)),
  ];

  return (
    <MetricGrid
      corner={t('grid.hardware')}
      columns={addresses.map((address) => t('grid.pack', { address }))}
      rows={rows}
    />
  );
}

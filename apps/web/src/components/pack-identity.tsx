import type { PackInfo } from '@libs/protocol';

import { MetricGrid, type MetricRow } from '@/components/metric-grid';
import { int, num, text } from '@/lib/format';

export interface PackIdentityProps {
  addresses: number[];
  info: Record<number, PackInfo>;
}

/** Everything `info` reports. Firmware and barcode are the fields that differ between batches. */
export function PackIdentity({ addresses, info }: PackIdentityProps) {
  const row = (
    label: string,
    render: (info: PackInfo | undefined) => string,
    group?: boolean,
  ): MetricRow => ({
    label,
    group,
    cells: addresses.map((address) => ({ value: render(info[address]) })),
  });

  const rows: MetricRow[] = [
    row('Manufacturer', (i) => text(i?.manufacturer)),
    row('Model', (i) => text(i?.deviceName)),
    row('Nameplate', (i) => text(i?.specification)),
    row('Cells', (i) => int(i?.cellNumber)),
    row('Max charge current', (i) => num(i?.maxChargeCurrent, 0, 'A')),
    row('Max discharge current', (i) => num(i?.maxDischargeCurrent, 0, 'A')),

    row('Main firmware', (i) => text(i?.mainSoftVersion), true),
    row('Software', (i) => text(i?.softVersion)),
    row('Bootloader', (i) => text(i?.bootVersion)),
    row('Comm protocol', (i) => text(i?.commVersion)),
    row('Release date', (i) => text(i?.releaseDate)),

    row('Board', (i) => text(i?.board), true),
    row('Board version', (i) => text(i?.boardVersion)),
    row('Barcode', (i) => text(i?.barcode)),
    row('Factory test', (i) => text(i?.deviceTestTime)),
  ];

  return (
    <MetricGrid
      corner="Hardware"
      columns={addresses.map((address) => `Pack ${address}`)}
      rows={rows}
    />
  );
}

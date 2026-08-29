import type { Cell, PackCells } from '@libs/protocol';

export interface CellRow extends Cell {
  pack: number;
  /** Signed distance from this cell's own pack mean, in mV. */
  delta: number;
}

/** Flattens every pack's cells into one sortable list, so the outliers can be found by column. */
export function toCellRows(packs: PackCells[]): CellRow[] {
  return packs.flatMap((pack) =>
    pack.cells.map((cell) => ({
      ...cell,
      pack: pack.address,
      delta: cell.voltage - pack.mean,
    })),
  );
}

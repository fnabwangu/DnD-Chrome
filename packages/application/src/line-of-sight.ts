import type { GridCell, MapDefinition } from "@living-rpg/schemas";

export function lineOfSight(map: MapDefinition, source: GridCell, target: GridCell): { clear: boolean; blocker?: GridCell } {
  const blocked = new Set(map.blockedCells.map((cell) => `${cell.col},${cell.row}`));
  const dx = target.col - source.col;
  const dy = target.row - source.row;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let step = 1; step < steps; step += 1) {
    const col = Math.round(source.col + (dx * step) / steps);
    const row = Math.round(source.row + (dy * step) / steps);
    if (blocked.has(`${col},${row}`)) return { clear: false, blocker: { col, row } };
  }
  return { clear: true };
}

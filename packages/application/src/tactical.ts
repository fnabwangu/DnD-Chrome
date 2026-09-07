import type { GridCell, MapDefinition } from "@living-rpg/schemas";

const DIRECTIONS: GridCell[] = [{ col: 0, row: -1 }, { col: -1, row: 0 }, { col: 1, row: 0 }, { col: 0, row: 1 }];
const sameCell = (a: GridCell, b: GridCell): boolean => a.col === b.col && a.row === b.row;
const key = (cell: GridCell): string => `${cell.col},${cell.row}`;

export function findCardinalPath(map: MapDefinition, source: GridCell, target: GridCell, occupied: GridCell[] = []): GridCell[] | undefined {
  if (source.col < 0 || source.col >= map.columns || source.row < 0 || source.row >= map.rows || target.col < 0 || target.col >= map.columns || target.row < 0 || target.row >= map.rows) return undefined;
  const blocked = new Set(map.blockedCells.map(key));
  occupied.forEach((cell) => { if (!sameCell(cell, source)) blocked.add(key(cell)); });
  if (blocked.has(key(target))) return undefined;
  const queue: GridCell[] = [source];
  const parents = new Map<string, string | undefined>([[key(source), undefined]]);
  while (queue.length) {
    const current = queue.shift()!;
    if (sameCell(current, target)) {
      const path: GridCell[] = [];
      let cursor: string | undefined = key(current);
      while (cursor) { const [col, row] = cursor.split(",").map(Number); path.unshift({ col, row }); cursor = parents.get(cursor); }
      return path;
    }
    for (const direction of DIRECTIONS) {
      const next = { col: current.col + direction.col, row: current.row + direction.row };
      const nextKey = key(next);
      if (next.col >= 0 && next.col < map.columns && next.row >= 0 && next.row < map.rows && !blocked.has(nextKey) && !parents.has(nextKey)) { parents.set(nextKey, key(current)); queue.push(next); }
    }
  }
  return undefined;
}

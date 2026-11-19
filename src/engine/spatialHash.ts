export interface Point {
  x: number;
  y: number;
}

/**
 * Hash espacial em grade. Trata cada item como um ponto.
 * Para itens com raio, some o raio máximo ao raio da consulta e confira a distância depois.
 *
 * Reconstruído uma vez por passo (`clear` + `insert`). Guarda as referências dos objetos,
 * não índices, porque os índices do Pool mudam quando algo é liberado.
 */
export class SpatialHash<T extends Point> {
  private readonly cells = new Map<number, T[]>();
  private readonly used: T[][] = [];

  constructor(private readonly cellSize: number) {}

  clear(): void {
    for (const cell of this.used) cell.length = 0;
    this.used.length = 0;
    // Evita crescimento sem limite quando o jogador percorre um mapa grande.
    if (this.cells.size > 4096) this.cells.clear();
  }

  insert(item: T): void {
    const k = this.key(Math.floor(item.x / this.cellSize), Math.floor(item.y / this.cellSize));
    let cell = this.cells.get(k);
    if (cell === undefined) {
      cell = [];
      this.cells.set(k, cell);
    }
    if (cell.length === 0) this.used.push(cell);
    cell.push(item);
  }

  /** Preenche `out` com os itens a no máximo `r` do ponto (x, y). Reaproveita `out`. */
  query(x: number, y: number, r: number, out: T[]): T[] {
    out.length = 0;
    const cs = this.cellSize;
    const r2 = r * r;
    const x0 = Math.floor((x - r) / cs);
    const x1 = Math.floor((x + r) / cs);
    const y0 = Math.floor((y - r) / cs);
    const y1 = Math.floor((y + r) / cs);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const cell = this.cells.get(this.key(cx, cy));
        if (cell === undefined) continue;
        for (let i = 0; i < cell.length; i++) {
          const it = cell[i]!;
          const dx = it.x - x;
          const dy = it.y - y;
          if (dx * dx + dy * dy <= r2) out.push(it);
        }
      }
    }
    return out;
  }

  private key(cx: number, cy: number): number {
    return ((cx & 0xffff) << 16) | (cy & 0xffff);
  }
}

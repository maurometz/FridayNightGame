/** Parede retangular (em pixels do mundo). */
export interface Wall {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Id de um prop de cenário (imagem em props/) desenhado no lugar do retângulo. A colisão continua sendo o retângulo. */
  prop?: string;
}

export interface WallHit {
  x: number;
  y: number;
  /** Encostou em alguma parede. */
  hit: boolean;
}

/** Empurra um círculo (x, y, r) para fora de todas as paredes. Devolve a nova posição. */
export function pushOutOfWalls(walls: readonly Wall[], x: number, y: number, r: number): WallHit {
  let hit = false;
  for (const w of walls) {
    const cx = Math.min(w.x + w.w, Math.max(w.x, x));
    const cy = Math.min(w.y + w.h, Math.max(w.y, y));
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r;
      y = cy + (dy / d) * r;
    } else {
      // Centro dentro da parede: sai pelo lado mais próximo.
      const left = x - w.x;
      const right = w.x + w.w - x;
      const top = y - w.y;
      const bottom = w.y + w.h - y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) x = w.x - r;
      else if (m === right) x = w.x + w.w + r;
      else if (m === top) y = w.y - r;
      else y = w.y + w.h + r;
    }
  }
  return { x, y, hit };
}

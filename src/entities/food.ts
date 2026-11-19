import type { FoodDef } from '../data/foods';
import type { Poolable } from '../engine/pool';

export interface Food extends Poolable {
  def: FoodDef;
  x: number;
  y: number;
  /** Segundos restantes antes de a comida sumir do chão. */
  life: number;
  alive: boolean;
}

export function createFood(): Food {
  return {
    poolIndex: 0,
    def: undefined as unknown as FoodDef,
    x: 0,
    y: 0,
    life: 0,
    alive: false,
  };
}

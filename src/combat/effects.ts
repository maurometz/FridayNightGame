import { STEP_S } from '../data/balance';
import type { EffectKind } from '../entities/effect';
import type { World } from '../engine/world';

export interface EffectSpec {
  kind: EffectKind;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  radius?: number;
  life: number;
  color: string;
  text?: string;
  angle?: number;
  halfArc?: number;
  /** Imagem externa (ver SpriteManager.getProjetil); sem ela vale o desenho por código. */
  sprite?: string;
}

export function spawnEffect(world: World, s: EffectSpec): void {
  const e = world.effects.acquire();
  if (!e) return;
  e.kind = s.kind;
  e.x = s.x;
  e.y = s.y;
  e.x2 = s.x2 ?? s.x;
  e.y2 = s.y2 ?? s.y;
  e.radius = s.radius ?? 0;
  e.life = s.life;
  e.maxLife = s.life;
  e.color = s.color;
  e.text = s.text ?? '';
  e.angle = s.angle ?? 0;
  e.halfArc = s.halfArc ?? 0;
  e.sprite = s.sprite ?? '';
}

export function updateEffects(world: World): void {
  const list = world.effects.active;
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i]!;
    e.life -= STEP_S;
    if (e.life <= 0) world.effects.release(e);
  }
}

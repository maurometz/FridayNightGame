import { updateExtraWeapons } from '../combat/sharedWeapons';
import { emTranse } from '../combat/bosses';
import { updateGenericWeapon } from '../combat/weapons';
import { STEP_S } from '../data/balance';
import { NO_INPUT, type PlayerInput } from '../engine/input';
import type { World } from '../engine/world';
import { updateFelipe } from './felipe';
import { updateMauro } from './mauro';
import { updateMelissa } from './melissa';
import { updateThaisa } from './thaisa';
import { updateThayssa } from './thayssa';

/**
 * Atualiza o ataque de cada jogador. Personagens com kit próprio usam a lógica dele;
 * os demais usam a arma genérica até a vez do seu kit.
 */
export function updateKits(world: World, inputs: readonly PlayerInput[]): void {
  // Os efeitos de aura são recalculados a cada passo: zera e deixa os kits reaplicarem.
  // O movimento do passo seguinte usa o que foi aplicado aqui.
  for (const p of world.players) {
    p.auraCrit = 0;
    p.auraSpeedMul = 1;
    p.auraAttackMul = 1;
    p.damageTakenMul = Math.max(0.2, 1 - p.damageReduction);
    let dano = p.baseDamageMul;
    // Buffs temporários de aliados (cartas de equipe).
    for (let i = p.buffs.length - 1; i >= 0; i--) {
      const b = p.buffs[i]!;
      b.left -= STEP_S;
      if (b.left <= 0) {
        p.buffs.splice(i, 1);
        continue;
      }
      if (b.damage) dano *= b.damage;
      if (b.attack) p.auraAttackMul *= b.attack;
      if (b.speed) p.auraSpeedMul *= b.speed;
      if (b.crit) p.auraCrit += b.crit;
      if (b.reduction) p.damageTakenMul *= 1 - b.reduction;
    }
    p.damageMul = dano;
  }

  for (const p of world.players) {
    if (p.hp <= 0) continue;
    // Em transe (RM) ela só ataca os aliados; os ataques normais do kit ficam parados.
    if (emTranse(world, p)) continue;
    updateExtraWeapons(world, p);
    if (p.kit?.type === 'felipe') updateFelipe(world, p, inputs[p.slot] ?? NO_INPUT);
    else if (p.kit?.type === 'mauro') updateMauro(world, p);
    else if (p.kit?.type === 'melissa') updateMelissa(world, p, inputs[p.slot] ?? NO_INPUT);
    else if (p.kit?.type === 'thaisa') updateThaisa(world, p);
    else if (p.kit?.type === 'thayssa') updateThayssa(world, p, inputs[p.slot] ?? NO_INPUT);
    else updateGenericWeapon(world, p);
  }
}

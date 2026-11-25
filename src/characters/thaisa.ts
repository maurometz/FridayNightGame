import { damageArea, damageEnemy, knockEnemy } from '../combat/enemies';
import { spawnEffect } from '../combat/effects';
import { spawnProjectile } from '../combat/projectiles';
import { nearestEnemy } from '../combat/weapons';
import { STEP_S } from '../data/balance';
import {
  FORTALEZA_BLOCK_S,
  GOLPE_COOLDOWN_S,
  GOLPE_DAMAGE,
  GOLPE_VISIBLE_S,
  KNOCKBACK_SPEED,
  ONDA_DAMAGE_MUL,
  ONDA_KNOCK_SPEED,
  ONDA_LIFETIME_S,
  ONDA_RADIUS,
  ONDA_SPEED,
  PE_FIRME_S,
  RODIZIO_PULSE_DAMAGE,
  RODIZIO_PULSE_EVERY_S,
  RODIZIO_PULSE_RADIUS,
  SISMICA_EVERY_SWINGS,
} from '../data/thaisa';
import { attackSpeed, type Player } from '../entities/player';
import { wrapAngle } from '../engine/math';
import type { World } from '../engine/world';
import { aberturaDoGolpe, alcanceDoGolpe, bonusDoPico, darPico, type ThaisaState } from './thaisaState';
import { addBuff, aliadosPerto } from '../combat/teamEffects';
import {
  ARCO_COLETIVO_DAMAGE,
  ARCO_COLETIVO_RANGE,
  ARCO_COLETIVO_S,
  MURO_REDUCTION,
  MURO_RADIUS,
  RODA_ATTACK,
  RODA_EVERY_S,
  RODA_RADIUS,
  RODA_S,
} from '../data/team';

export { aberturaDoGolpe, alcanceDoGolpe };

/** Recarga do golpe, já com o bônus de velocidade de ataque do Pico (+8% por acúmulo). */
export function recargaDoGolpe(p: Player, s: ThaisaState): number {
  return GOLPE_COOLDOWN_S / (attackSpeed(p) * bonusDoPico(s).attack);
}

/** Posição do violoncelo (ponto central do arco) para o desenho. */
export function posicaoDoVioloncelo(p: Player, s: ThaisaState): { x: number; y: number } {
  const d = 14;
  return { x: p.x + Math.cos(s.aim) * d, y: p.y - 8 + Math.sin(s.aim) * d };
}

function golpePesado(world: World, p: Player, s: ThaisaState, angle: number): void {
  const reach = alcanceDoGolpe(s);
  const half = aberturaDoGolpe(s) / 2;
  // Repeteco: o 4º golpe de cada rodada bate bem mais forte.
  const repeteco = s.mods.repeteco && (s.swings + 1) % 4 === 0 ? 1.8 : 1;
  const damage = GOLPE_DAMAGE * p.damageMul * bonusDoPico(s).damage * repeteco;
  const oy = p.y - 8;
  const aliado = s.mods.arcoColetivo ? aliadosPerto(world, p, ARCO_COLETIVO_RANGE)[0] : undefined;
  let acertou = false;

  for (const e of world.enemies.active) {
    if (!e.alive) continue;
    const dx = e.x - p.x;
    const dy = e.y - oy;
    const dist = Math.hypot(dx, dy);
    if (dist > reach + e.def.radius) continue;
    if (Math.abs(wrapAngle(Math.atan2(dy, dx) - angle)) > half && dist > e.def.radius + 6) continue;
    // Empurra para longe da Thaisa, no plano do chão (pelos pés, não pelo peito).
    // Arremessado contra parede ou outro inimigo, causa dano de colisão.
    let gx = e.x - p.x;
    let gy = e.y - p.y;
    // Arco Coletivo: empurra o inimigo na direção de um aliado, em vez de para longe.
    if (aliado) {
      gx = aliado.x - e.x;
      gy = aliado.y - e.y;
    }
    const gd = Math.hypot(gx, gy) || 1;
    knockEnemy(e, gx / gd, gy / gd, KNOCKBACK_SPEED, p.slot);
    if (s.mods.colher) e.slow = Math.max(e.slow, 2);
    damageEnemy(world, e, damage, p);
    acertou = true;
  }
  // Arco Coletivo: o aliado ganha +15% de dano (próximos ataques).
  if (aliado && acertou) addBuff(aliado, { id: `arcoColetivo${p.slot}`, left: ARCO_COLETIVO_S, damage: ARCO_COLETIVO_DAMAGE });

  // O arco fica visível: é a hitbox real do violoncelo, separada do corpo da Thaisa.
  spawnEffect(world, {
    kind: 'arc',
    x: p.x,
    y: oy,
    radius: reach,
    angle,
    halfArc: half,
    life: GOLPE_VISIBLE_S,
    color: '#e6c24a',
    sprite: 'thaisaArco',
  });
  s.aim = angle;
  s.swingLeft = GOLPE_VISIBLE_S;
  if (s.mods.fortaleza) s.blockLeft = FORTALEZA_BLOCK_S;
  if (s.mods.peFirme) s.knockImmuneLeft = PE_FIRME_S;

  // Pancada Sísmica Fortissimo: a cada 3 golpes, uma onda grave percorre o chão.
  s.swings++;
  if (s.mods.sismica && s.swings % SISMICA_EVERY_SWINGS === 0) {
    spawnProjectile(world, {
      kind: 'onda',
      x: p.x,
      y: oy + 6,
      angle,
      speed: ONDA_SPEED,
      damage: damage * ONDA_DAMAGE_MUL,
      radius: ONDA_RADIUS,
      life: ONDA_LIFETIME_S,
      pierce: 99,
      knock: ONDA_KNOCK_SPEED,
      markOnHit: s.mods.grave,
      ownerSlot: p.slot,
    });
  }
}

export function updateThaisa(world: World, p: Player): void {
  const s = p.kit;
  if (!s || s.type !== 'thaisa') return;
  const dt = STEP_S;

  if (s.cd > 0) s.cd -= dt;
  if (s.swingLeft > 0) s.swingLeft -= dt;
  if (s.blockLeft > 0) s.blockLeft -= dt;
  if (s.knockImmuneLeft > 0) s.knockImmuneLeft -= dt;

  // Pico de Glicose: cada acúmulo some depois de 4 s sem comer.
  for (let i = s.stacks.length - 1; i >= 0; i--) {
    s.stacks[i]! -= dt;
    if (s.stacks[i]! <= 0) s.stacks.splice(i, 1);
  }

  // Costela no Bafo: com 3 ou mais acúmulos de Pico, leva 20% menos dano.
  if (s.mods.costela && s.stacks.length >= 3) p.damageTakenMul *= 0.8;

  // Muro Humano: aliados a até 3 tiles recebem 15% de redução de dano.
  if (s.mods.muro) {
    for (const a of aliadosPerto(world, p, MURO_RADIUS)) addBuff(a, { id: `muro${p.slot}`, left: 0.2, reduction: MURO_REDUCTION });
  }

  // Roda de Mate: a cada 10 s, a Thaisa ganha 1 Pico e aliados próximos ganham velocidade de ataque.
  if (s.mods.roda) {
    s.rodaCd -= dt;
    const roda = aliadosPerto(world, p, RODA_RADIUS);
    if (s.rodaCd <= 0 && roda.length > 0) {
      s.rodaCd = RODA_EVERY_S;
      darPico(s, 1);
      for (const a of roda) addBuff(a, { id: `roda${p.slot}`, left: RODA_S, attack: RODA_ATTACK });
      spawnEffect(world, { kind: 'text', x: p.x, y: p.y - 30, life: 1, color: '#9be08a', text: 'Roda de Mate!' });
      spawnEffect(world, { kind: 'ring', x: p.x, y: p.y - 8, radius: RODA_RADIUS, life: 0.8, color: '#9be08a', sprite: 'roda_mate' });
    }
  }

  // Rodízio Livre: com escudo, uma aura de choque pulsa ao redor.
  if (s.mods.rodizio && p.shield > 0) {
    s.pulseCd -= dt;
    if (s.pulseCd <= 0) {
      s.pulseCd = RODIZIO_PULSE_EVERY_S;
      damageArea(world, p.x, p.y - 8, RODIZIO_PULSE_RADIUS, RODIZIO_PULSE_DAMAGE * p.damageMul, p);
      spawnEffect(world, { kind: 'ring', x: p.x, y: p.y - 8, radius: RODIZIO_PULSE_RADIUS, life: 0.35, color: '#ffe08a', sprite: 'rodizio_pulso' });
    }
  }

  // Golpe automático no inimigo mais próximo dentro do alcance do arco.
  if (s.cd > 0) return;
  const target = nearestEnemy(world, p, alcanceDoGolpe(s) + 8);
  if (!target) return;
  // O golpe é no plano do chão: mira pelos pés (a onda grave também corre pelo chão).
  golpePesado(world, p, s, Math.atan2(target.y - p.y, target.x - p.x));
  s.cd = recargaDoGolpe(p, s);
}

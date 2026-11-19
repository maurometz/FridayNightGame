// Veículos temporários: aparecem perto do dono, ele monta ao encostar, ganha velocidade + buff + atropelamento.

import { focoMax } from '../characters/kitHooks';
import {
  CARROCA_HEAL_PER_S,
  CARROCA_HEAL_RADIUS,
  VEHICLES,
  VEHICLE_EVERY_S,
  VEHICLE_HIT_EVERY_S,
  VEHICLE_OF,
  VEHICLE_PICKUP_LIFE_S,
  VEHICLE_PICKUP_RADIUS,
} from '../data/vehicles';
import { STEP_S } from '../data/balance';
import type { World } from '../engine/world';
import type { Player } from '../entities/player';
import { spawnEffect } from './effects';
import { damageEnemy, knockEnemy } from './enemies';
import { healPlayer } from './playerStats';
import { addBuff } from './teamEffects';

/** Monta o veículo do personagem. `duracao` só muda em testes. */
export function montar(world: World, p: Player, duracao?: number): void {
  const def = VEHICLES[VEHICLE_OF[p.characterId]];
  p.vehicle = { id: def.id, left: duracao ?? def.durationS, hitCd: 0 };
  spawnEffect(world, { kind: 'text', x: p.x, y: p.y - 36, life: 1.4, color: '#ffffff', text: def.name });
  spawnEffect(world, { kind: 'ring', x: p.x, y: p.y - 8, radius: 28, life: 0.35, color: '#ffe066' });
}

function descer(world: World, p: Player): void {
  p.vehicle = null;
  p.vehicleNextIn = VEHICLE_EVERY_S;
  spawnEffect(world, { kind: 'ring', x: p.x, y: p.y - 8, radius: 20, life: 0.3, color: '#cccccc' });
}

/** Desvio fixo (sem usar o RNG da simulação) para o veículo não nascer sempre no mesmo lugar. */
function desvio(world: World, slot: number): { x: number; y: number } {
  const h = Math.imul(world.tick + 1, 2654435761) ^ Math.imul(slot + 7, 40503);
  const ang = ((h >>> 0) % 360) * (Math.PI / 180);
  const dist = 50 + ((h >>> 9) % 30);
  return { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist };
}

export function updateVehicles(world: World): void {
  const lista = world.vehiclePickups;
  for (let i = lista.length - 1; i >= 0; i--) {
    const v = lista[i]!;
    v.left -= STEP_S;
    const dono = world.players[v.slot];
    if (!dono || dono.hp <= 0 || v.left <= 0) {
      lista.splice(i, 1);
      continue;
    }
    if (!dono.vehicle && Math.hypot(dono.x - v.x, dono.y - v.y) <= VEHICLE_PICKUP_RADIUS) {
      lista.splice(i, 1);
      montar(world, dono);
    }
  }

  for (const p of world.players) {
    if (p.hp <= 0) {
      if (p.vehicle) p.vehicle = null;
      continue;
    }
    const mount = p.vehicle;
    if (!mount) {
      // Novo veículo no chão, perto do dono, de tempos em tempos.
      p.vehicleNextIn -= STEP_S;
      if (p.vehicleNextIn <= 0 && !lista.some((v) => v.slot === p.slot)) {
        const d = desvio(world, p.slot);
        lista.push({ slot: p.slot, id: VEHICLE_OF[p.characterId], x: p.x + d.x, y: p.y + d.y, left: VEHICLE_PICKUP_LIFE_S });
        p.vehicleNextIn = VEHICLE_EVERY_S;
      }
      continue;
    }

    const def = VEHICLES[mount.id];
    mount.left -= STEP_S;
    if (mount.left <= 0) {
      descer(world, p);
      continue;
    }
    // Buff rápido do veículo (renovado a cada passo; o sistema de buffs aplica os multiplicadores).
    addBuff(p, { id: 'veiculo', left: 0.2, ...def.buff });

    // Atropelamento: fere e empurra quem estiver no caminho.
    mount.hitCd -= STEP_S;
    if (p.moving && mount.hitCd <= 0) {
      mount.hitCd = VEHICLE_HIT_EVERY_S;
      for (const e of world.enemies.active) {
        if (!e.alive) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d > def.hitRadius + e.def.radius) continue;
        knockEnemy(e, d > 0 ? dx / d : 1, d > 0 ? dy / d : 0, def.knock, p.slot);
        damageEnemy(world, e, def.hit * p.damageMul, p);
      }
    }

    // Extras de cada veículo.
    if (mount.id === 'carroca') {
      for (const a of world.players) {
        if (a.hp > 0 && Math.hypot(a.x - p.x, a.y - p.y) <= CARROCA_HEAL_RADIUS) healPlayer(a, CARROCA_HEAL_PER_S * STEP_S);
      }
    } else if (mount.id === 'armadura' && p.kit?.type === 'mauro') {
      p.kit.foco = focoMax(p.kit);
    }
  }
}

// Safe Rooms (LORE seção 5): uma zona circular por mapa, sem combate e sem spawn. Dentro dela ninguém leva
// dano, os inimigos não entram e o grupo se recupera aos poucos. As conversas exclusivas vivem em data/safeRooms.ts.

import { STEP_S } from '../data/balance';
import { SAFE_ROOMS, SAFE_ROOM_POS, SAFE_ROOM_REGEN_PER_S, type SafeRoomPos } from '../data/safeRooms';
import type { World } from '../engine/world';
import type { Player } from '../entities/player';
import { pushMessage } from './messages';

/** A zona segura da fase atual (a Arena do Tempo não tem). */
export function zonaSegura(world: World): (SafeRoomPos & { name: string; id: string }) | null {
  if (world.act > 6) return null;
  const sala = SAFE_ROOMS.find((s) => s.fase === world.act + 1);
  if (!sala) return null;
  return { ...SAFE_ROOM_POS[sala.id], name: sala.name, id: sala.id };
}

export function dentroDaZona(world: World, x: number, y: number, folga = 0): boolean {
  const z = zonaSegura(world);
  return !!z && Math.hypot(x - z.x, y - z.y) < z.r + folga;
}

/** Cura quem está na zona e avisa na primeira vez que alguém entra. */
export function updateSafeRoom(world: World): void {
  const z = zonaSegura(world);
  if (!z) return;
  for (const p of world.players) {
    if (p.hp <= 0 || !dentroDaZona(world, p.x, p.y)) continue;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * SAFE_ROOM_REGEN_PER_S * STEP_S);
    if (!world.safeSeen.includes(z.id)) {
      world.safeSeen.push(z.id);
      pushMessage(world, '', `Safe Room: ${z.name}`, 3.5);
    }
  }
}

/** Empurra um ponto para fora da zona (inimigos e projéteis não entram). Devolve o ponto corrigido. */
export function expulsarDaZona(world: World, x: number, y: number, raio: number): { x: number; y: number; hit: boolean } {
  const z = zonaSegura(world);
  if (!z) return { x, y, hit: false };
  const dx = x - z.x;
  const dy = y - z.y;
  const d = Math.hypot(dx, dy);
  const limite = z.r + raio;
  if (d >= limite) return { x, y, hit: false };
  const nx = d > 0.001 ? dx / d : 1;
  const ny = d > 0.001 ? dy / d : 0;
  return { x: z.x + nx * limite, y: z.y + ny * limite, hit: true };
}

export function jogadorProtegido(world: World, p: Player): boolean {
  return dentroDaZona(world, p.x, p.y);
}

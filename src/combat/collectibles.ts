// Colecionáveis da Galeria do Mauro (LORE seção 13): sem impacto mecânico, difíceis de achar, não aparecem
// em todos os mapas e nunca dá para pegar todos em uma única partida.

import { MAX_COLLECTIBLES_PER_PHASE, MAX_COLLECTIBLES_PER_RUN, COLLECTIBLES, collectiblesDaFase } from '../data/gallery';
import { dentroDaZona } from './safeRoom';
import type { World } from '../engine/world';
import { pushMessage } from './messages';

const PICKUP_PX = 14;

/** Sorteia os colecionáveis da fase atual e os espalha pelo mapa. Chamado ao entrar numa fase. */
export function sortearColecionaveis(world: World): void {
  world.floorCollectibles = [];
  if (world.stress > 0 || world.noBosses || world.act > 6) return;
  const candidatos = collectiblesDaFase(world.act + 1).filter((c) => !world.collected.includes(c.id));
  let achados = world.collected.length;
  for (const c of candidatos) {
    if (world.floorCollectibles.length >= MAX_COLLECTIBLES_PER_PHASE) break;
    if (achados + world.floorCollectibles.length >= MAX_COLLECTIBLES_PER_RUN) break;
    if (world.rng.next() >= c.spawnChance * 2.5) continue; // 2,5x: cada item aparece em alguns mapas, não em todos
    for (let tent = 0; tent < 8; tent++) {
      const a = world.rng.next() * Math.PI * 2;
      const d = 90 + world.rng.next() * 150;
      const x = Math.cos(a) * d;
      const y = Math.sin(a) * d;
      if (dentroDaZona(world, x, y, 10)) continue;
      if (world.walls.some((w) => x > w.x - 8 && x < w.x + w.w + 8 && y > w.y - 8 && y < w.y + w.h + 8)) continue;
      world.floorCollectibles.push({ id: c.id, x, y });
      break;
    }
  }
}

/** Quem encostar no colecionável o pega. */
export function updateCollectibles(world: World): void {
  if (world.floorCollectibles.length === 0) return;
  for (let i = world.floorCollectibles.length - 1; i >= 0; i--) {
    const c = world.floorCollectibles[i]!;
    const p = world.players.find((q) => q.hp > 0 && Math.hypot(q.x - c.x, q.y - c.y) < PICKUP_PX);
    if (!p) continue;
    world.floorCollectibles.splice(i, 1);
    if (!world.collected.includes(c.id)) world.collected.push(c.id);
    const def = COLLECTIBLES.find((x) => x.id === c.id);
    pushMessage(world, '', `Galeria do Mauro: ${def?.name ?? c.id}`, 3.5);
  }
}

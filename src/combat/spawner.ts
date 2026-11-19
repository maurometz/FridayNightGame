import {
  COOP_SCALE_PER_EXTRA_PLAYER,
  MAX_ENEMIES,
  SPAWN_RING_PX,
  SPAWN_WARMUP_MIN,
  SPAWN_WARMUP_S,
  STEP_S,
} from '../data/balance';
import { tuningDaFase } from '../data/acts';
import { PHASE_ENEMIES, type EnemyDef } from '../data/enemies';
import type { Player } from '../entities/player';
import { dentroDaZona } from './safeRoom';
import type { World } from '../engine/world';

/** Fator de escala por número de jogadores vivos na partida (decisão de design: +50% por jogador extra). */
export function playerScale(playerCount: number): number {
  return 1 + COOP_SCALE_PER_EXTRA_PLAYER * Math.max(0, playerCount - 1);
}

/**
 * Inimigos por segundo na fase `fase` (0 a 7), `elapsedS` segundos depois do início dela. Cresce linearmente
 * dentro da fase e sobe um degrau a cada fase nova (PHASE_TUNING em data/acts.ts).
 */
export function spawnRate(fase: number, elapsedS: number, playerCount: number): number {
  const t = tuningDaFase(fase);
  return (t.spawnBase + t.spawnRamp * Math.max(0, elapsedS)) * playerScale(playerCount);
}

/** Fator de aquecimento do spawn nos primeiros segundos de uma fase (dá tempo de pegar a primeira carta). */
export function aquecimento(elapsedS: number): number {
  return Math.min(1, SPAWN_WARMUP_MIN + (1 - SPAWN_WARMUP_MIN) * Math.max(0, elapsedS) / SPAWN_WARMUP_S);
}

function pickDef(world: World): EnemyDef {
  const lista = PHASE_ENEMIES[world.act] ?? PHASE_ENEMIES[0]!;
  let total = 0;
  for (const d of lista) total += d.weight;
  let roll = world.rng.next() * total;
  for (const d of lista) {
    roll -= d.weight;
    if (roll < 0) return d;
  }
  return lista[0]!;
}

export function spawnEnemy(world: World, def: EnemyDef, x: number, y: number): boolean {
  const e = world.enemies.acquire();
  if (!e) return false;
  e.uid = world.nextUid++;
  e.def = def;
  e.x = x;
  e.y = y;
  // Vida: escala com o número de jogadores e, nos inimigos comuns, com a fase. Chefes só com os jogadores.
  const atoMul = def.boss ? 1 : tuningDaFase(world.act).hpMul;
  e.hp = def.hp * playerScale(world.players.length) * atoMul;
  e.alive = true;
  e.hitFlash = 0;
  e.stun = 0;
  e.marked = false;
  e.spot = 0;
  e.spotUsed = false;
  e.blind = 0;
  e.kx = 0;
  e.ky = 0;
  e.kbOwner = -1;
  e.collideCd = 0;
  e.slow = 0;
  e.focusLeft = 0;
  e.focusOwner = -1;
  e.passeLeft = 0;
  e.passeOwner = -1;
  // Comportamento: começa livre, com a primeira recarga espalhada para o bando não atacar todo junto.
  e.aiState = 0;
  e.aiT = 0;
  e.aiCd = 1 + (e.uid % 7) * 0.25;
  e.aiDir = 0;
  e.aiX = 0;
  e.aiY = 0;
  e.homeX = x;
  e.homeY = y;
  e.flee = 0;
  e.untargetable = false;
  e.aiCount = 0;
  e.leader = 0;
  e.resist = 0;
  e.aiT2 = 0;
  e.aiW = 0;
  // Nasce olhando para o jogador mais próximo.
  let best: Player | null = null;
  let bestD2 = Infinity;
  for (const p of world.players) {
    if (p.hp <= 0) continue;
    const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = p;
    }
  }
  e.facing = best ? Math.atan2(best.y - y, best.x - x) : 0;
  return true;
}

/**
 * Spawna um tipo (ou bando) num ponto ao redor de um jogador vivo. Inimigos comuns nascem fora da tela;
 * os territoriais nascem na borda da tela, para a área deles ficar visível.
 */
function spawnAtRing(world: World): void {
  const alive: Player[] = world.players.filter((p) => p.hp > 0);
  const anchor = alive[world.rng.int(0, alive.length - 1)];
  if (!anchor) return;
  const def = pickDef(world);
  const angle = world.rng.next() * Math.PI * 2;
  const dist = def.territorial ? 140 + world.rng.next() * 80 : SPAWN_RING_PX;
  const cx = anchor.x + Math.cos(angle) * dist;
  const cy = anchor.y + Math.sin(angle) * dist;
  if (dentroDaZona(world, cx, cy, 20)) return; // a Safe Room não tem spawn
  for (let i = 0; i < def.groupSize; i++) {
    const jx = def.groupSize > 1 ? (world.rng.next() - 0.5) * 24 : 0;
    const jy = def.groupSize > 1 ? (world.rng.next() - 0.5) * 24 : 0;
    if (!spawnEnemy(world, def, cx + jx, cy + jy)) return;
  }
}

export function updateSpawner(world: World): void {
  const enemies = world.enemies;

  if (world.stress > 0) {
    // Teste de carga: repõe até o alvo, no máximo 30 por passo para não travar um quadro só.
    let budget = 30;
    while (enemies.size < Math.min(world.stress, MAX_ENEMIES) && budget-- > 0) spawnAtRing(world);
    return;
  }

  // Com o chefe em campo, os inimigos comuns param de nascer. Na Arena do Tempo (fase 8) nunca nascem:
  // lá só existem o Tempo e as mecânicas dele.
  if (world.noSpawn || world.bossFight || world.act >= 7) return;

  if (enemies.size >= MAX_ENEMIES) {
    world.spawnAcc = 0;
    return;
  }
  const elapsed = (world.tick - world.phaseStartTick) * STEP_S;
  world.spawnAcc += spawnRate(world.act, elapsed, world.players.length) * aquecimento(elapsed) * STEP_S;
  while (world.spawnAcc >= 1) {
    world.spawnAcc -= 1;
    spawnAtRing(world);
  }
}

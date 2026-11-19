import { showDamage } from './damageNumbers';
import { onKillHook, onPlayerHit } from '../characters/kitHooks';
import { afterDamagePerks, critMultiplier, onKillPerks, perkDamageMul } from './perks';
import {
  AFINACAO_PESADA_MUL,
  COLLISION_COOLDOWN_S,
  COLLISION_DAMAGE,
  KNOCKBACK_MIN_SPEED,
  KNOCKBACK_SPEED,
  KNOCKBACK_FRICTION,
  THROWN_SPEED,
  WALL_DAMAGE,
} from '../data/thaisa';
import { MARK_DAMAGE_BONUS } from '../data/mauro';
import { maybeDropFood } from './foods';
import { onEnemyKilled } from './thayssaAura';
import { clamp, inBackArc } from '../engine/math';
import { QUEM_CANTA_BONUS } from '../data/team';
import { hitPlayer, onGroupSpotHit } from './teamEffects';
import { MAX_ENEMY_RADIUS, PLAYER_INVULN_S, PLAYER_RADIUS, STEP_S } from '../data/balance';
import type { Enemy } from '../entities/enemy';
import type { Player } from '../entities/player';
import type { World } from '../engine/world';
import { spawnGem } from './gems';
import { grantXp } from './leveling';
import { onDamageDealt, onKillSynergy } from '../synergy/charge';
import { registrarDano } from '../data/stats';
import { moverInimigo, onEnemyDeathEffect, resolverParedes } from './enemyAI';
import { updateBoss } from './bosses';
import { danoNoCachorro, estaExausto } from './salsichas';
import { onBossKilled } from './run';

/** Força da separação entre inimigos sobrepostos (fração da sobreposição por passo). */
const SEPARATION = 0.25;

/** Inimigo lento anda a esta fração da velocidade normal. */
const SLOW_FACTOR = 0.5;

function nearestLivingPlayer(world: World, x: number, y: number): Player | null {
  let best: Player | null = null;
  let bestD2 = Infinity;
  for (const p of world.players) {
    if (p.hp <= 0) continue;
    const dx = p.x - x;
    const dy = p.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = p;
    }
  }
  return best;
}

/**
 * Clone que provoca este inimigo (Sobremesa Espectral): o mais próximo dentro do raio de provocação.
 * O inimigo vai atrás dele em vez do jogador. Devolve um "alvo" com a posição do clone.
 */
function perseguidoPor(world: World, e: Enemy): Player | null {
  let melhor: { x: number; y: number; t: number } | null = null;
  let d = Infinity;
  for (const c of world.decoys) {
    const dd = (c.x - e.x) ** 2 + (c.y - e.y) ** 2;
    if (dd <= c.t * c.t && dd < d) {
      d = dd;
      melhor = c;
    }
  }
  // Só a posição importa para o comportamento de perseguição.
  return melhor as unknown as Player | null;
}

/** Move os inimigos, separa sobrepostos e aplica dano de contato. Reconstrói o hash. */
export function updateEnemies(world: World): void {
  const list = world.enemies.active;
  const hash = world.hash;
  hash.clear();
  for (const e of list) hash.insert(e);

  for (const e of list) {
    // Chefes não são atordoados, desorientados nem empurrados.
    if (e.def.boss) {
      e.stun = 0;
      e.blind = 0;
      e.kx = 0;
      e.ky = 0;
    }
    if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - STEP_S);
    if (e.spot > 0) e.spot = Math.max(0, e.spot - STEP_S); // o Holofote expira mesmo com o inimigo atordoado
    if (e.collideCd > 0) e.collideCd -= STEP_S;
    if (e.slow > 0) e.slow = Math.max(0, e.slow - STEP_S);
    if (e.focusLeft > 0) e.focusLeft -= STEP_S;
    if (e.passeLeft > 0) e.passeLeft -= STEP_S;

    // Empurrão: vale mesmo atordoado. Inimigo arremessado perde o controle e causa dano de colisão.
    const thrown = applyKnockback(world, e);

    if (e.stun > 0) {
      // Atordoado: não anda nem causa dano, mas ainda pode ser arremessado contra outros.
      e.stun = Math.max(0, e.stun - STEP_S);
      if (thrown && e.collideCd <= 0) {
        for (const n of hash.query(e.x, e.y, e.def.radius + MAX_ENEMY_RADIUS, world.scratch)) {
          if (n === e || !n.alive) continue;
          if (Math.hypot(e.x - n.x, e.y - n.y) < e.def.radius + n.def.radius) {
            collideEnemies(world, e, n);
            break;
          }
        }
      }
      continue;
    }

    const target = nearestLivingPlayer(world, e.x, e.y);
    if (!target) continue;

    // Câmera lenta (Pausa Dramática) e lentidão de zonas.
    const vel = e.def.speed * (e.slow > 0 ? SLOW_FACTOR : 1) * world.enemySpeedMul;
    const blind = e.blind > 0;
    if (blind) {
      // Desorientado (Flash de Fancam): vaga sem rumo, mais devagar.
      e.blind = Math.max(0, e.blind - STEP_S);
      e.facing += (world.rng.next() - 0.5) * 0.6;
      e.x += Math.cos(e.facing) * vel * 0.6 * STEP_S;
      e.y += Math.sin(e.facing) * vel * 0.6 * STEP_S;
    } else if (!thrown) {
      // Cada tipo de inimigo se comporta do seu jeito (enemyAI.ts); os chefes, em bosses.ts.
      // Quem anda para onde olha e gira devagar pode ser flanqueado (Holofote da Melissa).
      if (e.def.behavior === 'boss') updateBoss(world, e, target, vel);
      else moverInimigo(world, e, perseguidoPor(world, e) ?? target, vel);
    }
    if (!thrown) resolverParedes(world, e);

    // Separação: empurra para longe de vizinhos sobrepostos (usa o hash do início do passo).
    // O motoboy investindo atravessa os outros, e os chefes não são empurrados.
    const atravessa = e.def.behavior === 'investida-molho' && e.aiState === 2;
    const near = e.def.boss || atravessa ? [] : hash.query(e.x, e.y, e.def.radius + MAX_ENEMY_RADIUS, world.scratch);
    for (const n of near) {
      if (n === e) continue;
      const ox = e.x - n.x;
      const oy = e.y - n.y;
      const d = Math.hypot(ox, oy);
      const min = e.def.radius + n.def.radius;
      if (d >= min) continue;
      if (thrown && e.collideCd <= 0 && n.alive) collideEnemies(world, e, n);
      if (d < 0.001) {
        // Exatamente no mesmo ponto: separa em direções determinísticas pelo uid.
        e.x += e.uid % 2 === 0 ? 0.5 : -0.5;
        e.y += e.uid % 3 === 0 ? 0.5 : -0.5;
        continue;
      }
      const push = (min - d) * SEPARATION;
      e.x += (ox / d) * push;
      e.y += (oy / d) * push;
    }

    // Dano de contato. Não vale para o coelho sumido.
    const inofensivo = e.untargetable || estaExausto(e);
    if (world.stress === 0 && !blind && !thrown && !inofensivo && target.invuln <= 0) {
      const tdx = target.x - e.x;
      const tdy = target.y - e.y;
      const reach = e.def.radius + PLAYER_RADIUS;
      if (tdx * tdx + tdy * tdy < reach * reach) {
        hitPlayer(world, target, e.def.damage);
        target.invuln = PLAYER_INVULN_S;
        onPlayerHit(target);
      }
    }
  }
}

/** Dá um empurrão (px/s) ao inimigo, na direção (dx, dy) já normalizada. */
export function knockEnemy(e: Enemy, dx: number, dy: number, speed: number, ownerSlot: number): void {
  if (e.def.boss) return;
  e.kx += dx * speed;
  e.ky += dy * speed;
  e.kbOwner = ownerSlot;
}

/** Fator de dano de colisão conforme a velocidade do arremesso (0,5 a 1). */
function impactFactor(e: Enemy): number {
  return clamp(Math.hypot(e.kx, e.ky) / KNOCKBACK_SPEED, 0.5, 1);
}

/** Arremessado contra outro inimigo: ambos sofrem dano de colisão, e parte do impulso passa adiante. */
function collideEnemies(world: World, e: Enemy, n: Enemy): void {
  const killer = world.players[e.kbOwner];
  const dmg = COLLISION_DAMAGE * impactFactor(e);
  e.collideCd = COLLISION_COOLDOWN_S;
  n.kx += e.kx * 0.5;
  n.ky += e.ky * 0.5;
  n.kbOwner = e.kbOwner;
  e.kx *= 0.4;
  e.ky *= 0.4;
  damageEnemy(world, e, dmg, killer);
  damageEnemy(world, n, dmg, killer);
}

/** Dano de colisão contra paredes. Afinação Pesada (Thaisa) aumenta em 50%. */
function wallDamageMul(killer: Player | undefined): number {
  const k = killer?.kit;
  return k?.type === 'thaisa' && k.mods.afinacaoPesada ? AFINACAO_PESADA_MUL : 1;
}

/**
 * Aplica o empurrão do passo. Devolve true se o inimigo está arremessado (rápido demais para se controlar).
 * Arremessado contra uma parede, sofre dano de colisão e para.
 */
function applyKnockback(world: World, e: Enemy): boolean {
  const speed = Math.hypot(e.kx, e.ky);
  if (speed < KNOCKBACK_MIN_SPEED) {
    e.kx = 0;
    e.ky = 0;
    return false;
  }
  const thrown = speed >= THROWN_SPEED;
  e.x += e.kx * STEP_S;
  e.y += e.ky * STEP_S;

  if (thrown) {
    for (const w of world.walls) {
      // Círculo contra retângulo.
      const cx = clamp(e.x, w.x, w.x + w.w);
      const cy = clamp(e.y, w.y, w.y + w.h);
      const dx = e.x - cx;
      const dy = e.y - cy;
      const r = e.def.radius;
      if (dx * dx + dy * dy >= r * r) continue;
      const killer = world.players[e.kbOwner];
      damageEnemy(world, e, WALL_DAMAGE * impactFactor(e) * wallDamageMul(killer), killer);
      // Empurra para fora da parede e para o inimigo.
      const dist = Math.hypot(dx, dy);
      if (dist > 0.001) {
        e.x = cx + (dx / dist) * r;
        e.y = cy + (dy / dist) * r;
      }
      e.kx = 0;
      e.ky = 0;
      return false;
    }
  }
  e.kx *= KNOCKBACK_FRICTION;
  e.ky *= KNOCKBACK_FRICTION;
  return thrown;
}

const NOME_INSTRUMENTO: Record<string, string> = { violao: 'Violão', bateria: 'Bateria', flauta: 'Flauta', kazoo: 'Kazoo' };

/** Rótulo da arma/habilidade do jogador, para a tela de estatísticas. */
export function fonteDoPersonagem(p: Player): string {
  const k = p.kit;
  switch (p.characterId) {
    case 'felipe':
      return `Felipe: ${k?.type === 'felipe' ? (NOME_INSTRUMENTO[k.active] ?? k.active) : 'instrumento'}`;
    case 'mauro':
      return 'Mauro: Notas de Rodapé';
    case 'melissa':
      return 'Melissa: Florete e Holofotes';
    case 'thaisa':
      return 'Thaisa: Violoncelo';
    default:
      return 'Thayssa: Aura e Microfone';
  }
}

/** Aplica dano a um inimigo e o mata se a vida acabar. */
export function damageEnemy(world: World, e: Enemy, amount: number, killer: Player | undefined): void {
  if (!e.alive || e.untargetable) return;
  // Corpos da matilha (Salsichas): o dano vai para a vida do líder, que é uma só.
  if (e.leader !== 0) {
    const lider = world.enemies.active.find((x) => x.uid === e.leader && x.alive);
    e.hitFlash = 0.08;
    danoNoCachorro(world, e, amount);
    if (lider) damageEnemy(world, lider, amount, killer);
    return;
  }
  if (e.def.id === 'salsichas') danoNoCachorro(world, e, amount);
  // Modo dev: multiplicador de dano.
  if (world.dev && world.dev.danoMul !== 1) amount *= world.dev.danoMul;
  // Resistência (o Tiago W aprende padrões repetidos).
  if (e.resist > 0) amount *= 1 - e.resist;
  // Crítico genérico (x2). Só sorteia se o jogador tem alguma chance, para não gastar RNG à toa.
  let critico = false;
  if (killer) {
    // Passe de Holofote (Melissa): aliados acertam este inimigo com crítico garantido.
    if (e.passeLeft > 0 && killer.slot !== e.passeOwner) {
      amount *= 2;
      critico = true;
    } else {
      const chance = killer.critChance + killer.auraCrit;
      if (chance > 0 && world.rng.next() < chance) {
        amount *= critMultiplier(killer);
        critico = true;
      }
    }
    // Poderes das cartas que dependem da situação (HP, chefe, distância).
    amount *= perkDamageMul(killer, e);
    // Quem Canta Junto (Felipe): aliados que atacam o mesmo inimigo causam +10% de dano.
    if (e.focusLeft > 0 && killer.slot !== e.focusOwner) amount *= 1 + QUEM_CANTA_BONUS;
    // Holofote da Melissa acertado pelas costas por um aliado conta para a Coreografia de Grupo.
    if (e.spot > 0 && killer.kit?.type !== 'melissa' && inBackArc(e.facing, e.x, e.y, killer.x, killer.y)) {
      e.spot = 0;
      onGroupSpotHit(world);
    }
  }
  // Marcado (Índice Remissivo): +10% de dano de qualquer fonte.
  const aplicado = e.marked ? amount * (1 + MARK_DAMAGE_BONUS) : amount;
  // Carrega as barras de sinergia com o dano de fato causado (não conta o excesso sobre a vida restante).
  const efetivo = Math.min(aplicado, Math.max(0, e.hp));
  onDamageDealt(world, killer, efetivo);
  registrarDano(world.stats, efetivo, world.statSource ?? (killer ? fonteDoPersonagem(killer) : 'Outros'), killer?.characterId);
  if (killer) afterDamagePerks(killer, efetivo);
  e.hp -= aplicado;
  e.hitFlash = 0.08;
  showDamage(world, e.x, e.y - e.def.radius - 6, aplicado, critico ? 'critico' : 'inimigo', e.uid);
  if (e.hp <= 0) killEnemy(world, e, killer);
}

/** Dano em área circular. Devolve quantos inimigos foram atingidos. `stun` em segundos (0 = nenhum). */
export function damageArea(
  world: World,
  x: number,
  y: number,
  radius: number,
  amount: number,
  killer: Player | undefined,
  stun = 0,
): number {
  let hits = 0;
  for (const e of world.enemies.active) {
    if (!e.alive) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const reach = radius + e.def.radius;
    if (dx * dx + dy * dy > reach * reach) continue;
    hits++;
    if (stun > 0) e.stun = Math.max(e.stun, stun);
    damageEnemy(world, e, amount, killer);
  }
  return hits;
}

/** Mata um inimigo: solta gema e conta o abate. Só marca como morto; a liberação é feita no fim do passo. */
export function killEnemy(world: World, e: Enemy, killer: Player | undefined): void {
  if (!e.alive) return;
  if (e.leader !== 0) {
    // Um corpo da matilha só cai com o líder.
    const lider = world.enemies.active.find((x) => x.uid === e.leader && x.alive);
    if (lider) killEnemy(world, lider, killer);
    return;
  }
  // O líder cai e leva os corpos junto (sem drops nem abates extras).
  if (e.def.id === 'salsichas') for (const f of world.enemies.active) if (f.leader === e.uid) f.alive = false;
  e.alive = false;
  if (killer) {
    killer.kills++;
    onKillHook(killer, world);
    onKillPerks(world, killer, e);
    onKillSynergy(world, killer);
  }
  world.stats.enemiesDefeated++;
  maybeDropFood(world, e.x, e.y);
  onEnemyKilled(world, e);
  onEnemyDeathEffect(world, e);
  if (e.def.boss) onBossKilled(world, e);
  if (!spawnGem(world, e.x, e.y, e.def.xp) && killer) {
    // Sem espaço para a gema: entrega o XP direto, para não perdê-lo.
    grantXp(world, killer, e.def.xp);
  }
}

/** Libera os inimigos mortos. Percorre de trás para frente por causa do swap-remove do Pool. */
export function sweepEnemies(world: World): void {
  const list = world.enemies.active;
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i]!;
    if (!e.alive) world.enemies.release(e);
  }
}

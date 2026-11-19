import {
  BIBLIO_KILLS_PER_CHARGE,
  BIBLIO_MAX_CHARGES,
  FREE_REROLL_EVERY_LEVELS,
  FOCO_MAX,
  REVISAO_FOCO,
  SALA_BONUS,
  SALA_STILL_S,
  EDICAO_FOCO_BONUS,
} from '../data/mauro';
import { BIBLIO_COLETIVA_CUT_S, BIBLIO_COLETIVA_RADIUS } from '../data/team';
import type { World } from '../engine/world';
import type { Enemy } from '../entities/enemy';
import type { Player } from '../entities/player';
import type { Projectile } from '../entities/projectile';
import type { MauroState } from './mauroState';

/**
 * Ganchos de evento dos kits. Fica separado para o combate poder chamar sem importar
 * a lógica completa de cada personagem (evita dependência circular).
 */
export function onKillHook(killer: Player, world?: World): void {
  const k = killer.kit;
  // Fã-Clube da Madrugada: a cada 20 abates, +3% de dano permanente (até 10 vezes).
  if (k?.type === 'felipe' && k.mods.fa && k.fanStacks < 10) {
    k.fanKills++;
    if (k.fanKills >= 20) {
      k.fanKills = 0;
      k.fanStacks++;
      killer.baseDamageMul *= 1.03;
    }
  }
  if (k?.type === 'felipe' && k.mods.roadie) {
    // Roadie de Madrugada: cada abate devolve 1 de munição ao instrumento ativo.
    k.ammo[k.active] = Math.min(k.maxAmmo[k.active], k.ammo[k.active] + 1);
  } else if (k?.type === 'mauro') {
    if (k.mods.biblio) {
      // Bibliografia Comentada: a cada 10 abates, +1 carga de salto.
      k.killsSinceCharge++;
      if (k.killsSinceCharge >= BIBLIO_KILLS_PER_CHARGE) {
        k.killsSinceCharge = 0;
        k.jumpCharges = Math.min(BIBLIO_MAX_CHARGES, k.jumpCharges + 1);
      }
    }
    // Bibliografia Compartilhada: abates do Mauro aceleram as recargas de aliados próximos.
    if (k.mods.biblioColetiva && world) {
      for (const a of world.players) {
        if (a === killer || a.hp <= 0) continue;
        if ((a.x - killer.x) ** 2 + (a.y - killer.y) ** 2 <= BIBLIO_COLETIVA_RADIUS ** 2) reduceCooldowns(a, BIBLIO_COLETIVA_CUT_S);
      }
    }
  }
}

/** Reduz em `seconds` as recargas do jogador (Risada Contagiante da Thayssa). */
export function reduceCooldowns(p: Player, seconds: number): void {
  const cut = (v: number): number => Math.max(0, v - seconds);
  const k = p.kit;
  p.weaponCd = cut(p.weaponCd);
  if (!k) return;
  switch (k.type) {
    case 'felipe':
      k.cd = cut(k.cd);
      k.ensaioCd = cut(k.ensaioCd);
      break;
    case 'mauro':
      k.cd = cut(k.cd);
      break;
    case 'melissa':
      k.cd = cut(k.cd);
      k.reacaoCd = cut(k.reacaoCd);
      k.dashCd = cut(k.dashCd);
      k.fancamCd = cut(k.fancamCd);
      break;
    case 'thaisa':
      k.cd = cut(k.cd);
      break;
    case 'thayssa':
      k.palmasCd = cut(k.palmasCd);
      break;
  }
}

/** O jogador levou dano: zera a Recordação Perfeita do Mauro. */
export function onPlayerHit(p: Player): void {
  if (p.kit?.type === 'mauro') p.kit.safeTime = 0;
  // Melissa: Reação Exagerada. O kit processa no próximo passo (precisa do mundo).
  else if (p.kit?.type === 'melissa') p.kit.reacaoPending = true;
}

/** O jogador subiu de nível. */
export function onLevelUp(p: Player, level: number): void {
  if (p.kit?.type === 'mauro' && level % FREE_REROLL_EVERY_LEVELS === 0) p.kit.freeRerolls++;
}

/** Um projétil do jogador acertou um inimigo. */
export function onProjectileHit(owner: Player | undefined, pr: Projectile, e: Enemy): void {
  const k = owner?.kit;
  if (k?.type !== 'mauro' || pr.kind !== 'runa') return;
  if (k.mods.indice) e.marked = true;
  if (k.mods.postit) e.slow = Math.max(e.slow, 1.5);
  if (k.mods.rodape) k.echoes.push({ x: e.x, y: e.y, t: 1, damage: pr.damage });
  if (k.mods.revisao && e.def.boss) k.foco = Math.min(focoMax(k), k.foco + REVISAO_FOCO);
}

export function focoMax(k: MauroState): number {
  return FOCO_MAX + (k.mods.edicao ? EDICAO_FOCO_BONUS : 0) + (k.mods.fichamento ? 25 : 0);
}

/** Multiplicador total de XP do jogador (inclui bônus temporários de cartas). */
export function xpMultiplier(p: Player): number {
  const k = p.kit;
  if (k?.type === 'mauro' && k.mods.sala && k.stillTime >= SALA_STILL_S) return p.xpMul * (1 + SALA_BONUS);
  return p.xpMul;
}

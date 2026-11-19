import { focoMax } from '../characters/kitHooks';
import { raioDaAura } from '../characters/thayssaState';
import { danoDaFase } from '../data/acts';
import {
  COBERTURA_COOLDOWN_S,
  COBERTURA_HP,
  COBERTURA_S,
  COBERTURA_SPEED,
  COREOGRAFIA_AREA,
  COREOGRAFIA_DAMAGE,
  COREOGRAFIA_EVERY,
  COREOGRAFIA_RADIUS,
  COREOGRAFIA_STUN_S,
  ESCUDO_AFETO_SHARE,
  RESUMO_FOCO_MUL,
  RESUMO_RADIUS,
  RESUMO_SHARE,
  RETAGUARDA_RADIUS,
  RETAGUARDA_S,
  RETAGUARDA_SHIELD,
  RETAGUARDA_SPEED,
} from '../data/team';
import type { Buff, Player } from '../entities/player';
import type { World } from '../engine/world';
import { damageArea } from './enemies';
import { spawnEffect } from './effects';
import { addShield, damagePlayer } from './playerStats';
import { afterHitPerks, beforeHitPerks } from './perks';

/** Adiciona um buff. Um buff com o mesmo id é renovado em vez de acumular. */
export function addBuff(p: Player, b: Buff): void {
  const i = p.buffs.findIndex((x) => x.id === b.id);
  if (i >= 0) p.buffs[i] = b;
  else p.buffs.push(b);
}

/** Aliados vivos (todos menos `p`) a até `radius` de `p`, do mais perto para o mais longe. */
export function aliadosPerto(world: World, p: Player, radius: number): Player[] {
  const r2 = radius * radius;
  return world.players
    .filter((a) => a !== p && a.hp > 0 && (a.x - p.x) ** 2 + (a.y - p.y) ** 2 <= r2)
    .sort((a, b) => (a.x - p.x) ** 2 + (a.y - p.y) ** 2 - ((b.x - p.x) ** 2 + (b.y - p.y) ** 2));
}

/**
 * Dano de contato num jogador, com os efeitos de equipe que reagem a ele:
 * Escudo de Afeto (Thayssa), Resumo Coletivo (Mauro), Retaguarda Gaúcha (Thaisa) e Cobertura do Encore (Melissa).
 */
import { jogadorProtegido } from './safeRoom';

export function hitPlayer(world: World, victim: Player, baseAmount: number): void {
  const rawAmount = baseAmount * danoDaFase(world.act);
  // Modo dev: invulnerável.
  if (world.dev?.invulneravel) return;
  // Safe Room: sem dano.
  if (jogadorProtegido(world, victim)) return;
  world.stats.totalDamageTaken += rawAmount * victim.damageTakenMul;
  // Gingado de Esquina: o golpe pode ser desviado por completo.
  if (!beforeHitPerks(world, victim)) return;
  let amount = rawAmount;

  // Escudo de Afeto: aliados no anel dividem 20% do dano recebido pela Thayssa.
  const vk = victim.kit;
  if (vk?.type === 'thayssa' && vk.mods.escudoAfeto) {
    const r = raioDaAura(vk);
    const noAnel = aliadosPerto(world, victim, r);
    if (noAnel.length > 0) {
      const share = amount * ESCUDO_AFETO_SHARE;
      amount -= share;
      for (const a of noAnel) damagePlayer(a, share / noAnel.length, world);
    }
  }

  // Resumo Coletivo: aliados que sofrem dano dividem 10% com o Mauro, que regenera Foco com isso.
  for (const m of world.players) {
    const k = m.kit;
    if (m === victim || m.hp <= 0 || k?.type !== 'mauro' || !k.mods.resumo) continue;
    if ((m.x - victim.x) ** 2 + (m.y - victim.y) ** 2 > RESUMO_RADIUS * RESUMO_RADIUS) continue;
    const share = amount * RESUMO_SHARE;
    amount -= share;
    damagePlayer(m, share, world);
    k.foco = Math.min(focoMax(k), k.foco + share * RESUMO_FOCO_MUL);
  }

  damagePlayer(victim, amount, world);
  afterHitPerks(world, victim);

  const fell = victim.hp <= 0;
  const low = !fell && victim.hp / victim.maxHp < COBERTURA_HP;
  for (const o of world.players) {
    const k = o.kit;
    if (o === victim || o.hp <= 0) continue;
    // Retaguarda Gaúcha: quando um aliado cai, a Thaisa ganha escudo e os aliados próximos ganham velocidade.
    if (fell && k?.type === 'thaisa' && k.mods.retaguarda) {
      addShield(o, o.maxHp * RETAGUARDA_SHIELD);
      for (const a of [o, ...aliadosPerto(world, o, RETAGUARDA_RADIUS)]) {
        addBuff(a, { id: 'retaguarda', left: RETAGUARDA_S, speed: RETAGUARDA_SPEED });
      }
      spawnEffect(world, { kind: 'text', x: o.x, y: o.y - 30, life: 1.2, color: '#ffe08a', text: 'Retaguarda!' });
    }
    // Cobertura do Encore: aliado com pouco HP dá velocidade à Melissa.
    if (low && k?.type === 'melissa' && k.mods.cobertura && k.coberturaCd <= 0) {
      k.coberturaCd = COBERTURA_COOLDOWN_S;
      addBuff(o, { id: 'cobertura', left: COBERTURA_S, speed: COBERTURA_SPEED });
    }
  }
}

/**
 * Um Holofote da Melissa foi acertado pelas costas (por ela ou por um aliado).
 * Coreografia de Grupo: a cada 3 Holofotes do grupo, Reação Exagerada no time.
 */
export function onGroupSpotHit(world: World): void {
  for (const m of world.players) {
    const k = m.kit;
    if (m.hp <= 0 || k?.type !== 'melissa' || !k.mods.coreografia) continue;
    k.groupHits++;
    if (k.groupHits % COREOGRAFIA_EVERY !== 0) continue;
    k.reacaoFree = true; // a própria Melissa
    for (const a of aliadosPerto(world, m, COREOGRAFIA_RADIUS)) {
      damageArea(world, a.x, a.y - 8, COREOGRAFIA_AREA, COREOGRAFIA_DAMAGE * m.damageMul, m, COREOGRAFIA_STUN_S);
      spawnEffect(world, { kind: 'ring', x: a.x, y: a.y - 8, radius: COREOGRAFIA_AREA, life: 0.35, color: '#ff4d8d' });
    }
  }
}

/**
 * Um jogador usou a Ultimate. Espelho de Emoção: a Thayssa troca de modo sem custo de transição.
 * As Ultimates de dupla entram na Fase 5, que deve chamar esta função ao ativá-las.
 */
export function onUltimateUsed(world: World, user: Player): void {
  for (const t of world.players) {
    const k = t.kit;
    if (t === user || t.hp <= 0 || k?.type !== 'thayssa' || !k.mods.espelho) continue;
    k.mode = k.mode === 'euforia' ? 'sobrecarga' : 'euforia';
    k.transitionLeft = 0;
    k.pulseCd = 0;
    k.pulseS = 0;
  }
}

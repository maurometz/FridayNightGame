import { damageArea, knockEnemy } from '../combat/enemies';
import { spawnEffect } from '../combat/effects';
import { healPlayer } from '../combat/playerStats';
import { jogadoresNoRaio } from '../combat/thayssaAura';
import { addBuff, aliadosPerto } from '../combat/teamEffects';
import { ABRACO_GRUPO_REGEN, CIRCULO_MIN_ALLIES, MAO_S, MAO_SPEED } from '../data/team';
import { STEP_S } from '../data/balance';
import {
  DANCA_DAMAGE,
  DANCA_RADIUS,
  DANCA_SWITCHES,
  DANCA_WINDOW_S,
  DROP_DAMAGE,
  DROP_RADIUS,
  MEGAFONE_ATTACK,
  MEGAFONE_BUFF_S,
  MEGAFONE_COOLDOWN_S,
  MEGAFONE_DAMAGE,
  MEGAFONE_HALF_ARC,
  MEGAFONE_KNOCK,
  MEGAFONE_RANGE,
  MEGAFONE_REACH,
  MEGAFONE_STUN_S,
  EUFORIA_BUFF,
  EUFORIA_PULSE_DAMAGE,
  EUFORIA_PULSE_EVERY_S,
  PALMAS_EVERY_S,
  PALMAS_KNOCK,
  PALMAS_RADIUS_MUL,
  PE_NO_CHAO_REGEN,
  RESSONANCIA_COOLDOWN_S,
  RESSONANCIA_DURATION_S,
  SINCRONIA_HEAL,
  SINCRONIA_RADIUS,
  SOBRECARGA_PULSE_DAMAGE,
  SOBRECARGA_PULSE_EVERY_S,
  SOBRECARGA_PULSE_KNOCK,
  SOBRECARGA_REDUCAO,
  SOBRECARGA_REGEN_PER_S,
  ULTIMO_COOLDOWN_S,
  ULTIMO_HP_FRACTION,
  ULTIMO_INVULN_S,
} from '../data/thayssa';
import { attackSpeed, type Player } from '../entities/player';
import { damageEnemy } from '../combat/enemies';
import { nearestEnemy } from '../combat/weapons';
import type { PlayerInput } from '../engine/input';
import type { World } from '../engine/world';
import { duracaoDaTransicao, modoAtivo, multiplicadorDeBuff, raioDaAura, type ThayssaState } from './thayssaState';

/** Cores dos modos: Euforia dourado/rosa, Sobrecarga violeta/azul. */
export const COR_EUFORIA = '#ffb86b';
export const COR_SOBRECARGA = '#8f7bff';

function trocarDeModo(world: World, p: Player, s: ThayssaState): void {
  s.mode = s.mode === 'euforia' ? 'sobrecarga' : 'euforia';
  s.transitionLeft = duracaoDaTransicao(s);
  // Os pulsos só recomeçam depois da transição.
  s.pulseCd = s.transitionLeft;
  s.pulseS = s.transitionLeft;
  const cor = s.mode === 'euforia' ? COR_EUFORIA : COR_SOBRECARGA;
  const oy = p.y - 8;

  // Dança dos Dois Modos: cinco trocas seguidas criam uma explosão.
  s.switchCount = s.sinceSwitch <= DANCA_WINDOW_S ? s.switchCount + 1 : 1;
  s.sinceSwitch = 0;

  // Playlist Compartilhada: trocar de modo dá velocidade de ataque a quem está na aura.
  if (s.mods.playlist) {
    for (const a of jogadoresNoRaio(world, p.x, p.y, raioDaAura(s))) addBuff(a, { id: `playlist${p.slot}`, left: 4, attack: 1.2 });
  }

  // Drop na Troca: alternar de modo libera uma explosão em área.
  if (s.mods.drop) {
    damageArea(world, p.x, oy, DROP_RADIUS, DROP_DAMAGE * p.damageMul, p);
    spawnEffect(world, { kind: 'ring', x: p.x, y: oy, radius: DROP_RADIUS, life: 0.4, color: cor, sprite: 'drop_troca' });
  }
  // Sincronia Oceânica: pulso que cura aliados a 5 tiles.
  if (s.mods.sincronia) {
    for (const a of jogadoresNoRaio(world, p.x, p.y, SINCRONIA_RADIUS)) healPlayer(a, SINCRONIA_HEAL);
    spawnEffect(world, { kind: 'ring', x: p.x, y: oy, radius: SINCRONIA_RADIUS, life: 0.6, color: '#7ad7ff', sprite: 'sincronia_oceanica' });
  }
  if (s.mods.danca && s.switchCount >= DANCA_SWITCHES) {
    s.switchCount = 0;
    damageArea(world, p.x, oy, DANCA_RADIUS, DANCA_DAMAGE * p.damageMul, p);
    spawnEffect(world, { kind: 'ring', x: p.x, y: oy, radius: DANCA_RADIUS, life: 0.6, color: '#ffffff', sprite: 'danca_dois_modos' });
    spawnEffect(world, { kind: 'text', x: p.x, y: p.y - 30, life: 1, color: '#ffffff', text: 'Dança dos Dois Modos!' });
  }
}

/** Aplica os buffs da aura aos aliados no anel (inclusive à própria Thayssa). */
function aplicarBuffs(world: World, p: Player, s: ThayssaState): void {
  const bm = multiplicadorDeBuff(s);
  const euforia = modoAtivo(s, 'euforia');
  const sobrecarga = modoAtivo(s, 'sobrecarga');
  if (!euforia && !sobrecarga) return;
  for (const a of jogadoresNoRaio(world, p.x, p.y, raioDaAura(s))) {
    if (euforia) {
      a.auraSpeedMul *= 1 + EUFORIA_BUFF * bm;
      a.auraAttackMul *= 1 + EUFORIA_BUFF * bm;
      if (s.mods.peNoChao) healPlayer(a, PE_NO_CHAO_REGEN * STEP_S);
      // Abraço em Grupo: aliados no anel recebem +1 HP/s na Euforia.
      if (s.mods.abracoGrupo && a !== p) healPlayer(a, ABRACO_GRUPO_REGEN * STEP_S);
    }
    if (sobrecarga) {
      a.damageTakenMul *= 1 - SOBRECARGA_REDUCAO * bm;
      healPlayer(a, SOBRECARGA_REGEN_PER_S * bm * STEP_S);
    }
  }
}

/** Pulsos de dano (Euforia) e de repulsão (Sobrecarga) ao redor da Thayssa. */
function pulsos(world: World, p: Player, s: ThayssaState): void {
  const dt = STEP_S;
  const radius = raioDaAura(s);
  const oy = p.y - 8;

  if (modoAtivo(s, 'euforia')) {
    s.pulseCd -= dt;
    if (s.pulseCd <= 0) {
      s.pulseCd = EUFORIA_PULSE_EVERY_S * (s.circuloAtivo ? 0.5 : 1);
      damageArea(world, p.x, oy, radius, EUFORIA_PULSE_DAMAGE * p.damageMul * (s.mods.coracao ? 1.5 : 1), p);
      // Lágrima Doce: o pulso também cura quem está na aura.
      if (s.mods.lagrima) for (const a of jogadoresNoRaio(world, p.x, p.y, radius)) healPlayer(a, 1.5);
      spawnEffect(world, { kind: 'ring', x: p.x, y: oy, radius, life: 0.25, color: COR_EUFORIA, sprite: 'thayssaEuforia' });
    }
  }
  if (modoAtivo(s, 'sobrecarga')) {
    s.pulseS -= dt;
    if (s.pulseS <= 0) {
      s.pulseS = SOBRECARGA_PULSE_EVERY_S * (s.circuloAtivo ? 0.5 : 1);
      repulsao(world, p, radius, SOBRECARGA_PULSE_KNOCK, SOBRECARGA_PULSE_DAMAGE * p.damageMul * (s.mods.coracao ? 1.5 : 1));
      spawnEffect(world, { kind: 'ring', x: p.x, y: oy, radius, life: 0.4, color: COR_SOBRECARGA, sprite: 'thayssaSobrecarga' });
    }
  }
}

/** Empurra para fora e causa dano leve em todos os inimigos no raio. */
function repulsao(world: World, p: Player, radius: number, knock: number, damage: number): void {
  for (const e of world.enemies.active) {
    if (!e.alive) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > radius + e.def.radius) continue;
    knockEnemy(e, d > 0 ? dx / d : 1, d > 0 ? dy / d : 0, knock, p.slot);
  }
  if (damage > 0) damageArea(world, p.x, p.y - 8, radius, damage, p);
}

/**
 * Megafone: a cada poucos segundos a Thayssa grita no inimigo mais proximo. O grito e um cone que fere e empurra.
 * Na Euforia anima quem esta na aura (ataque mais rapido); na Sobrecarga atordoa quem foi atingido.
 */
function megafone(world: World, p: Player, s: ThayssaState): void {
  if (s.megaCd > 0 || s.transitionLeft > 0) return;
  const alvo = nearestEnemy(world, p, MEGAFONE_RANGE);
  if (!alvo) return;
  const oy = p.y - 8;
  const angle = Math.atan2(alvo.y - oy, alvo.x - p.x);
  const euforia = modoAtivo(s, 'euforia');
  const sobrecarga = modoAtivo(s, 'sobrecarga');
  for (const e of world.enemies.active) {
    if (!e.alive) continue;
    const dx = e.x - p.x;
    const dy = e.y - oy;
    const dist = Math.hypot(dx, dy);
    if (dist > MEGAFONE_REACH + e.def.radius) continue;
    const off = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - angle), Math.cos(Math.atan2(dy, dx) - angle)));
    if (off > MEGAFONE_HALF_ARC && dist > e.def.radius + 6) continue;
    knockEnemy(e, dist > 0 ? dx / dist : 1, dist > 0 ? dy / dist : 0, MEGAFONE_KNOCK, p.slot);
    if (sobrecarga) e.stun = Math.max(e.stun, MEGAFONE_STUN_S);
    damageEnemy(world, e, MEGAFONE_DAMAGE * p.damageMul, p);
  }
  if (euforia) {
    for (const a of jogadoresNoRaio(world, p.x, p.y, raioDaAura(s))) {
      addBuff(a, { id: `megafone${p.slot}`, left: MEGAFONE_BUFF_S, attack: MEGAFONE_ATTACK });
    }
  }
  const cor = sobrecarga && !euforia ? COR_SOBRECARGA : COR_EUFORIA;
  spawnEffect(world, { kind: 'arc', x: p.x, y: oy, radius: MEGAFONE_REACH, angle, halfArc: MEGAFONE_HALF_ARC, life: 0.22, color: cor, sprite: 'megafone_arco' });
  s.megaCd = MEGAFONE_COOLDOWN_S / attackSpeed(p);
}

export function updateThayssa(world: World, p: Player, input: PlayerInput): void {
  const s = p.kit;
  if (!s || s.type !== 'thayssa') return;
  const dt = STEP_S;

  if (s.transitionLeft > 0) s.transitionLeft = Math.max(0, s.transitionLeft - dt);
  if (s.resonanceLeft > 0) s.resonanceLeft = Math.max(0, s.resonanceLeft - dt);
  if (s.resonanceCd > 0) s.resonanceCd -= dt;
  if (s.palmasCd > 0) s.palmasCd -= dt;
  if (s.megaCd > 0) s.megaCd -= dt;
  if (s.ultimoCd > 0) s.ultimoCd -= dt;
  s.sinceSwitch += dt;

  // Ressonância Dupla: as duas auras juntas por 4 s, e recarrega sozinha.
  if (s.mods.ressonancia && s.resonanceCd <= 0 && s.transitionLeft <= 0) {
    s.resonanceLeft = RESSONANCIA_DURATION_S;
    s.resonanceCd = RESSONANCIA_COOLDOWN_S;
    s.pulseCd = 0;
    s.pulseS = 0;
    spawnEffect(world, { kind: 'text', x: p.x, y: p.y - 30, life: 1.2, color: '#ffffff', text: 'Ressonância Dupla!' });
  }

  // Troca de modo (toque na tecla de ação).
  if (input.action && !s.prevAction && s.transitionLeft <= 0) trocarDeModo(world, p, s);
  s.prevAction = input.action;

  // Círculo Completo: com 3 ou mais aliados no anel, +1 tile de raio e +1 pulso (o intervalo cai à metade).
  if (s.mods.circulo) {
    // Conta os aliados com o raio sem o bônus, para o bônus não se sustentar sozinho.
    s.circuloAtivo = false;
    s.circuloAtivo = aliadosPerto(world, p, raioDaAura(s)).length >= CIRCULO_MIN_ALLIES;
  }

  // Mão Estendida: aliados que entram no anel ganham +10% de velocidade por 2 s.
  if (s.mods.maoEstendida) {
    const agora = aliadosPerto(world, p, raioDaAura(s)).map((a) => a.slot);
    for (const slot of agora) {
      if (!s.inside.includes(slot)) {
        const a = world.players[slot];
        if (a) addBuff(a, { id: `mao${p.slot}`, left: MAO_S, speed: MAO_SPEED });
      }
    }
    s.inside = agora;
  }

  aplicarBuffs(world, p, s);
  if (s.transitionLeft <= 0) pulsos(world, p, s);
  megafone(world, p, s);

  // Pulso de Palmas: a cada 10 s, onda de empurrão ao redor da aura.
  if (s.mods.palmas && s.palmasCd <= 0 && s.transitionLeft <= 0) {
    s.palmasCd = PALMAS_EVERY_S;
    const r = raioDaAura(s) * PALMAS_RADIUS_MUL;
    repulsao(world, p, r, PALMAS_KNOCK, 0);
    spawnEffect(world, { kind: 'ring', x: p.x, y: p.y - 8, radius: r, life: 0.5, color: '#ffffff', sprite: 'pulso_palmas' });
  }

  // Último Abraço: com a Thayssa abaixo de 10% de HP, aliados na aura ficam invulneráveis por 2 s.
  if (s.mods.ultimo && s.ultimoCd <= 0 && p.hp / p.maxHp < ULTIMO_HP_FRACTION) {
    s.ultimoCd = ULTIMO_COOLDOWN_S;
    for (const a of jogadoresNoRaio(world, p.x, p.y, raioDaAura(s))) a.invuln = Math.max(a.invuln, ULTIMO_INVULN_S);
    spawnEffect(world, { kind: 'text', x: p.x, y: p.y - 30, life: 1.2, color: '#ffd1ec', text: 'Último Abraço!' });
    spawnEffect(world, { kind: 'ring', x: p.x, y: p.y - 8, radius: raioDaAura(s), life: 0.9, color: '#ffd1ec', sprite: 'ultimo_abraco' });
  }
}

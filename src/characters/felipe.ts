import { damageArea, damageEnemy } from '../combat/enemies';
import { healPlayer } from '../combat/playerStats';
import { jogadoresNoRaio } from '../combat/thayssaAura';
import { addBuff, aliadosPerto } from '../combat/teamEffects';
import { createExtraWeapon } from '../combat/sharedWeaponTypes';
import { reduceCooldowns } from './kitHooks';
import {
  CORO_ACTIVE_S,
  CORO_BONUS,
  CORO_RADIUS,
  INTERVALO_CUT_S,
  INTERVALO_RADIUS,
  PASSA_DURATION_S,
  PASSA_EVERY_S,
  PASSA_RADIUS,
  QUEM_CANTA_S,
  SINAL_CUT_S,
  SINAL_RADIUS,
} from '../data/team';
import { spawnEffect } from '../combat/effects';
import { spawnProjectile } from '../combat/projectiles';
import { nearestEnemy } from '../combat/weapons';
import { STEP_S } from '../data/balance';
import {
  ACT_DURATION_S,
  AFINACAO_SPREAD_MUL,
  AFINACAO_TUNE_MUL,
  ANOMALIES,
  ANOMALY_PARAMS,
  ENCORE_REFILL,
  ENSAIO_COOLDOWN_S,
  ENSAIO_DAMAGE_MUL,
  ENSAIO_MIN_ENEMIES,
  ENSAIO_RADIUS,
  FLAUTA_BUFF_S,
  FLAUTA_DAMAGE_BUFF,
  FLAUTA_HEAL,
  ESPIRAL_EVERY,
  MICROFONE_STUN_S,
  TUNE_TIME_S,
  TURNE_INTERVAL_S,
  TURNE_STEP_S,
  type AnomalyDef,
} from '../data/felipe';
import { INSTRUMENTS, type InstrumentDef, type InstrumentId } from '../data/instruments';
import type { Enemy } from '../entities/enemy';
import { attackSpeed, type Player } from '../entities/player';
import type { PlayerInput } from '../engine/input';
import type { World } from '../engine/world';
import type { FelipeState } from './felipeState';

/** Altura do peito, de onde saem os ataques. */
const CHEST = 8;

function currentAct(world: World): number {
  return Math.min(2, Math.floor((world.tick * STEP_S) / ACT_DURATION_S));
}

/** Próximo instrumento (na ordem de rotação) que ainda tem munição. */
export function nextWithAmmo(s: FelipeState): InstrumentId | null {
  const i = s.owned.indexOf(s.active);
  for (let k = 1; k < s.owned.length; k++) {
    const id = s.owned[(i + k) % s.owned.length]!;
    if (s.ammo[id] >= 1) return id;
  }
  return null;
}

/** Troca de instrumento. A afinação (0,3 s sem atacar) pode ser anulada ou reduzida por cartas. */
export function switchTo(world: World, s: FelipeState, next: InstrumentId): void {
  if (next === s.active) return;
  // Solo de Improviso: o primeiro ataque depois da troca vale o dobro.
  if (s.mods.solo) s.soloReady = true;
  let tune = TUNE_TIME_S;
  if (s.mods.afinacaoOuvido) tune *= AFINACAO_TUNE_MUL;

  // Viola: empunhadura dupla, trocar de ou para a Viola não tem afinação.
  if (next === 'viola' || s.active === 'viola') {
    tune = 0;
  } else if (s.mods.passagemSom && s.freeSwitchAct !== currentAct(world)) {
    // Passagem de Som: a primeira troca de cada ato é gratuita.
    s.freeSwitchAct = currentAct(world);
    tune = 0;
  }
  s.tuneLeft = tune;
  s.active = next;

  // Sinal de Passagem: o aliado mais próximo recarrega mais rápido a cada troca.
  if (s.mods.sinal) {
    const owner = world.players.find((pl) => pl.kit === s);
    const ally = owner ? aliadosPerto(world, owner, SINAL_RADIUS)[0] : undefined;
    if (ally) reduceCooldowns(ally, SINAL_CUT_S);
  }
}

function aimAngle(p: Player, target: Enemy | null): number {
  if (target) return Math.atan2(target.y - (p.y - CHEST), target.x - p.x);
  return p.facing === 1 ? 0 : Math.PI;
}

/** Dispara um instrumento. Não mexe em munição nem em recarga: quem chama decide. */
export function fireInstrument(world: World, p: Player, s: FelipeState, id: InstrumentId, angle: number, dmgMul = 1): void {
  const inst = INSTRUMENTS[id];
  // Pedal de Distorção: Violão e Kazoo batem mais forte.
  const pedal = s.mods.pedal && (id === 'violao' || id === 'kazoo') ? 1.3 : 1;
  const dmg = inst.damage * p.damageMul * dmgMul * pedal;
  const ox = p.x;
  const oy = p.y - CHEST;

  switch (inst.attack) {
    case 'fan': {
      const count = (inst.count ?? 1) + p.extraProjectiles;
      const spread = (inst.spread ?? 0) * (id === 'violao' && s.mods.afinacaoOuvido ? AFINACAO_SPREAD_MUL : 1);
      const step = count > 1 ? spread / (count - 1) : 0;
      for (let i = 0; i < count; i++) {
        const ok = spawnProjectile(world, {
          kind: id === 'viola' ? 'viola' : 'note',
          x: ox,
          y: oy,
          angle: angle + (i - (count - 1) / 2) * step,
          speed: inst.speed ?? 200,
          damage: dmg,
          radius: inst.radius ?? 3,
          life: inst.lifetime ?? 1,
          pierce: inst.pierce ?? 0,
          ownerSlot: p.slot,
        });
        if (!ok) break;
      }
      break;
    }
    case 'shockwave': {
      const area = inst.area ?? 50;
      damageArea(world, p.x, oy, area, dmg, p);
      spawnEffect(world, { kind: 'ring', x: p.x, y: oy, radius: area, life: 0.25, color: '#ffd166', sprite: 'bateria' });
      break;
    }
    case 'beam': {
      const length = inst.range;
      const half = (inst.width ?? 8) / 2;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      for (const e of world.enemies.active) {
        if (!e.alive) continue;
        const rx = e.x - ox;
        const ry = e.y - oy;
        const t = rx * dx + ry * dy;
        if (t < 0 || t > length + e.def.radius) continue;
        const perp = Math.abs(rx * dy - ry * dx);
        if (perp <= half + e.def.radius) damageEnemy(world, e, dmg, p);
      }
      spawnEffect(world, {
        kind: 'beam',
        x: ox,
        y: oy,
        x2: ox + dx * length,
        y2: oy + dy * length,
        life: 0.12,
        color: '#ffe9a8',
      });
      break;
    }
    case 'canto': {
      // Flauta da Madrugada: cura quem esta no raio e da bonus de dano; os inimigos em volta so sao empurrados.
      const area = inst.area ?? 84;
      for (const a of jogadoresNoRaio(world, p.x, p.y, area)) {
        healPlayer(a, FLAUTA_HEAL);
        addBuff(a, { id: `flauta${p.slot}`, left: FLAUTA_BUFF_S, damage: FLAUTA_DAMAGE_BUFF });
      }
      damageArea(world, p.x, oy, area, dmg, p);
      spawnEffect(world, { kind: 'ring', x: p.x, y: oy, radius: area, life: 0.4, color: '#9be7a8', sprite: 'flauta_cura' });
      spawnEffect(world, { kind: 'text', x: p.x, y: p.y - 30, life: 0.7, color: '#c9f5d2', text: '♪' });
      break;
    }
    case 'ricochet': {
      const jitter = (world.rng.next() - 0.5) * (inst.spread ?? 0);
      spawnProjectile(world, {
        kind: 'kazoo',
        x: ox,
        y: oy,
        angle: angle + jitter,
        speed: inst.speed ?? 170,
        damage: dmg,
        radius: inst.radius ?? 3,
        life: inst.lifetime ?? 1.2,
        bounces: inst.bounces ?? 3,
        stun: s.mods.microfone ? MICROFONE_STUN_S : 0,
        ownerSlot: p.slot,
      });
      break;
    }
  }
}

export function pickAnomaly(world: World, s: FelipeState): AnomalyDef {
  const roll = (): AnomalyDef => {
    let total = 0;
    for (const a of ANOMALIES) total += a.weight;
    let r = world.rng.next() * total;
    for (const a of ANOMALIES) {
      r -= a.weight;
      if (r < 0) return a;
    }
    return ANOMALIES[0]!;
  };
  const first = roll();
  if (!s.mods.setlist) return first;
  // Setlist Surpresa: sorteia duas e fica com a mais rara.
  // Simplificação: no GDD o Felipe escolhe; sem menu de combate ainda, a escolha é automática.
  const second = roll();
  return second.weight < first.weight ? second : first;
}

/** Passiva "Espiral de Ideias Absurdas": dispara uma anomalia a cada 8 ataques. */
function triggerAnomaly(world: World, p: Player, s: FelipeState): void {
  const a = pickAnomaly(world, s);
  const ox = p.x;
  const oy = p.y - CHEST;
  spawnEffect(world, { kind: 'text', x: p.x, y: p.y - 30, life: 1.2, color: '#ffffff', text: a.name });
  // Lâmpada da Espiral de Ideias Absurdas sobre a cabeça.
  spawnEffect(world, { kind: 'ring', x: p.x, y: p.y - 52, radius: 12, life: 0.9, color: '#ffe9a8', sprite: 'espiral' });

  switch (a.id) {
    case 'pato': {
      const prm = ANOMALY_PARAMS.pato;
      const target = nearestEnemy(world, p, prm.range);
      spawnProjectile(world, {
        kind: 'duck',
        x: ox,
        y: oy,
        angle: aimAngle(p, target),
        speed: prm.speed,
        damage: prm.damage * p.damageMul,
        radius: prm.radius,
        life: prm.lifetime,
        pierce: 99,
        ownerSlot: p.slot,
      });
      break;
    }
    case 'confete': {
      const prm = ANOMALY_PARAMS.confete;
      const target = nearestEnemy(world, p, prm.range);
      const tx = target ? target.x : ox + (p.facing === 1 ? 60 : -60);
      const ty = target ? target.y : oy;
      damageArea(world, tx, ty, prm.area, prm.damage * p.damageMul, p);
      spawnEffect(world, { kind: 'ring', x: tx, y: ty, radius: prm.area, life: 0.4, color: '#ff6fb5', sprite: 'confete' });
      break;
    }
    case 'super': {
      p.buffSpeedMul = ANOMALY_PARAMS.super.speedMul;
      s.speedBuffLeft = ANOMALY_PARAMS.super.duration;
      break;
    }
    case 'chuva': {
      const prm = ANOMALY_PARAMS.chuva;
      spawnEffect(world, { kind: 'ring', x: p.x, y: p.y - 40, radius: 20, life: 1.1, color: '#cfd8dc', sprite: 'chuva_kazoos' });
      for (let i = 0; i < prm.count; i++) {
        spawnProjectile(world, {
          kind: 'kazoo',
          x: ox,
          y: oy,
          angle: world.rng.next() * Math.PI * 2,
          speed: prm.speed,
          damage: prm.damage * p.damageMul,
          radius: 3,
          life: prm.lifetime,
          bounces: prm.bounces,
          stun: s.mods.microfone ? MICROFONE_STUN_S : 0,
          ownerSlot: p.slot,
        });
      }
      break;
    }
  }
}

function findTarget(world: World, p: Player, inst: InstrumentDef): Enemy | null {
  return nearestEnemy(world, p, inst.range);
}

/** Chamado quando o instrumento ativo acaba a munição. */
function onDepleted(world: World, s: FelipeState): void {
  const depleted = s.active;
  const next = nextWithAmmo(s);
  if (next) {
    switchTo(world, s, next);
    if (s.mods.bis) s.bisPending = true;
  }
  // Encore do Felipe: o instrumento esgotado recarrega 30%.
  if (s.mods.encore) s.ammo[depleted] = Math.max(s.ammo[depleted], s.maxAmmo[depleted] * ENCORE_REFILL);
  // Intervalo Compartilhado: aliados próximos recarregam mais rápido.
  if (s.mods.intervalo) {
    const owner = world.players.find((pl) => pl.kit === s);
    if (owner) for (const a of aliadosPerto(world, owner, INTERVALO_RADIUS)) reduceCooldowns(a, INTERVALO_CUT_S);
  }
}

function countNear(world: World, x: number, y: number, r: number): number {
  let n = 0;
  const r2 = r * r;
  for (const e of world.enemies.active) {
    if (!e.alive) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    if (dx * dx + dy * dy <= r2) n++;
  }
  return n;
}

export function updateFelipe(world: World, p: Player, input: PlayerInput): void {
  const s = p.kit;
  if (!s || s.type !== 'felipe') return;
  const dt = STEP_S;

  // Recarga: instrumentos guardados recuperam munição. O ativo só recarrega se estiver vazio.
  for (const id of s.owned) {
    if (id === s.active && s.ammo[id] >= 1) continue;
    s.ammo[id] = Math.min(s.maxAmmo[id], s.ammo[id] + INSTRUMENTS[id].rechargePerS * dt * s.rechargeMul);
  }

  s.sinceAttack += dt;

  // Coro de Apoio: enquanto o Felipe ataca, aliados próximos causam +5% de dano.
  if (s.mods.coro && s.sinceAttack < CORO_ACTIVE_S) {
    for (const a of aliadosPerto(world, p, CORO_RADIUS)) addBuff(a, { id: `coro${p.slot}`, left: 0.2, damage: 1 + CORO_BONUS });
  }

  // Passa a Vez: a cada 45 s, empresta o Violão ao aliado mais próximo por 10 s.
  if (s.mods.passaAVez) {
    s.passaTimer -= dt;
    if (s.passaTimer <= 0) {
      const ally = aliadosPerto(world, p, PASSA_RADIUS).find((a) => !a.extraWeapons.some((w) => w.id === 'emprestado'));
      if (ally) {
        ally.extraWeapons.push(createExtraWeapon('emprestado', 1, PASSA_DURATION_S, p.slot));
        spawnEffect(world, { kind: 'text', x: ally.x, y: ally.y - 30, life: 1.2, color: '#ffe9a8', text: 'Passa a Vez!' });
        s.passaTimer = PASSA_EVERY_S;
      } else {
        s.passaTimer = 1; // sem aliado por perto: tenta de novo daqui a pouco
      }
    }
  }

  if (s.tuneLeft > 0) s.tuneLeft = Math.max(0, s.tuneLeft - dt);
  if (s.cd > 0) s.cd -= dt;
  if (s.ensaioCd > 0) s.ensaioCd -= dt;
  if (s.requiemCd > 0) s.requiemCd -= dt;
  if (s.speedBuffLeft > 0) {
    s.speedBuffLeft -= dt;
    if (s.speedBuffLeft <= 0) p.buffSpeedMul = 1;
  }

  // Troca manual: toque na tecla de ação passa para o próximo instrumento com munição.
  if (input.action && !s.prevAction) {
    const next = nextWithAmmo(s);
    if (next) switchTo(world, s, next);
  }
  s.prevAction = input.action;

  // Turnê de Bolso: a cada 60 s, todos os instrumentos disparam em sequência, sem gastar munição.
  if (s.mods.turne) {
    s.turneTimer -= dt;
    if (s.turneTimer <= 0) {
      s.turneTimer = TURNE_INTERVAL_S;
      s.turneQueue = [...s.owned];
      s.turneDelay = 0;
    }
    if (s.turneQueue.length > 0) {
      s.turneDelay -= dt;
      if (s.turneDelay <= 0) {
        const id = s.turneQueue.shift()!;
        const target = nearestEnemy(world, p, 400);
        fireInstrument(world, p, s, id, aimAngle(p, target));
        s.turneDelay = TURNE_STEP_S;
      }
    }
  }

  // Ensaio Geral: a Bateria dispara sozinha, com bônus de dano, quando há 3 ou mais inimigos por perto.
  if (s.mods.ensaioGeral && s.active !== 'bateria' && s.ensaioCd <= 0 && s.ammo.bateria >= 1) {
    if (countNear(world, p.x, p.y, ENSAIO_RADIUS) >= ENSAIO_MIN_ENEMIES) {
      fireInstrument(world, p, s, 'bateria', 0, ENSAIO_DAMAGE_MUL);
      s.ammo.bateria -= 1;
      s.ensaioCd = ENSAIO_COOLDOWN_S;
    }
  }

  // Se o ativo está vazio e há outro com munição, troca.
  if (s.ammo[s.active] < 1) {
    const next = nextWithAmmo(s);
    if (next) switchTo(world, s, next);
  }

  // Ataque automático.
  if (s.tuneLeft > 0 || s.cd > 0 || s.ammo[s.active] < 1) return;
  const inst = INSTRUMENTS[s.active];
  const target = findTarget(world, p, inst);
  if (!target) return;

  const angle = aimAngle(p, target);
  s.sinceAttack = 0;
  // Quem Canta Junto: aliados que atacam o mesmo inimigo causam +10% de dano.
  if (s.mods.quemCanta) {
    target.focusLeft = QUEM_CANTA_S;
    target.focusOwner = p.slot;
  }
  const soloMul = s.soloReady ? 2 : 1;
  s.soloReady = false;
  fireInstrument(world, p, s, s.active, angle, soloMul);
  if (s.bisPending) {
    // Bis no Show: rajada extra sem custo de munição.
    fireInstrument(world, p, s, s.active, angle);
    s.bisPending = false;
  }
  s.ammo[s.active] -= 1;
  s.attackCount++;
  s.cd = inst.cooldown / attackSpeed(p);

  if (s.attackCount % ESPIRAL_EVERY === 0) triggerAnomaly(world, p, s);
  if (s.ammo[s.active] < 1) onDepleted(world, s);
}

import { STEP_S } from '../data/balance';
import {
  CHICOTE,
  CHINELO,
  CONTROLE,
  EMPRESTADO,
  FOGOS,
  MANGUEIRA,
  PANELA,
  PIZZA,
  ROTEADOR,
  VENTILADOR,
} from '../data/sharedWeapons';
import { attackSpeed, type Player } from '../entities/player';
import { wrapAngle } from '../engine/math';
import type { World } from '../engine/world';
import { damageArea, damageEnemy } from './enemies';
import { spawnEffect } from './effects';
import { spawnProjectile } from './projectiles';
import { nearestEnemy } from './weapons';
import { createExtraWeapon, type ExtraWeapon, type SharedWeaponId } from './sharedWeaponTypes';

const DEG = Math.PI / 180;

/** Equipa a arma (nível 1) ou sobe o nível se o jogador já a tem. */
export function equiparArma(p: Player, id: SharedWeaponId, level: number): void {
  const existing = p.extraWeapons.find((w) => w.id === id);
  if (existing) existing.level = level;
  else p.extraWeapons.push(createExtraWeapon(id, level));
}

/** Posição de cada fatia da Pizza. */
export function posicaoDaFatia(p: Player, w: ExtraWeapon, i: number): { x: number; y: number } {
  const n = PIZZA.slices(w.level);
  const a = w.angle + (i * Math.PI * 2) / n;
  const r = PIZZA.radius(w.level);
  return { x: p.x + Math.cos(a) * r, y: p.y - 8 + Math.sin(a) * r };
}

function fatiasDePizza(world: World, p: Player, w: ExtraWeapon): void {
  const n = PIZZA.slices(w.level);
  w.angle += PIZZA.speed * STEP_S;
  while (w.sliceCd.length < n) w.sliceCd.push(0);
  for (let i = 0; i < n; i++) {
    w.sliceCd[i] = Math.max(0, (w.sliceCd[i] ?? 0) - STEP_S);
    if ((w.sliceCd[i] ?? 0) > 0) continue;
    const pos = posicaoDaFatia(p, w, i);
    let hit = false;
    for (const e of world.enemies.active) {
      if (!e.alive) continue;
      const reach = PIZZA.hitRadius + e.def.radius;
      if ((e.x - pos.x) ** 2 + (e.y - pos.y) ** 2 > reach * reach) continue;
      hit = true;
      damageEnemy(world, e, PIZZA.damage(w.level) * p.damageMul, p);
    }
    if (hit) w.sliceCd[i] = PIZZA.hitCooldown;
  }
}

/** Processa as zonas no chão: poças (só desaceleram) e roteadores (desaceleram e pulsam dano). */
function zonas(world: World, p: Player, w: ExtraWeapon, slowFor: number, damage: number): void {
  for (let i = w.zones.length - 1; i >= 0; i--) {
    const z = w.zones[i]!;
    z.t -= STEP_S;
    if (z.t <= 0) {
      w.zones.splice(i, 1);
      continue;
    }
    for (const e of world.enemies.active) {
      if (!e.alive) continue;
      const reach = z.radius + e.def.radius;
      if ((e.x - z.x) ** 2 + (e.y - z.y) ** 2 <= reach * reach) e.slow = Math.max(e.slow, slowFor);
    }
    if (z.pulseCd !== Infinity) {
      z.pulseCd -= STEP_S;
      if (z.pulseCd <= 0) {
        z.pulseCd = ROTEADOR.pulseEvery;
        damageArea(world, z.x, z.y, z.radius, damage * p.damageMul, p);
        spawnEffect(world, { kind: 'ring', x: z.x, y: z.y, radius: z.radius, life: 0.4, color: '#7ad7ff' });
      }
    }
  }
}

function roteador(world: World, p: Player, w: ExtraWeapon): void {
  w.cd -= STEP_S;
  if (w.cd <= 0) {
    w.cd = ROTEADOR.cooldown(w.level);
    w.zones.push({ x: p.x, y: p.y, t: ROTEADOR.duration, radius: ROTEADOR.radius(w.level), pulseCd: 0 });
  }
  zonas(world, p, w, ROTEADOR.slowFor, ROTEADOR.damage(w.level));
}

function chinelo(world: World, p: Player, w: ExtraWeapon): void {
  w.cd -= STEP_S;
  if (w.cd > 0) return;
  const alvo = nearestEnemy(world, p, CHINELO.range);
  if (!alvo) return;
  w.cd = CHINELO.cooldown(w.level) / attackSpeed(p);
  spawnProjectile(world, {
    kind: 'chinelo',
    x: p.x,
    y: p.y - 8,
    angle: Math.atan2(alvo.y - (p.y - 8), alvo.x - p.x),
    speed: CHINELO.speed,
    damage: CHINELO.damage(w.level) * p.damageMul,
    radius: CHINELO.radius,
    life: 10,
    pierce: 999,
    boomerangOut: CHINELO.outTime,
    ownerSlot: p.slot,
  });
}

function chicote(world: World, p: Player, w: ExtraWeapon): void {
  w.cd -= STEP_S;
  if (w.cd > 0) return;
  const reach = CHICOTE.reach(w.level);
  const alvo = nearestEnemy(world, p, reach + 8);
  if (!alvo) return;
  w.cd = CHICOTE.cooldown(w.level) / attackSpeed(p);
  const angle = Math.atan2(alvo.y - (p.y - 8), alvo.x - p.x);
  const half = (CHICOTE.arcDeg * DEG) / 2;
  // Cada nó aumenta o dano. O nó só cresce se o golpe anterior acertou alguém.
  const damage = CHICOTE.damage(w.level) * p.damageMul * (1 + CHICOTE.knotBonus * w.knots);
  let acertou = 0;
  for (const e of world.enemies.active) {
    if (!e.alive) continue;
    const dx = e.x - p.x;
    const dy = e.y - (p.y - 8);
    const d = Math.hypot(dx, dy);
    if (d > reach + e.def.radius) continue;
    if (Math.abs(wrapAngle(Math.atan2(dy, dx) - angle)) > half && d > e.def.radius + 6) continue;
    acertou++;
    damageEnemy(world, e, damage, p);
  }
  w.knots = acertou > 0 ? Math.min(CHICOTE.maxKnots, w.knots + 1) : 0;
  spawnEffect(world, { kind: 'arc', x: p.x, y: p.y - 8, radius: reach, angle, halfArc: half, life: 0.12, color: '#ff9e6b' });
}

function ventilador(world: World, p: Player, w: ExtraWeapon): void {
  // O vento sopra para onde o jogador está virado.
  w.aim = p.facing === 1 ? 0 : Math.PI;
  const reach = VENTILADOR.reach(w.level);
  const half = (VENTILADOR.arcDeg * DEG) / 2;
  const push = VENTILADOR.push(w.level) * STEP_S;
  const oy = p.y - 8;
  w.cd -= STEP_S;
  const tick = w.cd <= 0;
  if (tick) w.cd = VENTILADOR.tickEvery;
  for (const e of world.enemies.active) {
    if (!e.alive) continue;
    const dx = e.x - p.x;
    const dy = e.y - oy;
    const d = Math.hypot(dx, dy);
    if (d > reach + e.def.radius) continue;
    if (Math.abs(wrapAngle(Math.atan2(dy, dx) - w.aim)) > half) continue;
    e.x += Math.cos(w.aim) * push;
    e.y += Math.sin(w.aim) * push;
    if (tick) damageEnemy(world, e, VENTILADOR.damage(w.level) * p.damageMul, p);
  }
  if (tick) spawnEffect(world, { kind: 'arc', x: p.x, y: oy, radius: reach, angle: w.aim, halfArc: half, life: 0.5, color: '#bfe9ff' });
}

/** Explosões agendadas (Panela e Fogos): quando o tempo acaba, explodem. */
function explosoes(world: World, p: Player, w: ExtraWeapon): void {
  for (let i = w.pending.length - 1; i >= 0; i--) {
    const e = w.pending[i]!;
    e.t -= STEP_S;
    if (e.t > 0) continue;
    damageArea(world, e.x, e.y, e.radius, e.damage * p.damageMul, p);
    spawnEffect(world, { kind: 'ring', x: e.x, y: e.y, radius: e.radius, life: 0.3, color: '#ffb347' });
    w.pending.splice(i, 1);
  }
}

function panela(world: World, p: Player, w: ExtraWeapon): void {
  explosoes(world, p, w);
  w.cd -= STEP_S;
  if (w.cd > 0) return;
  const alvo = nearestEnemy(world, p, PANELA.range);
  if (!alvo) return;
  w.cd = PANELA.cooldown(w.level) / attackSpeed(p);
  const radius = PANELA.radius(w.level);
  w.pending.push({ x: alvo.x, y: alvo.y, t: PANELA.delay, radius, damage: PANELA.damage(w.level) });
  // Aviso no chão antes da explosão.
  spawnEffect(world, { kind: 'ring', x: alvo.x, y: alvo.y, radius, life: PANELA.delay, color: '#ff6b6b' });
}

function controle(world: World, p: Player, w: ExtraWeapon): void {
  w.cd -= STEP_S;
  if (w.cd > 0) return;
  const alvo = nearestEnemy(world, p, CONTROLE.range);
  if (!alvo) return;
  w.cd = CONTROLE.cooldown(w.level) / attackSpeed(p);
  spawnProjectile(world, {
    kind: 'controle',
    x: p.x,
    y: p.y - 8,
    angle: Math.atan2(alvo.y - (p.y - 8), alvo.x - p.x),
    speed: CONTROLE.speed,
    damage: CONTROLE.damage(w.level) * p.damageMul,
    radius: CONTROLE.radius,
    life: 2.6,
    stun: CONTROLE.stun(w.level),
    ownerSlot: p.slot,
  });
}

function mangueira(world: World, p: Player, w: ExtraWeapon): void {
  zonas(world, p, w, MANGUEIRA.slowFor, 0);
  w.cd -= STEP_S;
  if (w.cd > 0) return;
  const length = MANGUEIRA.length(w.level);
  const alvo = nearestEnemy(world, p, length);
  if (!alvo) return;
  w.cd = MANGUEIRA.cooldown(w.level) / attackSpeed(p);
  const ox = p.x;
  const oy = p.y - 8;
  const angle = Math.atan2(alvo.y - oy, alvo.x - ox);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const half = MANGUEIRA.width / 2;
  for (const e of world.enemies.active) {
    if (!e.alive) continue;
    const rx = e.x - ox;
    const ry = e.y - oy;
    const t = rx * dx + ry * dy;
    if (t < 0 || t > length + e.def.radius) continue;
    if (Math.abs(rx * dy - ry * dx) <= half + e.def.radius) damageEnemy(world, e, MANGUEIRA.damage(w.level) * p.damageMul, p);
  }
  spawnEffect(world, { kind: 'beam', x: ox, y: oy, x2: ox + dx * length, y2: oy + dy * length, life: 0.15, color: '#6ec6ff' });
  // A poça fica na ponta do jato e desacelera quem passar.
  w.zones.push({
    x: ox + dx * length,
    y: oy + dy * length + 8,
    t: MANGUEIRA.puddleDuration,
    radius: MANGUEIRA.puddleRadius(w.level),
    pulseCd: Infinity,
  });
}

function fogos(world: World, p: Player, w: ExtraWeapon): void {
  explosoes(world, p, w);
  w.cd -= STEP_S;
  if (w.cd > 0) return;
  if (world.enemies.size === 0) return; // só solta fogos se houver alvo na tela
  w.cd = FOGOS.cooldown(w.level) / attackSpeed(p);
  const radius = FOGOS.radius(w.level);
  for (let i = 0; i < FOGOS.bursts(w.level); i++) {
    const a = world.rng.next() * Math.PI * 2;
    const d = world.rng.next() * FOGOS.scatter;
    const x = p.x + Math.cos(a) * d;
    const y = p.y + Math.sin(a) * d;
    w.pending.push({ x, y, t: FOGOS.delay, radius, damage: FOGOS.damage(w.level) });
    spawnEffect(world, { kind: 'ring', x, y, radius, life: FOGOS.delay, color: '#ffd166' });
  }
}

/** Violão emprestado pelo Felipe: leque de 3 notas no inimigo mais próximo, por um tempo limitado. */
function emprestado(world: World, p: Player, w: ExtraWeapon): void {
  w.cd -= STEP_S;
  if (w.cd > 0) return;
  const alvo = nearestEnemy(world, p, EMPRESTADO.range);
  if (!alvo) return;
  w.cd = EMPRESTADO.cooldown / attackSpeed(p);
  const base = Math.atan2(alvo.y - (p.y - 8), alvo.x - p.x);
  for (let i = 0; i < EMPRESTADO.count; i++) {
    spawnProjectile(world, {
      kind: 'note',
      x: p.x,
      y: p.y - 8,
      angle: base + (i - (EMPRESTADO.count - 1) / 2) * (20 * DEG),
      speed: EMPRESTADO.speed,
      damage: EMPRESTADO.damage * p.damageMul,
      radius: 3,
      life: EMPRESTADO.lifetime,
      ownerSlot: p.slot,
    });
  }
}

/** Atualiza todas as armas extras de um jogador. Armas emprestadas expiram. */
export function updateExtraWeapons(world: World, p: Player): void {
  for (let i = p.extraWeapons.length - 1; i >= 0; i--) {
    const w = p.extraWeapons[i]!;
    if (w.life !== Infinity) {
      w.life -= STEP_S;
      if (w.life <= 0) {
        p.extraWeapons.splice(i, 1);
        continue;
      }
    }
    switch (w.id) {
      case 'pizza':
        fatiasDePizza(world, p, w);
        break;
      case 'roteador':
        roteador(world, p, w);
        break;
      case 'chinelo':
        chinelo(world, p, w);
        break;
      case 'chicote':
        chicote(world, p, w);
        break;
      case 'ventilador':
        ventilador(world, p, w);
        break;
      case 'panela':
        panela(world, p, w);
        break;
      case 'controle':
        controle(world, p, w);
        break;
      case 'mangueira':
        mangueira(world, p, w);
        break;
      case 'fogos':
        fogos(world, p, w);
        break;
      case 'emprestado':
        emprestado(world, p, w);
        break;
    }
  }
}

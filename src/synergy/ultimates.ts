import { spawnEffect } from '../combat/effects';
import { damageArea, damageEnemy, knockEnemy } from '../combat/enemies';
import { grantXp } from '../combat/leveling';
import { healPlayer } from '../combat/playerStats';
import { spawnProjectile } from '../combat/projectiles';
import { addBuff } from '../combat/teamEffects';
import { nearestEnemy } from '../combat/weapons';
import { STEP_S } from '../data/balance';
import type { CharacterId } from '../data/characters';
import { CRIT_MUL, FLORETE_DAMAGE, BURST_DURATION_S } from '../data/melissa';
import { ULT } from '../data/synergy';
import type { Enemy } from '../entities/enemy';
import type { Player } from '../entities/player';
import type { World } from '../engine/world';
import type { ActiveUltimate } from './state';

// As 10 Ultimates de dupla (GDD A.6). Cada uma dura 6 s e tem um efeito visível e diferente das outras.
// O dano é creditado ao primeiro jogador do par (para abates, XP e carga das barras).

function jogador(world: World, slot: number): Player | undefined {
  return world.players[slot];
}

/** O jogador do par que é o personagem `c`, se houver. */
function quem(world: World, u: ActiveUltimate, c: CharacterId): Player | undefined {
  return [jogador(world, u.a), jogador(world, u.b)].find((p) => p?.characterId === c);
}

function meio(world: World, u: ActiveUltimate): { x: number; y: number } {
  const a = jogador(world, u.a);
  const b = jogador(world, u.b);
  return { x: ((a?.x ?? 0) + (b?.x ?? 0)) / 2, y: ((a?.y ?? 0) + (b?.y ?? 0)) / 2 };
}

/** Quem leva o crédito do dano: o primeiro do par que ainda está vivo. */
function dono(world: World, u: ActiveUltimate): Player | undefined {
  const a = jogador(world, u.a);
  if (a && a.hp > 0) return a;
  return jogador(world, u.b);
}

function paresVivos(world: World, u: ActiveUltimate): Player[] {
  return [jogador(world, u.a), jogador(world, u.b)].filter((p): p is Player => !!p && p.hp > 0);
}

function inimigosNoRaio(world: World, x: number, y: number, r: number): Enemy[] {
  const out: Enemy[] = [];
  for (const e of world.enemies.active) {
    if (!e.alive || e.untargetable) continue;
    if ((e.x - x) ** 2 + (e.y - y) ** 2 <= (r + e.def.radius) ** 2) out.push(e);
  }
  return out;
}

// ---- Início ----

export function iniciarUltimate(world: World, u: ActiveUltimate): void {
  switch (u.id) {
    case 'setlist':
      u.acc = ULT.setlist.every;
      break;
    case 'danca':
      u.acc = ULT.danca.every;
      break;
    case 'rodeio':
      u.acc = ULT.rodeio.every;
      break;
    case 'pista':
      u.acc = ULT.pista.every;
      for (const p of paresVivos(world, u)) p.invuln = Math.max(p.invuln, ULT.pista.invuln);
      break;
    case 'pausa':
      pausaDramatica(world, u);
      break;
    case 'estante':
      u.acc = ULT.estante.every;
      break;
    case 'constelacao':
      u.acc = ULT.constelacao.every;
      break;
    case 'lancamento': {
      u.acc = ULT.lancamento.every;
      // A Thaisa pega a Melissa: ela começa a giro ao lado dela.
      const mel = quem(world, u, 'melissa');
      const tha = quem(world, u, 'thaisa');
      if (mel && tha) {
        mel.x = tha.x + 10;
        mel.y = tha.y;
        spawnEffect(world, { kind: 'text', x: tha.x, y: tha.y - 30, life: 1.2, color: '#ffe08a', text: 'Lançamento!' });
      }
      break;
    }
    case 'prisma':
      u.acc = ULT.prisma.every;
      break;
    case 'sobremesa': {
      const m = meio(world, u);
      u.list = [
        { x: m.x - ULT.sobremesa.offset, y: m.y, t: 0 }, // clone grande
        { x: m.x + ULT.sobremesa.offset, y: m.y, t: 1 }, // clone pequeno
      ];
      spawnEffect(world, { kind: 'text', x: m.x, y: m.y - 30, life: 1.2, color: '#ffb3e6', text: 'Sobremesa!' });
      break;
    }
  }
}

// ---- Efeitos individuais ----

/** 1. Setlist Anotada: discos de vinil orbitam o Felipe e disparam notas elétricas em cadeia. */
function setlist(world: World, u: ActiveUltimate): void {
  const c = ULT.setlist;
  const centro = quem(world, u, 'felipe') ?? dono(world, u);
  const credito = dono(world, u);
  if (!centro || !credito) return;
  u.angle += c.spin * STEP_S;
  u.acc += STEP_S;
  while (u.acc >= c.every) {
    u.acc -= c.every;
    for (let i = 0; i < c.discs; i++) {
      const p = posicaoDoDisco(centro, u, i);
      const alvo = nearestEnemy(world, p, c.range);
      if (!alvo) continue;
      // Cadeia: cada salto procura o inimigo mais próximo ainda não atingido.
      const visitados = new Set<Enemy>();
      let atual: Enemy | null = alvo;
      let de = { x: p.x, y: p.y };
      for (let hop = 0; hop < c.hops && atual; hop++) {
        visitados.add(atual);
        spawnEffect(world, { kind: 'beam', x: de.x, y: de.y, x2: atual.x, y2: atual.y, life: 0.15, color: '#9be7ff' });
        damageEnemy(world, atual, c.damage * credito.damageMul, credito);
        de = { x: atual.x, y: atual.y };
        let proximo: Enemy | null = null;
        let melhor = c.hopRange * c.hopRange;
        for (const e of world.enemies.active) {
          if (!e.alive || e.untargetable || visitados.has(e)) continue;
          const d = (e.x - de.x) ** 2 + (e.y - de.y) ** 2;
          if (d <= melhor) {
            melhor = d;
            proximo = e;
          }
        }
        atual = proximo;
      }
    }
  }
}

/** Posição de cada disco de vinil. */
export function posicaoDoDisco(centro: { x: number; y: number }, u: ActiveUltimate, i: number): { x: number; y: number } {
  const a = u.angle + (i * Math.PI * 2) / ULT.setlist.discs;
  return { x: centro.x + Math.cos(a) * ULT.setlist.radius, y: centro.y - 8 + Math.sin(a) * ULT.setlist.radius };
}

/** 2. Dança do Refrão: a Melissa corta em dash, deixando notas explosivas e holofotes cegantes. */
function danca(world: World, u: ActiveUltimate): void {
  const c = ULT.danca;
  const mel = quem(world, u, 'melissa');
  const credito = dono(world, u);
  if (!mel || !credito) return;

  for (let i = u.list.length - 1; i >= 0; i--) {
    const nota = u.list[i]!;
    nota.t -= STEP_S;
    if (nota.t > 0) continue;
    damageArea(world, nota.x, nota.y, c.noteRadius, c.noteDamage * credito.damageMul, credito);
    spawnEffect(world, { kind: 'ring', x: nota.x, y: nota.y, radius: c.noteRadius, life: 0.3, color: '#ffb347' });
    u.list.splice(i, 1);
  }

  u.acc += STEP_S;
  while (u.acc >= c.every) {
    u.acc -= c.every;
    const alvo = nearestEnemy(world, mel, c.range);
    const ang = alvo ? Math.atan2(alvo.y - mel.y, alvo.x - mel.x) : mel.facing === 1 ? 0 : Math.PI;
    const dist = c.dashSpeed * c.dashTime;
    // Nota explosiva e holofote cegante no ponto de partida.
    u.list.push({ x: mel.x, y: mel.y - 8, t: c.noteDelay });
    for (const e of inimigosNoRaio(world, mel.x, mel.y - 8, c.blindRadius)) e.blind = Math.max(e.blind, c.blindS);
    spawnEffect(world, { kind: 'ring', x: mel.x, y: mel.y - 8, radius: c.blindRadius, life: 0.3, color: '#ffffff' });
    // Corte ao longo do trajeto.
    for (let k = 1; k <= 4; k++) {
      const px = mel.x + Math.cos(ang) * dist * (k / 4);
      const py = mel.y - 8 + Math.sin(ang) * dist * (k / 4);
      damageArea(world, px, py, c.hitRadius, (c.damage * credito.damageMul) / 2, credito);
    }
    spawnEffect(world, {
      kind: 'beam',
      x: mel.x,
      y: mel.y - 8,
      x2: mel.x + Math.cos(ang) * dist,
      y2: mel.y - 8 + Math.sin(ang) * dist,
      life: 0.2,
      color: '#ff9ec4',
    });
    mel.forcedMove = { vx: Math.cos(ang) * c.dashSpeed, vy: Math.sin(ang) * c.dashSpeed, left: c.dashTime };
  }
}

/** 3. Rodeio Sonoro: anel de choque puxa os inimigos para o centro e os esmaga no ritmo. */
function rodeio(world: World, u: ActiveUltimate): void {
  const c = ULT.rodeio;
  const credito = dono(world, u);
  if (!credito) return;
  const m = meio(world, u);
  u.acc += STEP_S;
  while (u.acc >= c.every) {
    u.acc -= c.every;
    spawnEffect(world, { kind: 'ring', x: m.x, y: m.y, radius: c.radius, life: 0.4, color: '#ffd166' });
    for (const e of inimigosNoRaio(world, m.x, m.y, c.radius)) {
      const dx = m.x - e.x;
      const dy = m.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      knockEnemy(e, dx / d, dy / d, c.pull, credito.slot);
      damageEnemy(world, e, c.damage * credito.damageMul, credito);
    }
  }
}

/** 4. Pista Aberta: aliados invulneráveis por 1 s; inimigos dançam (cambaleiam) e sofrem dano contínuo. */
function pista(world: World, u: ActiveUltimate): void {
  const c = ULT.pista;
  const credito = dono(world, u);
  if (!credito) return;
  const m = meio(world, u);
  // Os inimigos na pista dançam: desorientados enquanto estiverem nela.
  for (const e of inimigosNoRaio(world, m.x, m.y, c.radius)) e.blind = Math.max(e.blind, c.dance);
  u.acc += STEP_S;
  while (u.acc >= c.every) {
    u.acc -= c.every;
    for (const e of inimigosNoRaio(world, m.x, m.y, c.radius)) damageEnemy(world, e, c.damage * credito.damageMul, credito);
  }
}

/** 5. Pausa Dramática: câmera lenta nos inimigos, e a Melissa acerta todos os Holofotes visíveis. */
function pausaDramatica(world: World, u: ActiveUltimate): void {
  const mel = quem(world, u, 'melissa') ?? dono(world, u);
  if (!mel) return;
  const c = ULT.pausa;
  for (const e of inimigosNoRaio(world, mel.x, mel.y, c.range)) {
    if (e.spot <= 0) e.spot = c.spotS; // Holofote em todo mundo que está na tela
    // Todos os Holofotes visíveis são acertados: crítico.
    damageEnemy(world, e, FLORETE_DAMAGE * CRIT_MUL * mel.damageMul, mel);
    e.spot = 0;
  }
  const k = mel.kit;
  if (k?.type === 'melissa') {
    k.burstLeft = BURST_DURATION_S;
    k.spotHits++;
  }
  spawnEffect(world, { kind: 'text', x: mel.x, y: mel.y - 30, life: 1.4, color: '#7ad7ff', text: 'Pausa Dramática' });
  spawnEffect(world, { kind: 'ring', x: mel.x, y: mel.y - 8, radius: c.range, life: 0.5, color: '#27e1ff' });
}

/** 6. Estante em Queda: estantes espectrais caem pela tela inteira, atordoando. */
function estante(world: World, u: ActiveUltimate): void {
  const c = ULT.estante;
  const credito = dono(world, u);
  if (!credito) return;
  const m = meio(world, u);
  u.acc += STEP_S;
  while (u.acc >= c.every) {
    u.acc -= c.every;
    for (let i = 0; i < c.shelves; i++) {
      const x = m.x + (world.rng.next() - 0.5) * 2 * c.spreadX;
      const y = m.y + (world.rng.next() - 0.5) * 2 * c.spreadY;
      damageArea(world, x, y, c.radius, c.damage * credito.damageMul, credito, c.stun);
      spawnEffect(world, { kind: 'ring', x, y, radius: c.radius, life: 0.35, color: '#b5835a' });
    }
  }
}

/** 7. Constelação Afetiva: as gemas de XP viram mísseis teleguiados que curam ao acertar. */
function constelacao(world: World, u: ActiveUltimate): void {
  const c = ULT.constelacao;
  const credito = dono(world, u);
  const par = paresVivos(world, u);
  if (!credito || par.length === 0) return;
  const m = meio(world, u);
  u.acc += STEP_S;
  while (u.acc >= c.every) {
    u.acc -= c.every;
    const gemas = world.gems.active
      .filter((g) => g.alive && (g.x - m.x) ** 2 + (g.y - m.y) ** 2 <= c.radius * c.radius)
      .sort((p, q) => (p.x - m.x) ** 2 + (p.y - m.y) ** 2 - ((q.x - m.x) ** 2 + (q.y - m.y) ** 2))
      .slice(0, c.perWave);
    for (const g of gemas) {
      // O XP da gema não se perde: vai para o jogador do par mais perto dela.
      const quemPega = par.reduce((melhor, p) => (Math.hypot(p.x - g.x, p.y - g.y) < Math.hypot(melhor.x - g.x, melhor.y - g.y) ? p : melhor));
      grantXp(world, quemPega, g.xp);
      g.alive = false;
      const alvo = nearestEnemy(world, g, 400);
      spawnProjectile(world, {
        kind: 'missil',
        x: g.x,
        y: g.y,
        angle: alvo ? Math.atan2(alvo.y - g.y, alvo.x - g.x) : world.rng.next() * Math.PI * 2,
        speed: c.speed,
        damage: c.damage * credito.damageMul,
        radius: 4,
        life: 3,
        homing: c.homing,
        healOnHit: c.heal,
        ownerSlot: credito.slot,
      });
      spawnEffect(world, { kind: 'ring', x: g.x, y: g.y, radius: 8, life: 0.25, color: '#ff9ec4' });
    }
  }
}

/** 8. Lançamento Olímpico: a Thaisa arremessa a Melissa, que gira ricocheteando entre os inimigos. */
function lancamento(world: World, u: ActiveUltimate): void {
  const c = ULT.lancamento;
  const mel = quem(world, u, 'melissa');
  const credito = dono(world, u);
  if (!mel || !credito) return;
  mel.invuln = Math.max(mel.invuln, 0.3);

  for (let i = u.list.length - 1; i >= 0; i--) {
    const impacto = u.list[i]!;
    impacto.t -= STEP_S;
    if (impacto.t > 0) continue;
    damageArea(world, impacto.x, impacto.y, c.radius, c.damage * credito.damageMul, credito);
    spawnEffect(world, { kind: 'ring', x: impacto.x, y: impacto.y, radius: c.radius, life: 0.25, color: '#ff9ec4' });
    u.list.splice(i, 1);
  }

  u.acc += STEP_S;
  while (u.acc >= c.every) {
    u.acc -= c.every;
    // O próximo alvo: o mais perto que ela ainda não visitou nos últimos pulos.
    let alvo: Enemy | null = null;
    let melhor = c.range * c.range;
    for (const e of world.enemies.active) {
      if (!e.alive || e.untargetable || u.visited.includes(e.uid)) continue;
      const d = (e.x - mel.x) ** 2 + (e.y - mel.y) ** 2;
      if (d <= melhor) {
        melhor = d;
        alvo = e;
      }
    }
    if (!alvo) {
      u.visited.length = 0;
      continue;
    }
    u.visited.push(alvo.uid);
    if (u.visited.length > 3) u.visited.shift();
    const dx = alvo.x - mel.x;
    const dy = alvo.y - mel.y;
    const d = Math.hypot(dx, dy) || 1;
    const vel = d / c.dashTime;
    mel.forcedMove = { vx: (dx / d) * vel, vy: (dy / d) * vel, left: c.dashTime };
    u.list.push({ x: alvo.x, y: alvo.y, t: c.dashTime });
    spawnEffect(world, { kind: 'beam', x: mel.x, y: mel.y - 8, x2: alvo.x, y2: alvo.y, life: 0.2, color: '#ffe08a' });
  }
}

/** 9. Prisma de Melhores Amigas: laser prismático duplo entre as duas, cortando tudo no caminho. */
function prisma(world: World, u: ActiveUltimate): void {
  const c = ULT.prisma;
  const a = jogador(world, u.a);
  const b = jogador(world, u.b);
  const credito = dono(world, u);
  if (!a || !b || !credito) return;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const sx = a.x - ux * c.extend;
  const sy = a.y - 8 - uy * c.extend;
  const total = len + c.extend * 2;
  // O laser é desenhado todo passo para ficar contínuo.
  const nx = -uy * 3;
  const ny = ux * 3;
  spawnEffect(world, { kind: 'beam', x: sx + nx, y: sy + ny, x2: sx + ux * total + nx, y2: sy + uy * total + ny, life: 0.06, color: '#7ad7ff' });
  spawnEffect(world, { kind: 'beam', x: sx - nx, y: sy - ny, x2: sx + ux * total - nx, y2: sy + uy * total - ny, life: 0.06, color: '#ff7ad9' });
  u.acc += STEP_S;
  while (u.acc >= c.every) {
    u.acc -= c.every;
    for (const e of world.enemies.active) {
      if (!e.alive || e.untargetable) continue;
      const rx = e.x - sx;
      const ry = e.y - sy;
      const t = rx * ux + ry * uy;
      if (t < 0 || t > total) continue;
      if (Math.abs(rx * uy - ry * ux) <= c.width / 2 + e.def.radius) damageEnemy(world, e, c.damage * credito.damageMul, credito);
    }
  }
}

/** Clone em pé de uma Sobremesa Espectral: posição de cada um segue o ponto médio da dupla. */
function sobremesa(world: World, u: ActiveUltimate): void {
  const c = ULT.sobremesa;
  const par = paresVivos(world, u);
  const m = meio(world, u);
  u.list.forEach((clone, i) => {
    const lado = i === 0 ? -1 : 1;
    clone.x = m.x + lado * c.offset;
    clone.y = m.y + Math.sin(u.t * 3 + i) * 3;
  });
  // Os clones comem a comida do chão e fortalecem o time.
  for (const f of world.foods.active) {
    if (!f.alive) continue;
    if (!u.list.some((cl) => (cl.x - f.x) ** 2 + (cl.y - f.y) ** 2 <= c.eat * c.eat)) continue;
    f.alive = false;
    for (const p of par) {
      healPlayer(p, f.def.heal);
      addBuff(p, { id: `sobremesa${u.a}-${u.b}`, left: c.buffS, attack: c.buffAttack });
    }
    spawnEffect(world, { kind: 'text', x: f.x, y: f.y - 8, life: 0.8, color: '#ffb3e6', text: 'nham!' });
  }
}

/** Posições dos clones (para provocar inimigos e desenhar). */
export function clonesDaSobremesa(u: ActiveUltimate): readonly { x: number; y: number; t: number }[] {
  return u.id === 'sobremesa' ? u.list : [];
}

export function tickUltimate(world: World, u: ActiveUltimate): void {
  switch (u.id) {
    case 'setlist':
      setlist(world, u);
      break;
    case 'danca':
      danca(world, u);
      break;
    case 'rodeio':
      rodeio(world, u);
      break;
    case 'pista':
      pista(world, u);
      break;
    case 'pausa':
      break; // a câmera lenta vale enquanto a Ultimate durar (SynergyState)
    case 'estante':
      estante(world, u);
      break;
    case 'constelacao':
      constelacao(world, u);
      break;
    case 'lancamento':
      lancamento(world, u);
      break;
    case 'prisma':
      prisma(world, u);
      break;
    case 'sobremesa':
      sobremesa(world, u);
      break;
  }
}

/** Fim da Ultimate. Os clones da Sobremesa explodem. */
export function encerrarUltimate(world: World, u: ActiveUltimate): void {
  if (u.id !== 'sobremesa') return;
  const c = ULT.sobremesa;
  const credito = dono(world, u);
  if (!credito) return;
  for (const clone of u.list) {
    damageArea(world, clone.x, clone.y, c.explodeRadius, c.explodeDamage * credito.damageMul, credito);
    spawnEffect(world, { kind: 'ring', x: clone.x, y: clone.y, radius: c.explodeRadius, life: 0.4, color: '#ff8fd0' });
  }
}

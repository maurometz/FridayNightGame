import { STEP_S } from '../data/balance';
import { SALSICHAS_CFG } from '../data/bosses';
import { FOODS } from '../data/foods';
import type { Enemy } from '../entities/enemy';
import type { Player } from '../entities/player';
import { clamp, wrapAngle } from '../engine/math';
import type { World } from '../engine/world';
import { BOSS_STATE } from './bossState';
import { spawnEffect } from './effects';
import { spawnFood } from './foods';
import { spawnHazard, spawnHostile } from './hostile';
import { pushMessage } from './messages';

// A luta das Salsichas (fase 1). Quatro cachorros, cada um com o seu ataque, uma barra de vida só:
//   Geraldo: trenzinho de latidos | Monet: poças de tinta | Toddy: investida rasante | Bucky: abocanha e puxa.
// Três fases pela vida restante: matilha UNIDA (um ataque por vez, em rodízio), matilha DIVIDIDA (cada cachorro
// ataca por conta própria e pode ficar exausto) e SALSICHÃO (os quatro numa fila só, ataques combinados).
// A geladeira solta comida e a matilha disputa com os jogadores (ver `procurarComida` e `distrairMatilha`).

const C = SALSICHAS_CFG;

/** Ordem do rodízio de ataques. */
const ORDEM = ['salsichas', 'monet', 'toddy', 'bucky'] as const;
type CachorroId = (typeof ORDEM)[number];

const NOMES: Record<CachorroId, string> = { salsichas: 'Geraldo', monet: 'Monet', toddy: 'Toddy', bucky: 'Bucky' };

/** O cachorro está deitado, sem vigor? (não ataca e não machuca por contato) */
export function estaExausto(e: Enemy): boolean {
  return e.aiState === BOSS_STATE.EXAUSTO && (ORDEM as readonly string[]).includes(e.def.id);
}

/** Os três corpos que seguem o Geraldo. */
export function corposDaMatilha(world: World, lider: Enemy): Enemy[] {
  return world.enemies.active.filter((f) => f.alive && f.leader === lider.uid);
}

/** Geraldo e os três corpos, na ordem do rodízio (os que existirem). */
function matilhaInteira(world: World, lider: Enemy): Enemy[] {
  const todos = [lider, ...corposDaMatilha(world, lider)];
  return ORDEM.map((id) => todos.find((d) => d.def.id === id)).filter((d): d is Enemy => d !== undefined);
}

/** Fase da luta (1, 2 ou 3) pela fração de vida restante. */
export function faseDaLuta(frac: number): 1 | 2 | 3 {
  return frac > C.fases.dividida ? 1 : frac > C.fases.salsichao ? 2 : 3;
}

const ocupado = (d: Enemy): boolean => d.aiState === BOSS_STATE.PREPARANDO || d.aiState === BOSS_STATE.CARGA;

function vivos(world: World): Player[] {
  return world.players.filter((p) => p.hp > 0);
}

/** Ponto aleatório perto de um jogador vivo qualquer. */
function pertoDeJogador(world: World, espalhar: number): { x: number; y: number } {
  const v = vivos(world);
  const p = v[world.rng.int(0, Math.max(0, v.length - 1))];
  return { x: (p?.x ?? 0) + (world.rng.next() - 0.5) * 2 * espalhar, y: (p?.y ?? 0) + (world.rng.next() - 0.5) * 2 * espalhar };
}

/** Anda em linha reta até o ponto. Devolve true quando chegou. */
function irAte(d: Enemy, tx: number, ty: number, velocidade: number): boolean {
  const dx = tx - d.x;
  const dy = ty - d.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;
  const passo = Math.min(dist, velocidade * STEP_S);
  d.x += (dx / dist) * passo;
  d.y += (dy / dist) * passo;
  d.facing = Math.atan2(dy, dx);
  return dist <= passo;
}

/** Gira devagar para o jogador e anda atrás dele. */
function perseguir(d: Enemy, alvo: Player, vel: number): void {
  const max = d.def.turnRate * STEP_S;
  d.facing += clamp(wrapAngle(Math.atan2(alvo.y - d.y, alvo.x - d.x) - d.facing), -max, max);
  d.x += Math.cos(d.facing) * vel * STEP_S;
  d.y += Math.sin(d.facing) * vel * STEP_S;
}

function vidaMaxima(lider: Enemy): number {
  return lider.aiX || lider.hp;
}

// ---------------------------------------------------------------- vigor (fase 2)

function vigorPorCachorro(lider: Enemy): number {
  return (vidaMaxima(lider) * (C.fases.dividida - C.fases.salsichao)) / 4;
}

/**
 * Dano que um cachorro levou (chamado por damageEnemy). Na fase 2 gasta o vigor dele; sem vigor ele se deita exausto
 * e sai do rodízio de ataques por um tempo. A vida do chefe continua sendo uma só.
 */
export function danoNoCachorro(world: World, d: Enemy, amount: number): void {
  const lider = d.leader === 0 ? d : world.enemies.active.find((x) => x.uid === d.leader && x.alive);
  if (!lider || lider.def.id !== 'salsichas' || lider.aiT2 !== 2 || estaExausto(d)) return;
  d.aiW -= amount;
  if (d.aiW > 0) return;
  d.aiState = BOSS_STATE.EXAUSTO;
  d.aiT = C.vigor.exaustoS;
  spawnEffect(world, { kind: 'text', x: d.x, y: d.y - 24, life: 1.2, color: '#ffe08a', text: 'ZZZ' });
  pushMessage(world, 'Salsichas', `${NOMES[d.def.id as CachorroId] ?? d.def.name} cansou! Aproveitem!`, 2.5);
}

// ---------------------------------------------------------------- comida

function sortearComida(world: World) {
  let total = 0;
  for (const f of FOODS) total += f.weight;
  let r = world.rng.next() * total;
  for (const f of FOODS) {
    r -= f.weight;
    if (r < 0) return f;
  }
  return FOODS[0]!;
}

/** A geladeira abre de tempos em tempos e solta uma comida: o grupo e a matilha correm para ela. */
function geladeira(world: World, lider: Enemy): void {
  const g = C.comida.geladeira;
  lider.aiY -= STEP_S;
  if (lider.aiY > 0) return;
  lider.aiY = g.everyS;
  if (world.foods.active.length >= g.maxNoChao) return;
  const x = g.x + (world.rng.next() - 0.5) * 30;
  const y = g.y + 22 + world.rng.next() * 14;
  if (!spawnFood(world, sortearComida(world), x, y)) return;
  spawnEffect(world, { kind: 'ring', x: g.x, y: g.y, radius: 22, life: 0.5, color: '#bff4ff' });
  pushMessage(world, '', 'A geladeira se abriu! Corre pra comida!', 2.5);
}

/**
 * Um jogador comeu perto da matilha: os cachorros livres que estavam por perto param para farejar o lugar
 * (ficam parados, vulneráveis). Chamado por updateFoods.
 */
export function distrairMatilha(world: World, x: number, y: number): void {
  const lider = world.enemies.active.find((e) => e.alive && e.def.id === 'salsichas' && e.leader === 0);
  if (!lider) return;
  for (const d of matilhaInteira(world, lider)) {
    if (d.aiState !== BOSS_STATE.LIVRE) continue;
    if (Math.hypot(d.x - x, d.y - y) > C.comida.distractPx) continue;
    d.aiState = BOSS_STATE.AQUECENDO;
    d.aiT = C.comida.distractS;
  }
}

/** Cachorro livre sente a comida mais próxima e corre até ela. Devolve true se gastou o passo nisso. */
function procurarComida(world: World, lider: Enemy, d: Enemy): boolean {
  if (d.aiState !== BOSS_STATE.LIVRE) return false;
  let melhor: (typeof world.foods.active)[number] | undefined;
  let menor = C.comida.seekPx;
  for (const f of world.foods.active) {
    if (!f.alive) continue;
    const dist = Math.hypot(f.x - d.x, f.y - d.y);
    if (dist < menor) {
      menor = dist;
      melhor = f;
    }
  }
  if (!melhor) return false;
  if (menor <= d.def.radius + 6) {
    // Chegou primeiro: come, se cura um pouco e fica parado comendo (janela de dano).
    melhor.alive = false;
    d.aiState = BOSS_STATE.AQUECENDO;
    d.aiT = C.comida.stunS;
    lider.hp = Math.min(vidaMaxima(lider), lider.hp + vidaMaxima(lider) * C.comida.healFrac);
    pushMessage(world, 'Salsichas', 'Au! (isso é comida?)', 2.5);
    return true;
  }
  irAte(d, melhor.x, melhor.y, C.comida.corridaPx);
  return true;
}

// ---------------------------------------------------------------- ataques de cada cachorro

/** Geraldo: gira para o alvo e se prepara para soltar o trenzinho de latidos. */
function prepararTrenzinho(d: Enemy, alvo: Player): void {
  d.aiDir = Math.atan2(alvo.y - d.y, alvo.x - d.x);
  d.facing = d.aiDir;
  d.aiState = BOSS_STATE.PREPARANDO;
  d.aiT = C.trenzinho.warnS;
}

/** Monet: pinta poças de tinta em volta dos jogadores (aviso no chão, depois ficam dando dano e lentidão). */
function prepararPocas(world: World, d: Enemy, fase: number): void {
  const m = C.monet;
  const n = m.count + (fase === 3 ? C.salsichao.extraPocas : 0);
  for (let i = 0; i < n; i++) {
    const p = pertoDeJogador(world, m.scatter);
    spawnHazard(world, { x: p.x, y: p.y, radius: m.radius, delay: m.warnS, life: m.lifeS, damage: m.impact, dps: m.dps, slowFor: m.slowFor, color: '#3f7bff', sprite: 'poca_tinta' });
  }
  d.aiState = BOSS_STATE.PREPARANDO;
  d.aiT = m.warnS;
}

/** Toddy: marca uma trilha reta no chão atravessando o alvo e corre para a ponta dela. */
function prepararInvestida(world: World, d: Enemy, alvo: Player, fase: number): void {
  const t = C.toddy;
  const lado = world.rng.next() < 0.5 ? 1 : -1;
  const angulo = Math.atan2(alvo.y - d.y, alvo.x - d.x) + Math.PI / 2;
  const linhas = fase === 3 ? [angulo, angulo + Math.PI / 2] : [angulo];
  for (const a of linhas) {
    for (let i = 0; i < t.steps; i++) {
      const k = (i - (t.steps - 1) / 2) * t.stepDist;
      spawnHazard(world, { x: alvo.x + Math.cos(a) * k, y: alvo.y + Math.sin(a) * k, radius: t.radius, delay: t.warnS + i * 0.03, life: 0.35, damage: t.damage, color: '#a8672a', sprite: 'toddy_rastro' });
    }
  }
  const meio = ((t.steps - 1) / 2) * t.stepDist + 24;
  const dirX = Math.cos(angulo) * lado;
  const dirY = Math.sin(angulo) * lado;
  d.homeX = alvo.x - dirX * meio;
  d.homeY = alvo.y - dirY * meio;
  d.aiX = alvo.x + dirX * meio; // ponta final da investida (o aiX dos corpos não é usado)
  d.aiY = alvo.y + dirY * meio;
  d.aiDir = Math.atan2(dirY, dirX);
  d.aiState = BOSS_STATE.PREPARANDO;
  d.aiT = t.warnS;
}

/** Bucky: marca no chão a boca aberta sobre o grupo e corre para lá. */
function prepararMordida(world: World, d: Enemy, alvo: Player, fase: number): void {
  const b = C.bucky;
  const v = vivos(world);
  const cx = v.length > 1 ? v.reduce((s, p) => s + p.x, 0) / v.length : alvo.x;
  const cy = v.length > 1 ? v.reduce((s, p) => s + p.y, 0) / v.length : alvo.y;
  spawnHazard(world, { x: cx, y: cy, radius: b.radius + (fase === 3 ? 10 : 0), delay: b.warnS, damage: b.damage, push: b.pull, pushS: b.pullS, slowFor: b.slowFor, color: '#f2e3c6', sprite: 'mordida' });
  d.homeX = cx;
  d.homeY = cy;
  d.aiState = BOSS_STATE.PREPARANDO;
  d.aiT = b.warnS;
}

function iniciarAtaque(world: World, d: Enemy, alvo: Player, fase: number): void {
  switch (d.def.id) {
    case 'salsichas':
      prepararTrenzinho(d, alvo);
      break;
    case 'monet':
      prepararPocas(world, d, fase);
      break;
    case 'toddy':
      prepararInvestida(world, d, alvo, fase);
      break;
    default:
      prepararMordida(world, d, alvo, fase);
  }
}

/** Passo a passo do cachorro durante o aviso (corre para a posição de ataque, se for o caso). */
function emPreparo(d: Enemy): void {
  if (d.def.id === 'toddy') irAte(d, d.homeX, d.homeY, C.toddy.runSpeed);
  else if (d.def.id === 'bucky') irAte(d, d.homeX, d.homeY, C.bucky.runSpeed);
}

/** O aviso acabou: o ataque sai. */
function dispararAtaque(world: World, lider: Enemy, d: Enemy, fase: number): void {
  switch (d.def.id) {
    case 'salsichas': {
      // Cada cachorro da fila solta o seu latido (o Geraldo e os corpos que não estão ocupados).
      const fila = matilhaInteira(world, lider).filter((f) => f === d || !ocupado(f));
      const n = C.trenzinho.count + (fase === 3 ? C.salsichao.extraLatidos : 0);
      for (let i = 0; i < n; i++) {
        const b = fila[i % fila.length]!;
        spawnHostile(world, { kind: 'latido', x: b.x, y: b.y, angle: d.aiDir, speed: C.trenzinho.speed - i * 6, damage: C.trenzinho.damage, radius: 4, life: 3 });
      }
      if (fase === 3) {
        // Salsichão: o latido do líder também sai em ondas ao redor da matilha.
        const o = C.cerco;
        for (let i = 0; i < o.count; i++) {
          spawnHazard(world, { kind: 'ring', x: d.x, y: d.y, radius: 0, delay: i * o.gap, expand: o.speed, maxRadius: o.maxRadius, thickness: o.thickness, damage: o.damage, color: '#ffb347' });
        }
      }
      d.aiState = BOSS_STATE.DESCANSANDO;
      d.aiT = 0.6;
      return;
    }
    case 'toddy':
      d.x = d.homeX;
      d.y = d.homeY;
      d.facing = d.aiDir;
      d.aiState = BOSS_STATE.CARGA;
      d.aiT = C.toddy.dashS;
      return;
    default:
      d.aiState = BOSS_STATE.DESCANSANDO;
      d.aiT = 0.8;
  }
}

/** Relógios de cada cachorro (aviso, investida, descanso, comida, exaustão). */
function relogioDoCachorro(world: World, lider: Enemy, d: Enemy, fase: number): void {
  switch (d.aiState) {
    case BOSS_STATE.PREPARANDO:
      emPreparo(d);
      d.aiT -= STEP_S;
      if (d.aiT <= 0) dispararAtaque(world, lider, d, fase);
      break;
    case BOSS_STATE.CARGA: {
      d.aiT -= STEP_S;
      const t = clamp(1 - d.aiT / C.toddy.dashS, 0, 1);
      d.x = d.homeX + (d.aiX - d.homeX) * t;
      d.y = d.homeY + (d.aiY - d.homeY) * t;
      if (d.aiT <= 0) {
        d.aiState = BOSS_STATE.DESCANSANDO;
        d.aiT = 0.8;
      }
      break;
    }
    case BOSS_STATE.DESCANSANDO:
    case BOSS_STATE.AQUECENDO:
      d.aiT -= STEP_S;
      if (d.aiT <= 0) {
        d.aiState = BOSS_STATE.LIVRE;
        if (fase === 2 || d !== lider) d.aiCd = 1; // o aiCd do Geraldo é o relógio do rodízio nas fases 1 e 3
      }
      break;
    case BOSS_STATE.EXAUSTO:
      d.aiT -= STEP_S;
      if (d.aiT <= 0) {
        d.aiState = BOSS_STATE.LIVRE;
        d.aiW = vigorPorCachorro(lider) * C.vigor.volta;
        if (fase === 2 || d !== lider) d.aiCd = 1.5;
      }
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------- fases

function mudarDeFase(world: World, lider: Enemy, matilha: Enemy[], fase: 1 | 2 | 3): void {
  const primeira = lider.aiT2 === 0;
  lider.aiT2 = fase;
  if (primeira) lider.aiY = C.comida.geladeira.firstS;
  if (fase === 1) return;
  if (fase === 2) {
    pushMessage(world, 'Salsichas', 'A matilha se separou! Cada um por si!', 3.5);
    matilha.forEach((d, i) => {
      if (d.aiState !== BOSS_STATE.AQUECENDO) d.aiState = BOSS_STATE.LIVRE;
      d.aiW = vigorPorCachorro(lider);
      d.aiCd = 1.5 + i * C.divisao.stagger;
    });
  } else {
    pushMessage(world, 'Salsichas', 'Os quatro estão se fundindo...', 3);
    // Começa a fusão: ninguém ataca; os três corpos guardam de onde saíram para correr até o Geraldo.
    for (const d of matilha) {
      d.aiState = BOSS_STATE.LIVRE;
      d.homeX = d.x;
      d.homeY = d.y;
    }
    lider.aiW = C.salsichao.fusaoS; // aqui o aiW do líder é o relógio da fusão (na fase 2 era o vigor)
    lider.aiCd = 2;
  }
  spawnEffect(world, { kind: 'ring', x: lider.x, y: lider.y, radius: 60, life: 0.6, color: '#ffd27a' });
}

/** O Salsichão já nasceu? (fase 3 e a animação de fusão acabou): aí os quatro viram um sprite só. */
export function salsichaoFundido(lider: Enemy): boolean {
  return lider.def.id === 'salsichas' && lider.leader === 0 && lider.aiT2 === 3 && lider.aiW <= 0;
}

/** Lado para onde o Salsichão olha (1 = direita, -1 = esquerda): o sprite é espelhado igual. */
function ladoDoSalsichao(lider: Enemy): 1 | -1 {
  return Math.cos(lider.facing) >= 0 ? 1 : -1;
}

/** Onde cada corpo fica dentro do Salsichão: em linha horizontal, embaixo do sprite. */
function lugarNoSalsichao(lider: Enemy, i: number): { x: number; y: number } {
  const off = C.salsichao.offsets[i] ?? 0;
  return { x: lider.x + off * ladoDoSalsichao(lider), y: lider.y };
}

/**
 * Animação de fusão: os três corpos correm até o Geraldo girando em espiral, soltando faíscas, e no fim há um clarão
 * e o Salsichão aparece. Durante ela ninguém ataca.
 */
function fundir(world: World, lider: Enemy): void {
  const F = C.salsichao.fusaoS;
  const antes = lider.aiW;
  lider.aiW = Math.max(lider.aiW - STEP_S, -C.salsichao.clarao);
  const t = clamp(1 - lider.aiW / F, 0, 1);
  const ease = t * t * (3 - 2 * t);
  corposDaMatilha(world, lider).forEach((f, i) => {
    const alvo = lugarNoSalsichao(lider, i);
    // Linha reta até o destino mais um balanço em espiral que some no fim.
    const giro = (1 - ease) * Math.sin(t * Math.PI * 3 + i * 2.1) * 34;
    const ang = Math.atan2(alvo.y - f.homeY, alvo.x - f.homeX) + Math.PI / 2;
    f.x = f.homeX + (alvo.x - f.homeX) * ease + Math.cos(ang) * giro;
    f.y = f.homeY + (alvo.y - f.homeY) * ease + Math.sin(ang) * giro;
    f.facing = Math.atan2(lider.y - f.y, lider.x - f.x);
  });
  // Faíscas em anéis que ficam mais frequentes e perto do fim.
  if (antes > 0 && Math.floor(t * 8) !== Math.floor(clamp(1 - antes / F, 0, 1) * 8)) {
    spawnEffect(world, { kind: 'ring', x: lider.x, y: lider.y, radius: 18 + 40 * t, life: 0.35, color: '#ffd27a' });
  }
  if (antes > 0 && lider.aiW <= 0) {
    // Clarão final: o Salsichão nasce.
    spawnEffect(world, { kind: 'ring', x: lider.x, y: lider.y, radius: 90, life: 0.6, color: '#ffffff' });
    spawnEffect(world, { kind: 'text', x: lider.x, y: lider.y - 44, life: 1.6, color: '#ffe08a', text: 'SALSICHÃO!' });
    pushMessage(world, 'Salsichas', 'Os quatro viraram um SALSICHÃO!', 3.5);
    for (const f of corposDaMatilha(world, lider)) f.aiCd = 0;
  }
}

/** Fases 1 e 3: a matilha anda em fila atrás do Geraldo e ataca em rodízio (na fase 3, dois ataques combinados). */
function matilhaUnida(world: World, lider: Enemy, matilha: Enemy[], alvo: Player, vel: number, fase: 1 | 3): void {
  const espaco = 40;
  const velocidade = vel * (fase === 3 ? C.salsichao.speedMul : 1);
  if (fase === 3 && lider.aiW > 0) return; // fusão em andamento: ninguém anda sozinho nem ataca
  // Geraldo anda atrás do jogador (ou corre para a comida) enquanto está livre.
  if (lider.aiState === BOSS_STATE.LIVRE && !procurarComida(world, lider, lider)) perseguir(lider, alvo, velocidade);
  // Os corpos seguem em fila (no Salsichão ficam embaixo do sprite); quem está atacando ou correndo atrás de comida faz o seu próprio movimento.
  corposDaMatilha(world, lider).forEach((f, i) => {
    f.stun = lider.stun;
    const segue = f.aiState === BOSS_STATE.LIVRE || f.aiState === BOSS_STATE.DESCANSANDO || (f.aiState === BOSS_STATE.PREPARANDO && f.def.id === 'monet');
    if (f.aiState === BOSS_STATE.LIVRE && procurarComida(world, lider, f)) return;
    if (!segue) return;
    if (fase === 3) {
      const lugar = lugarNoSalsichao(lider, i);
      f.x += (lugar.x - f.x) * 0.35;
      f.y += (lugar.y - f.y) * 0.35;
    } else {
      f.x += (lider.x - Math.cos(lider.facing) * (i + 1) * espaco - f.x) * 0.25;
      f.y += (lider.y - Math.sin(lider.facing) * (i + 1) * espaco - f.y) * 0.25;
    }
    f.facing = lider.facing;
  });
  // Quem começa o próximo ataque: o próximo do rodízio que estiver livre.
  lider.aiCd -= STEP_S;
  if (lider.aiCd > 0 || matilha.some(ocupado)) return;
  const quantos = fase === 3 ? C.salsichao.combo : 1;
  let iniciados = 0;
  for (let k = 0; k < matilha.length && iniciados < quantos; k++) {
    const d = matilha[(lider.aiCount + k) % matilha.length]!;
    if (d.aiState !== BOSS_STATE.LIVRE) continue;
    iniciarAtaque(world, d, alvo, fase);
    iniciados++;
  }
  if (iniciados === 0) return;
  lider.aiCount += iniciados;
  lider.aiCd = C.cooldown * (fase === 3 ? C.salsichao.cooldownMul : 1);
}

/** Fase 2: cada cachorro rodeia os jogadores e ataca com o seu próprio relógio. */
function matilhaDividida(world: World, matilha: Enemy[], alvo: Player, vel: number): void {
  matilha.forEach((d, i) => {
    if (d.aiState !== BOSS_STATE.LIVRE) return;
    if (procurarComida(world, matilha[0]!, d)) return;
    const a = (i / matilha.length) * Math.PI * 2 + world.tick * 0.004;
    irAte(d, alvo.x + Math.cos(a) * C.divisao.orbit, alvo.y + Math.sin(a) * C.divisao.orbit, Math.max(vel, C.divisao.speed));
    d.aiCd -= STEP_S;
    if (d.aiCd > 0) return;
    iniciarAtaque(world, d, alvo, 2);
    d.aiCd = C.divisao.cooldown;
  });
}

/** Atualiza a luta inteira. Roda uma vez por passo, a partir do Geraldo (os corpos não têm IA própria). */
export function atualizarSalsichas(world: World, lider: Enemy, alvo: Player, vel: number, frac: number): void {
  if (!lider.alive) return; // o líder caiu neste passo: não há mais luta
  const matilha = matilhaInteira(world, lider);
  for (const f of corposDaMatilha(world, lider)) f.hp = lider.hp; // os corpos mostram a vida do líder
  const fase = faseDaLuta(frac);
  if (lider.aiT2 !== fase) mudarDeFase(world, lider, matilha, fase);
  geladeira(world, lider);
  for (const d of matilha) relogioDoCachorro(world, lider, d, fase);
  if (fase === 3 && lider.aiW > -C.salsichao.clarao) fundir(world, lider);
  if (fase === 2) matilhaDividida(world, matilha, alvo, vel);
  else matilhaUnida(world, lider, matilha, alvo, vel, fase);
}

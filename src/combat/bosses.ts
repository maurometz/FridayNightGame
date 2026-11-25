import { MAX_ENEMIES, PLAYER_INVULN_S, STEP_S } from '../data/balance';
import { onPlayerHit } from '../characters/kitHooks';
import { pushOutOfWalls } from '../engine/walls';
import {
  ADVICE_OPTIONS,
  ALE_CFG,
  CHRISTOPHER_CFG,
  JUNINHO_CFG,
  LUCAS_LINHA_FINAL,
  RM_CFG,
  TEMPO_CFG,
  TIAGOW_CFG,
} from '../data/bosses';
import { AZULETES, COMUNS, SALSICHAS_CORPOS, type EnemyDef } from '../data/enemies';
import type { Enemy } from '../entities/enemy';
import { createPlayer, type Player } from '../entities/player';
import { clamp, wrapAngle } from '../engine/math';
import { CONVIDADA_SLOT, type World } from '../engine/world';
import { spawnEffect } from './effects';
import { hitPlayer } from './teamEffects';
import { spawnHazard, spawnHostile } from './hostile';
import { pushMessage } from './messages';
import { spawnEnemy } from './spawner';
import { BOSS_STATE } from './bossState';
import { atualizarSalsichas } from './salsichas';
import { atualizarAzuletes, COR_CRONOGRAMA, faseDoJuninho, horaExtra } from './azuletes';
import {
  atualizarAtencao,
  atualizarBirra,
  atualizarEsconde,
  atualizarPique,
  atualizarRegra,
  brinquedos,
  esconderIniciar,
  estaAnimado,
  faseDoChristopher,
  iniciarBirra,
  iniciarRegra,
  piqueIniciar,
  REGRA,
} from './christopher';

// Os chefes da campanha (GDD A.7, LORE seção 10). Cada ataque é telegrafado com pelo menos 1 s de
// antecedência (data/bosses.ts): brilho no corpo, aviso no chão ou pausa antes de disparar.

const comum = (id: string): EnemyDef => COMUNS.find((d) => d.id === id)!;

export { BOSS_STATE };

/** Chefe vivo em campo, se houver (o primeiro encontrado). */
export function chefeVivo(world: World): Enemy | undefined {
  // Os corpos das Salsichas (leader != 0) não contam: o chefe é o líder.
  return world.enemies.active.find((e) => e.alive && e.def.boss && e.leader === 0);
}

/** Cria o chefe `def` a uma distância confortável do jogador. */
export function spawnBoss(world: World, def: EnemyDef): Enemy | null {
  // Teto de 300: se estiver cheio, abre espaço removendo um inimigo comum (sem drops).
  if (world.enemies.size >= MAX_ENEMIES) {
    const c = world.enemies.active.find((e) => !e.def.boss);
    if (c) world.enemies.release(c);
  }
  const alvo = world.players.find((p) => p.hp > 0) ?? world.players[0];
  const ang = world.rng.next() * Math.PI * 2;
  const x = (alvo?.x ?? 0) + Math.cos(ang) * 170;
  const y = (alvo?.y ?? 0) + Math.sin(ang) * 170;
  if (!spawnEnemy(world, def, x, y)) return null;
  const e = world.enemies.active[world.enemies.active.length - 1]!;
  e.aiX = e.hp; // vida máxima
  e.aiCd = 2;
  e.aiState = BOSS_STATE.LIVRE;
  e.aiCount = 0;
  e.aiDir = 0;
  e.aiT2 = 0;
  if (def.id === 'salsichas') {
    // Monet, Toddy e Bucky: três corpos atrás do Geraldo, todos na mesma barra de vida.
    SALSICHAS_CORPOS.forEach((corpo, i) => {
      if (!spawnEnemy(world, corpo, x - (i + 1) * 40, y)) return;
      const f = world.enemies.active[world.enemies.active.length - 1]!;
      f.leader = e.uid;
      f.hp = e.hp;
      f.aiX = e.aiX;
    });
  }
  if (def.id === 'christopher') e.aiW = CHRISTOPHER_CFG.atencao.inicio; // começa com atenção média
  if (def.id === 'juninho') {
    // Mariana e Melina: dois corpos que seguem o Juninho e dividem a vida dele.
    AZULETES.forEach((azulete, i) => {
      if (!spawnEnemy(world, azulete, x + (i === 0 ? -48 : 48), y + 18)) return;
      const f = world.enemies.active[world.enemies.active.length - 1]!;
      f.leader = e.uid;
      f.hp = e.hp;
      f.aiX = e.aiX;
      f.aiCd = i === 0 ? 4 : 2;
      f.aiT2 = i === 1 ? 3 : 0; // Melina só bota o primeiro escudo depois de alguns segundos
    });
  }
  pushMessage(world, '', `Aviso de chefe: ${def.name}`, 4);
  return e;
}

function maisProximoVivo(world: World, x: number, y: number): Player | undefined {
  let melhor: Player | undefined;
  let d = Infinity;
  for (const p of world.players) {
    if (p.hp <= 0) continue;
    const dd = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (dd < d) {
      d = dd;
      melhor = p;
    }
  }
  return melhor;
}

function vivos(world: World): Player[] {
  return world.players.filter((p) => p.hp > 0);
}

/** Ponto aleatório perto de um jogador vivo qualquer. */
function pertoDeJogador(world: World, espalhar: number): { x: number; y: number } {
  const v = vivos(world);
  const p = v[world.rng.int(0, Math.max(0, v.length - 1))];
  return {
    x: (p?.x ?? 0) + (world.rng.next() - 0.5) * 2 * espalhar,
    y: (p?.y ?? 0) + (world.rng.next() - 0.5) * 2 * espalhar,
  };
}

/** Anda devagar até o jogador (quando não está atacando). */
function perseguir(e: Enemy, alvo: Player, vel: number): void {
  const max = e.def.turnRate * STEP_S;
  e.facing += clamp(wrapAngle(Math.atan2(alvo.y - e.y, alvo.x - e.x) - e.facing), -max, max);
  e.x += Math.cos(e.facing) * vel * STEP_S;
  e.y += Math.sin(e.facing) * vel * STEP_S;
}

/** Leque de projéteis na direção do alvo. */
function leque(world: World, e: Enemy, alvo: Player, kind: 'pipoca' | 'pedra' | 'notificacao' | 'formulario' | 'latido' | 'tinta' | 'email', count: number, spreadDeg: number, speed: number, damage: number): void {
  const base = Math.atan2(alvo.y - e.y, alvo.x - e.x);
  const spread = (spreadDeg * Math.PI) / 180;
  for (let i = 0; i < count; i++) {
    const a = count === 1 ? base : base + (i - (count - 1) / 2) * (spread / (count - 1));
    spawnHostile(world, { kind, x: e.x, y: e.y, angle: a, speed, damage, radius: 3, life: 3 });
  }
}

/** Avança o ciclo de um chefe "ataca, descansa, volta a andar". Devolve true quando está pronto para atacar. */
function prontoParaAtacar(e: Enemy, alvo: Player, vel: number): boolean {
  if (e.aiState !== BOSS_STATE.LIVRE) return false;
  perseguir(e, alvo, vel);
  e.aiCd -= STEP_S;
  return e.aiCd <= 0;
}

function terminarAtaque(e: Enemy, descansoS: number): void {
  e.aiState = BOSS_STATE.DESCANSANDO;
  e.aiT = descansoS;
}

/** Conta o descanso e volta ao estado livre. Devolve true no passo em que o descanso termina. */
function descansando(e: Enemy, cooldown: number): boolean {
  if (e.aiState !== BOSS_STATE.DESCANSANDO) return false;
  e.aiT -= STEP_S;
  if (e.aiT > 0) return false;
  e.aiState = BOSS_STATE.LIVRE;
  e.aiCd = cooldown;
  return true;
}

// ---------------------------------------------------------------------------------------------
// FASE 1: As Salsichas (a luta inteira está em salsichas.ts)

// ---------------------------------------------------------------------------------------------
// FASE 3: Juninho e as Azuletes

function juninho(world: World, e: Enemy, alvo: Player, vel: number, frac: number): void {
  const c = JUNINHO_CFG;
  const fase = faseDoJuninho(frac);
  atualizarAzuletes(world, e, fase);
  if (descansando(e, c.cooldownFase[fase - 1]!)) return;
  if (!prontoParaAtacar(e, alvo, vel)) return;
  e.aiCount++;
  const n = e.aiCount;
  switch (n % 4) {
    case 1: {
      // Drones: lasers nas posições dos jogadores (aviso de 1,4 s). Na fase 3, em dobro (o segundo ao lado).
      for (const p of vivos(world)) {
        spawnHazard(world, { x: p.x, y: p.y, radius: c.lasers.radius, delay: c.lasers.warnS, damage: c.lasers.damage, color: '#4db3ff', sprite: 'laser_drone' });
        if (fase === 3) spawnHazard(world, { x: p.x + 34, y: p.y - 18, radius: c.lasers.radius, delay: c.lasers.warnS + 0.3, damage: c.lasers.damage, color: '#4db3ff', sprite: 'laser_drone' });
      }
      break;
    }
    case 2:
      zonasDeCronograma(world);
      break;
    case 3:
      // Notificação de e-mail: leque de projéteis curtos.
      leque(world, e, alvo, 'email', c.email.count, c.email.spreadDeg, c.email.speed, c.email.damage);
      break;
    default:
      // Reunião obrigatória: puxa todo mundo para perto do Juninho. Na fase 3 vem com "hora extra" e cronograma.
      reuniaoObrigatoria(world, e);
      if (fase === 3) {
        zonasDeCronograma(world);
        horaExtra(world, e);
      }
  }
  terminarAtaque(e, 1.4);
}

/** Zonas de cronograma: lentidão no chão. Quando o prazo acaba, cada zona explode. */
function zonasDeCronograma(world: World): void {
  const c = JUNINHO_CFG.cronograma;
  for (let i = 0; i < c.count; i++) {
    const p = pertoDeJogador(world, c.scatter);
    spawnHazard(world, { x: p.x, y: p.y, radius: c.radius, delay: c.warnS, life: c.lifeS, damage: c.impact, slowFor: c.slowFor, color: COR_CRONOGRAMA, sprite: 'cronograma' });
    spawnHazard(world, { x: p.x, y: p.y, radius: c.radius, delay: c.warnS + c.lifeS, damage: c.prazoDamage, color: '#ff6a5a', sprite: 'prazo_explosao' });
  }
}

/** Reunião obrigatória: círculo grande que puxa para o centro (no Juninho) e deixa lento. */
function reuniaoObrigatoria(world: World, e: Enemy): void {
  const r = JUNINHO_CFG.reuniao;
  pushMessage(world, 'Juninho', 'Reunião obrigatória. Todo mundo aqui.', 2.5);
  spawnHazard(world, { x: e.x, y: e.y, radius: r.radius, delay: r.warnS, damage: r.damage, push: r.pull, pushS: r.pullS, slowFor: r.slowFor, color: '#6ea8ff', sprite: 'reuniao' });
}

// ---------------------------------------------------------------------------------------------
// FASE 4: RM e o transe da Melissa

/**
 * Quem o RM encanta: a Melissa, se ela está na partida (e viva). Se ela não está, aparece uma Melissa convidada,
 * só para esta luta: o RM nunca encanta outro jogador.
 */
function escolherEncantado(world: World): Player | undefined {
  const mel = world.players.find((p) => p.kit?.type === 'melissa');
  if (mel) return mel.hp > 0 ? mel : undefined;
  return convidadaDaLuta(world);
}

/** Quem está encantado agora (a Melissa jogadora/companheira ou a convidada), se houver. */
export function encantadaAtual(world: World): Player | undefined {
  const t = world.trance;
  if (!t) return undefined;
  return t.slot === CONVIDADA_SLOT ? (world.convidada ?? undefined) : world.players[t.slot];
}

/** O jogador `p` está em transe (perdeu o controle e ataca o próprio time)? */
export function emTranse(world: World, p: Player): boolean {
  return !!world.trance?.caught && world.trance.slot === p.slot;
}

/** A Melissa convidada: cria perto dos jogadores vivos (do lado oposto ao RM) na primeira vez que é preciso. */
function convidadaDaLuta(world: World): Player | undefined {
  if (world.convidada) return world.convidada;
  const perto = vivos(world)[0];
  if (!perto) return undefined;
  const rm = world.enemies.active.find((en) => en.alive && en.def.id === 'rm');
  const ang = rm ? Math.atan2(perto.y - rm.y, perto.x - rm.x) : 0;
  const c = createPlayer(CONVIDADA_SLOT, 'melissa', perto.x + Math.cos(ang) * 60, perto.y + Math.sin(ang) * 60);
  if (world.walls.length > 0) {
    const r = pushOutOfWalls(world.walls, c.x, c.y, 5);
    c.x = c.prevX = r.x;
    c.y = c.prevY = r.y;
  }
  c.invuln = 0;
  world.convidada = c;
  pushMessage(world, '', 'Melissa chegou para o palco do RM!', 3);
  return c;
}

/**
 * Melissa em transe (a convidada ou uma jogadora/companheira que perdeu o controle): deixa o lado do RM, persegue o aliado
 * mais próximo e o golpeia de perto (além das notificações à distância). O transe só acaba quando a equipe esvazia a barra.
 */
function emTranseAtaca(world: World, rm: Enemy, c: Player): void {
  const cfg = RM_CFG.convidada;
  c.weaponCd = Math.max(0, c.weaponCd - STEP_S);
  let alvo: Player | undefined;
  let melhor = Infinity;
  for (const p of vivos(world)) {
    if (p === c) continue;
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d < melhor) {
      melhor = d;
      alvo = p;
    }
  }
  if (!alvo) return;
  if (melhor > cfg.reach * 0.8) {
    const a = Math.atan2(alvo.y - c.y, alvo.x - c.x);
    c.x += Math.cos(a) * cfg.speed * STEP_S;
    c.y += Math.sin(a) * cfg.speed * STEP_S;
    c.moving = true;
    c.facing = Math.cos(a) >= 0 ? 1 : -1;
    // Presa ao RM por uma coleira: não vai longe demais dele.
    const dr = Math.hypot(c.x - rm.x, c.y - rm.y);
    if (dr > cfg.leash) {
      c.x = rm.x + ((c.x - rm.x) / dr) * cfg.leash;
      c.y = rm.y + ((c.y - rm.y) / dr) * cfg.leash;
    }
    if (world.walls.length > 0) {
      const r = pushOutOfWalls(world.walls, c.x, c.y, 5);
      c.x = r.x;
      c.y = r.y;
    }
  }
  // Golpe de florete no aliado encostado.
  if (melhor <= cfg.reach + 6 && c.weaponCd <= 0) {
    c.weaponCd = cfg.hitCooldownS;
    if (alvo.invuln <= 0) {
      hitPlayer(world, alvo, cfg.hitDamage);
      alvo.invuln = PLAYER_INVULN_S;
      onPlayerHit(alvo);
    }
    const ang = Math.atan2(alvo.y - c.y, alvo.x - c.x);
    spawnEffect(world, { kind: 'arc', x: c.x, y: c.y - 8, radius: cfg.reach, angle: ang, halfArc: 1, life: 0.16, color: '#c78bff', sprite: 'melissaArco' });
  }
}

/**
 * Logo depois que o transe quebra, a Melissa convidada fica desnorteada no lugar (tontinha, sem se mexer) e depois anda
 * devagar para longe do RM. Só um pouquinho: o feixe do próximo encanto a puxa de volta de qualquer distância.
 */
function convidadaSolta(world: World, rm: Enemy): void {
  const c = world.convidada;
  if (!c) return;
  const cfg = RM_CFG.convidada;
  const decorrido = RM_CFG.descansoS - rm.aiT2;
  c.prevX = c.x;
  c.prevY = c.y;
  if (decorrido < cfg.desnorteadaS) {
    c.confusedLeft = cfg.desnorteadaS - decorrido;
    c.moving = false;
    return;
  }
  c.confusedLeft = 0;
  const dx = c.x - rm.x;
  const dy = c.y - rm.y;
  const d = Math.hypot(dx, dy) || 1;
  c.x += (dx / d) * cfg.andarSpeed * STEP_S;
  c.y += (dy / d) * cfg.andarSpeed * STEP_S;
  c.moving = true;
  c.facing = dx >= 0 ? 1 : -1;
  if (world.walls.length > 0) {
    const r = pushOutOfWalls(world.walls, c.x, c.y, 5);
    c.x = r.x;
    c.y = r.y;
  }
}

/** Fora do transe, a Melissa convidada acompanha o grupo de perto (para dar para alcançá-la e protegê-la). */
function convidadaSegue(world: World): void {
  const c = world.convidada;
  if (!c) return;
  c.confusedLeft = 0;
  let alvo: Player | undefined;
  let melhor = Infinity;
  for (const p of vivos(world)) {
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d < melhor) {
      melhor = d;
      alvo = p;
    }
  }
  c.prevX = c.x;
  c.prevY = c.y;
  c.moving = false;
  if (!alvo || melhor < 56) return;
  const a = Math.atan2(alvo.y - c.y, alvo.x - c.x);
  c.x += Math.cos(a) * 60 * STEP_S;
  c.y += Math.sin(a) * 60 * STEP_S;
  c.moving = true;
  c.facing = Math.cos(a) >= 0 ? 1 : -1;
}

/** Dreno do transe neste passo: passivo, aura da Thayssa, toque dos aliados e Pausa Dramática. */
function drenoDoTranse(world: World, p: Player): number {
  const c = RM_CFG.trance;
  let dreno = c.passiveDrain;
  for (const o of world.players) {
    if (o === p || o.hp <= 0) continue;
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (o.kit?.type === 'thayssa' && d < c.thayssaRadius) dreno += c.thayssaDrain;
    if (d < c.touchRadius) dreno += c.touchDrain;
  }
  if (world.synergy.active.some((u) => u.id === 'pausa')) dreno += c.pausaDrain;
  return dreno;
}

/**
 * Onda de aplausos: com aliados colados na Melissa (segurando-a contra o feixe), o RM solta uma onda em volta dela, depois de
 * um aviso no chão, que empurra os aliados para longe. Assim não dá para ficar segurando-a para sempre.
 */
function ondaDeAplausos(world: World, rm: Enemy, mel: Player): void {
  const o = RM_CFG.onda;
  const colados = world.players.some((q) => q !== mel && q.hp > 0 && Math.hypot(q.x - mel.x, q.y - mel.y) < o.nearPx);
  if (!colados) return;
  rm.aiW -= STEP_S;
  if (rm.aiW > 0) return;
  rm.aiW = o.everyS;
  spawnHazard(world, { x: mel.x, y: mel.y, radius: o.radius, delay: o.warnS, damage: o.damage, push: o.push, pushS: o.pushS, color: '#d79bff', sprite: 'rm_onda' });
}

/** Feixe de encanto e transe. Roda a cada passo enquanto o RM está em campo. */
function encanto(world: World, e: Enemy): void {
  const c = RM_CFG;
  let t = world.trance;
  if (!t) {
    if (e.aiT2 > 0) {
      e.aiT2 -= STEP_S;
      convidadaSolta(world, e);
      return;
    }
    const p = escolherEncantado(world);
    if (!p) {
      convidadaSegue(world);
      return;
    }
    t = world.trance = { slot: p.slot, meter: c.trance.max, caught: false };
    e.aiW = c.onda.everyS;
    p.confusedLeft = 0;
    pushMessage(world, 'RM', 'Melissa, o palco é seu.', 3);
  }
  const p = t.slot === CONVIDADA_SLOT ? world.convidada : world.players[t.slot];
  if (!p || (t.slot !== CONVIDADA_SLOT && p.hp <= 0)) {
    world.trance = null;
    return;
  }
  if (t.slot === CONVIDADA_SLOT) {
    p.prevX = p.x;
    p.prevY = p.y;
    p.moving = false;
  }
  if (!t.caught) {
    // Puxada pelo feixe. Um aliado encostado a segura (a puxa de volta).
    const aliadoPerto = world.players.some((o) => o !== p && o.hp > 0 && Math.hypot(o.x - p.x, o.y - p.y) < c.trance.touchRadius);
    p.moving = !aliadoPerto;
    ondaDeAplausos(world, e, p);
    const a = Math.atan2(e.y - p.y, e.x - p.x);
    const sinal = aliadoPerto ? -0.6 : 1;
    p.x += Math.cos(a) * c.pullSpeed * sinal * STEP_S;
    p.y += Math.sin(a) * c.pullSpeed * sinal * STEP_S;
    if (Math.hypot(e.x - p.x, e.y - p.y) < c.catchPx) {
      t.caught = true;
      t.meter = c.trance.max;
      e.aiY = c.corruptEveryS;
      pushMessage(world, '', 'Em transe! Quebrem o encanto!', 3.5);
    }
    return;
  }
  // Em transe: a barra esvazia pelos meios não letais; enquanto isso ela ataca o próprio time.
  t.meter -= drenoDoTranse(world, p) * STEP_S;
  emTranseAtaca(world, e, p);
  e.aiT2 = 0;
  e.aiY -= STEP_S;
  if (e.aiY <= 0) {
    e.aiY = c.corruptEveryS;
    const alvo = world.players.filter((o) => o !== p && o.hp > 0).sort((x, y) => Math.hypot(x.x - p.x, x.y - p.y) - Math.hypot(y.x - p.x, y.y - p.y))[0];
    if (alvo) {
      // Sai um pouco à frente dela, para a notificação não acertar a própria Melissa (quando ela é uma jogadora).
      const ang = Math.atan2(alvo.y - p.y, alvo.x - p.x);
      spawnHostile(world, { kind: 'notificacao', x: p.x + Math.cos(ang) * 12, y: p.y + Math.sin(ang) * 12, angle: ang, speed: 95, damage: c.corruptDamage, radius: 3, life: 2.5 });
    }
  }
  if (t.meter <= 0) {
    world.trance = null;
    e.aiT2 = c.descansoS; // descansa antes de encantar de novo
    pushMessage(world, '', 'O transe quebrou! De volta ao Comitê.', 3.5);
  }
}

function rm(world: World, e: Enemy, alvo: Player, vel: number): void {
  const c = RM_CFG;
  encanto(world, e);
  if (descansando(e, c.cooldown)) return;
  // Com alguém em transe (preso ao RM), ele fica parado cantando; senão, persegue devagar.
  if (world.trance?.caught) return;
  if (!prontoParaAtacar(e, alvo, vel)) return;
  e.aiCount++;
  // Holofotes de palco com aviso no chão.
  for (let i = 0; i < c.holofotes.count; i++) {
    const p = pertoDeJogador(world, c.holofotes.scatter);
    spawnHazard(world, { x: p.x, y: p.y, radius: c.holofotes.radius, delay: c.holofotes.warnS, damage: c.holofotes.damage, color: '#d79bff', sprite: 'holofote_rm' });
  }
  terminarAtaque(e, c.holofotes.warnS + 0.3);
}

// ---------------------------------------------------------------------------------------------
// FASE 5: Christopher

/** Rodízio de ataques do Christopher por fase. */
const ROTACAO_CHRIS: readonly (readonly ('brinquedos' | 'pique' | 'esconde' | 'birra')[])[] = [
  ['brinquedos', 'pique'],
  ['pique', 'brinquedos', 'esconde'],
  ['esconde', 'pique', 'birra', 'brinquedos'],
];

function christopher(world: World, e: Enemy, alvo: Player, vel: number, frac: number): void {
  const c = CHRISTOPHER_CFG;
  const fase = faseDoChristopher(frac);
  if (e.aiT2 !== fase) {
    if (e.aiT2 !== 0) pushMessage(world, 'Christopher', fase === 2 ? 'Hora do doce! Quero mais! Quero mais!' : 'CHEGA! EU QUERO TUDO!', 3);
    e.aiT2 = fase;
  }
  // Efeitos que rodam em paralelo aos ataques: regra da arena e marca do pique-pega.
  atualizarRegra(world, e);
  atualizarPique(world, e);
  if (atualizarEsconde(world, e)) return;
  if (atualizarBirra(world, e)) return;
  atualizarAtencao(world, e);
  if (e.aiW <= 0 && (e.aiState === BOSS_STATE.LIVRE || e.aiState === BOSS_STATE.DESCANSANDO)) {
    iniciarBirra(world, e, fase);
    return;
  }
  const cooldown = c.cooldownFase[fase - 1]! * (estaAnimado(e) ? c.atencao.animadoCooldownMul : 1);
  if (descansando(e, cooldown)) return;
  if (!prontoParaAtacar(e, alvo, vel * (fase >= 2 ? c.doceVelMul : 1))) return;
  e.aiCount++;
  const lista = ROTACAO_CHRIS[fase - 1]!;
  let ataque = lista[(e.aiCount - 1) % lista.length]!;
  // O pique-pega precisa de aliados e não cabe com outra marca ou com o esconde-esconde: cai para a chuva de brinquedos.
  if (ataque === 'pique' && (e.aiU >= 0 || !piqueIniciar(world, e))) ataque = 'brinquedos';
  if (ataque === 'esconde' && (e.aiU >= 0 || !esconderIniciar(world, e))) ataque = 'brinquedos';
  if (ataque === 'brinquedos') brinquedos(world, fase);
  else if (ataque === 'birra') iniciarBirra(world, e, fase);
  if (e.aiDir === REGRA.NENHUMA && e.aiCount % c.regras.every[fase - 1]! === 0) iniciarRegra(world, e);
  if (ataque === 'esconde' || ataque === 'birra') return; // esses cuidam do próprio estado
  terminarAtaque(e, 1.3);
}

// ---------------------------------------------------------------------------------------------
// FASE 6: Alê

/** Posições dos jogadores no começo da janela do apito. */
const posApito = new Map<number, { x: number; y: number }>();

function ale(world: World, e: Enemy, alvo: Player, vel: number): void {
  const c = ALE_CFG;
  // Reação às Cruzes do Djanho (Galeria do Mauro): ele surta e fica atordoado no começo da luta.
  if (!e.aiT2 && world.collected.includes('cruzes')) {
    e.aiT2 = 1;
    e.stun = Math.max(e.stun, ALE_CFG.cruzes.stunS);
    pushMessage(world, 'Alê', 'AS CRUZES DO DJANHO?! Isso não estava no cronograma!', 4);
  }
  if (e.aiState === BOSS_STATE.AQUECENDO) {
    // Aviso do apito.
    e.aiT -= STEP_S;
    if (e.aiT <= 0) {
      e.aiState = BOSS_STATE.PREPARANDO;
      e.aiT = c.apito.windowS;
      posApito.clear();
      for (const p of world.players) posApito.set(p.slot, { x: p.x, y: p.y });
      pushMessage(world, 'Alê', 'PARAR!', 1.5);
      spawnEffect(world, { kind: 'ring', x: e.x, y: e.y - 20, radius: 22, life: c.apito.windowS, color: '#ffd24d', sprite: 'apito' });
    }
    return;
  }
  if (e.aiState === BOSS_STATE.PREPARANDO) {
    // Janela do "parar": quem se mexer leva dano.
    e.aiT -= STEP_S;
    for (const p of world.players) {
      if (p.hp <= 0 || p.invuln > 0) continue;
      const o = posApito.get(p.slot);
      if (o && Math.hypot(p.x - o.x, p.y - o.y) > c.apito.movePx) {
        spawnHazard(world, { x: p.x, y: p.y, radius: 10, delay: 0.01, damage: c.apito.damage, color: '#ffd24d' });
        posApito.set(p.slot, { x: p.x, y: p.y });
      }
    }
    if (e.aiT <= 0) terminarAtaque(e, 0.8);
    return;
  }
  if (descansando(e, c.cooldown)) return;
  if (!prontoParaAtacar(e, alvo, vel)) return;
  e.aiCount++;
  const n = e.aiCount % 3;
  if (n === 1) {
    // Apito: aviso de 1,5 s (o chefe pisca), depois a janela de "parar".
    pushMessage(world, 'Alê', 'Atenção! Vou apitar!', 2);
    e.aiState = BOSS_STATE.AQUECENDO;
    e.aiT = c.apito.warnS;
  } else if (n === 2) {
    // Cronograma rígido: fila de perigos em linha na direção do alvo.
    const a = Math.atan2(alvo.y - e.y, alvo.x - e.x);
    for (let i = 1; i <= c.fila.count; i++) {
      spawnHazard(world, { x: e.x + Math.cos(a) * i * c.fila.gap, y: e.y + Math.sin(a) * i * c.fila.gap, radius: c.fila.radius, delay: c.fila.warnS, damage: c.fila.damage, color: '#ffb84d' });
    }
    terminarAtaque(e, c.fila.warnS + 0.3);
  } else {
    // Obstáculos de acampamento: abacaxis-bola entram em campo.
    for (let i = 0; i < c.obstaculos.count; i++) spawnEnemy(world, comum('abacaxi'), e.x + (i - 0.5) * 30, e.y + 18);
    terminarAtaque(e, 1.2);
  }
}

// ---------------------------------------------------------------------------------------------
// FASE 7: Tiago W (falso chefe final)

/** Embaralha as opções de conselho do Lucas (o útil não fica sempre na mesma posição). */
export function conselhosEmbaralhados(world: World): typeof ADVICE_OPTIONS[number][] {
  const lista = [...ADVICE_OPTIONS];
  for (let i = lista.length - 1; i > 0; i--) {
    const j = world.rng.int(0, i);
    [lista[i], lista[j]] = [lista[j]!, lista[i]!];
  }
  return lista;
}

/** Fase do Tiago W pela vida: 0 piadas, 1 carimbo de conhecimento, 2 chegada do Lucas. */
export function faseDoTiagoW(frac: number): 0 | 1 | 2 {
  if (frac > TIAGOW_CFG.phase1Below) return 0;
  if (frac > TIAGOW_CFG.phase2Below) return 1;
  return 2;
}

function tiagow(world: World, e: Enemy, alvo: Player, vel: number, frac: number): void {
  const c = TIAGOW_CFG;
  const fase = faseDoTiagoW(frac);
  // Aprende: resistência cresce com o tempo, até o teto.
  e.resist = Math.min(c.resistencia.max, Math.floor(world.tick * STEP_S / c.resistencia.everyS) * c.resistencia.step);

  if (fase > e.aiDir) {
    e.aiDir = fase;
    if (fase === 1) {
      pushMessage(world, 'Tiago W', 'Eu sei tudo sobre vocês. Vai ser rápido.', 4);
    } else {
      world.lucasVisible = true;
      pushMessage(world, 'Lucas', LUCAS_LINHA_FINAL, 5);
      // Lucas oferece três conselhos: o jogo pausa até alguém escolher.
      world.advice = { options: conselhosEmbaralhados(world) };
    }
  }
  if (descansando(e, fase === 2 ? c.fase3Cooldown : c.cooldown)) return;
  if (!prontoParaAtacar(e, alvo, vel)) return;
  e.aiCount++;
  if (e.aiCount % c.provocacao.every === 0) {
    const piadas = ['Ih, perdeu o jeito?', 'Já li esse livro.', 'Essa eu esperava.', 'Isso foi uma tentativa?'];
    pushMessage(world, 'Tiago W', piadas[world.rng.int(0, piadas.length - 1)]!, 2.5);
    for (const p of world.players) if (p.hp > 0) p.confusedLeft = Math.max(p.confusedLeft, c.provocacao.confusaoS);
  } else if (fase >= 1 && e.aiCount % 2 === 0) {
    for (const p of vivos(world)) {
      spawnHazard(world, { x: p.x, y: p.y, radius: c.carimbo.radius, delay: c.carimbo.warnS, damage: c.carimbo.damage, color: '#c0392b' });
    }
  } else {
    leque(world, e, alvo, 'formulario', c.tiros.count, c.tiros.spreadDeg, c.tiros.speed, c.tiros.damage);
  }
  terminarAtaque(e, c.tiros.warnS);
}

// ---------------------------------------------------------------------------------------------
// EXTRA: O Próprio Tempo

function tempo(world: World, e: Enemy, alvo: Player, vel: number): void {
  const c = TEMPO_CFG;
  // Vínculo: com os jogadores juntos, o Tempo desacelera (cooldowns mais longos).
  const v = vivos(world);
  let juntos = v.length > 1;
  for (let i = 0; i < v.length && juntos; i++) {
    for (let j = i + 1; j < v.length; j++) {
      if (Math.hypot(v[i]!.x - v[j]!.x, v[i]!.y - v[j]!.y) > c.vinculoPx) {
        juntos = false;
        break;
      }
    }
  }
  e.aiY = juntos ? 1 : 0; // o desenho do Tempo muda quando o vínculo o desacelera
  const cooldown = juntos ? c.cooldown * c.vinculoSlow : c.cooldown;
  if (descansando(e, cooldown)) return;
  if (!prontoParaAtacar(e, alvo, vel * (juntos ? 0.5 : 1))) return;
  e.aiCount++;
  if (e.aiCount % 2 === 1) {
    // Ponteiro: varredura de perigos ao longo de um raio que gira a cada ataque.
    const base = e.aiCount * 0.9;
    for (let i = 1; i <= c.ponteiro.steps; i++) {
      spawnHazard(world, { x: e.x + Math.cos(base) * i * c.ponteiro.stepDist, y: e.y + Math.sin(base) * i * c.ponteiro.stepDist, radius: c.ponteiro.radius, delay: c.ponteiro.warnS + i * c.ponteiro.stepGap, damage: c.ponteiro.damage, color: '#e8e2c8', sprite: 'ponteiro' });
      spawnHazard(world, { x: e.x - Math.cos(base) * i * c.ponteiro.stepDist, y: e.y - Math.sin(base) * i * c.ponteiro.stepDist, radius: c.ponteiro.radius, delay: c.ponteiro.warnS + i * c.ponteiro.stepGap, damage: c.ponteiro.damage, color: '#e8e2c8', sprite: 'ponteiro' });
    }
    terminarAtaque(e, c.ponteiro.warnS + c.ponteiro.steps * c.ponteiro.stepGap + 0.3);
  } else {
    // Folhas de calendário caindo.
    for (let i = 0; i < c.folhas.count; i++) {
      const p = pertoDeJogador(world, c.folhas.scatter);
      spawnHazard(world, { x: p.x, y: p.y, radius: c.folhas.radius, delay: c.folhas.warnS, life: c.folhas.lifeS, damage: c.folhas.impact, dps: c.folhas.dps, color: '#d8c9a0', sprite: 'folha' });
    }
    terminarAtaque(e, c.folhas.warnS + 0.4);
  }
}

/** Atualiza um chefe: movimento lento e ataques telegrafados. */
export function updateBoss(world: World, e: Enemy, alvo: Player, vel: number): void {
  const maxHp = e.aiX || e.hp;
  const frac = e.hp / maxHp;
  const alvoReal = maisProximoVivo(world, e.x, e.y) ?? alvo;
  switch (e.def.id) {
    case 'salsichas':
      atualizarSalsichas(world, e, alvoReal, vel, frac);
      break;
    case 'juninho':
      juninho(world, e, alvoReal, vel, frac);
      break;
    case 'rm':
      rm(world, e, alvoReal, vel);
      break;
    case 'christopher':
      christopher(world, e, alvoReal, vel, frac);
      break;
    case 'ale':
      ale(world, e, alvoReal, vel);
      break;
    case 'tiagow':
      tiagow(world, e, alvoReal, vel, frac);
      break;
    case 'tempo':
      tempo(world, e, alvoReal, vel);
      break;
    default:
      break;
  }
}

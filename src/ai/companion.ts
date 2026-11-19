// Companheiro IA do Modo Solo (GDD A.4). É só uma fonte de entrada: devolve um PlayerInput a cada passo,
// exatamente como um teclado, e a simulação nem sabe que é uma IA.
//
// Prioridades, da mais alta para a mais baixa:
// 1. Sair de áreas telegrafadas.
// 2. Reviver o aliado caído (vai até ele, onde estiver, e fica ao lado até levantá-lo).
// 3. Se estiver longe demais do jogador, voltar correndo.
// 4. Comida (quando machucado), veículo próprio e gemas de XP por perto.
// 5. Combate, de acordo com o papel do kit:
//    - corpo a corpo (Thaisa, Melissa): entra no alcance da arma, recua quando está com pouca vida;
//    - distância (Felipe, Mauro): mantém a distância ideal e foge de quem encosta;
//    - suporte (Thayssa): fica colada no jogador para mantê-lo dentro da aura.
// Os ataques são automáticos, então a IA só usa a tecla de ação onde ela muda o resultado:
// troca de instrumento (Felipe), investida (Melissa) e troca de modo da aura (Thayssa).

import { chooseCard, rerollChoice } from '../combat/leveling';
import type { CardDef } from '../combat/cardTypes';
import { alcanceDoFlorete } from '../characters/melissa';
import { alcanceDoGolpe } from '../characters/thaisaState';
import { raioDaAura } from '../characters/thayssaState';
import { STEP_S } from '../data/balance';
import type { CharacterId } from '../data/characters';
import { NO_INPUT, type InputSource, type PlayerInput } from '../engine/input';
import type { World } from '../engine/world';
import type { Enemy } from '../entities/enemy';
import type { Player } from '../entities/player';
import { encantadaAtual } from '../combat/bosses';
import { RM_CFG } from '../data/bosses';
import { ultimateDisponivel } from '../synergy';

const TILE = 16;
export const FOLLOW_PX = 4 * TILE;
export const RUN_PX = 8 * TILE;
export const GEM_PX = 5 * TILE;
const FOOD_PX = 6 * TILE;
/** Intervalo mínimo entre dois toques na tecla de ação (evita ficar trocando de instrumento/modo sem parar). */
const TAP_MIN_TICKS = Math.round(0.6 / STEP_S);

type Papel = 'corpo' | 'distancia' | 'suporte';

interface Perfil {
  readonly papel: Papel;
  /** Quanto gosta de ficar à frente (+) ou atrás (-) do jogador quando há inimigos, em pixels. */
  readonly postura: number;
}

const PERFIS: Readonly<Record<CharacterId, Perfil>> = {
  felipe: { papel: 'distancia', postura: 0 },
  mauro: { papel: 'distancia', postura: -18 },
  melissa: { papel: 'corpo', postura: 30 },
  thaisa: { papel: 'corpo', postura: 44 },
  thayssa: { papel: 'suporte', postura: -26 },
};

interface Vec {
  x: number;
  y: number;
}

/** Memória curta da IA entre um passo e outro (só para não repetir toques na tecla de ação). */
export interface Memoria {
  ultimoToque: number;
  /** Kite do transe do RM: 0 = encostado (janela segura), 1 = fugindo, 2 = entrando para tomar o golpe e encostar. */
  kiteFase: number;
  /** Passo em que a fuga do kite acaba. */
  kiteAte: number;
}

export function novaMemoria(): Memoria {
  return { ultimoToque: -9999, kiteFase: 2, kiteAte: 0 };
}

const ZERO: Vec = { x: 0, y: 0 };

function para(de: Vec, alvo: Vec, folga = 0): Vec {
  const dx = alvo.x - de.x;
  const dy = alvo.y - de.y;
  const d = Math.hypot(dx, dy);
  if (d <= folga || d === 0) return ZERO;
  return { x: dx / d, y: dy / d };
}

function normalizar(v: Vec): Vec {
  const len = Math.hypot(v.x, v.y);
  return len === 0 ? ZERO : { x: v.x / len, y: v.y / len };
}

function inimigoMaisPerto(world: World, de: Vec, alcance: number, lider?: Vec): Enemy | null {
  let melhor: Enemy | null = null;
  let d2 = alcance * alcance;
  for (const e of world.enemies.active) {
    if (!e.alive || e.untargetable) continue;
    const dx = e.x - de.x;
    const dy = e.y - de.y;
    const q = dx * dx + dy * dy;
    if (q >= d2) continue;
    // Não se afasta demais do jogador para perseguir um inimigo.
    if (lider && Math.hypot(e.x - lider.x, e.y - lider.y) > RUN_PX) continue;
    d2 = q;
    melhor = e;
  }
  return melhor;
}

function contarPerto(world: World, de: Vec, raio: number): number {
  let n = 0;
  const r2 = raio * raio;
  for (const e of world.enemies.active) {
    if (!e.alive || e.untargetable) continue;
    const dx = e.x - de.x;
    const dy = e.y - de.y;
    if (dx * dx + dy * dy <= r2) n++;
  }
  return n;
}

/** Afasta de todos os inimigos dentro do raio (mais forte quanto mais perto). */
function repulsao(world: World, de: Vec, raio: number): Vec {
  let fx = 0;
  let fy = 0;
  for (const e of world.enemies.active) {
    if (!e.alive || e.untargetable) continue;
    const dx = de.x - e.x;
    const dy = de.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d >= raio) continue;
    const peso = (raio - d) / raio + 0.2;
    fx += (d === 0 ? 1 : dx / d) * peso;
    fy += (d === 0 ? 0 : dy / d) * peso;
  }
  return normalizar({ x: fx, y: fy });
}

/** Direção para sair das áreas telegrafadas (ou prestes a causar dano). Zero se está seguro. */
export function desvioDePerigos(world: World, p: Vec): Vec {
  let fx = 0;
  let fy = 0;
  for (const h of world.hazards.active) {
    if (h.kind === 'circle') {
      const margem = h.radius + 10;
      const dx = p.x - h.x;
      const dy = p.y - h.y;
      const d = Math.hypot(dx, dy);
      if (d < margem) {
        const peso = (margem - d) / margem + 0.3;
        fx += (d === 0 ? 1 : dx / d) * peso;
        fy += (d === 0 ? 0 : dy / d) * peso;
      }
    } else {
      // Anel: foge para dentro ou para fora, o que estiver mais perto da borda atual.
      const dx = p.x - h.x;
      const dy = p.y - h.y;
      const d = Math.hypot(dx, dy);
      if (Math.abs(d - h.radius) < h.thickness + 12) {
        const sinal = d > h.radius ? 1 : -1;
        fx += (d === 0 ? 1 : dx / d) * sinal;
        fy += (d === 0 ? 0 : dy / d) * sinal;
      }
    }
  }
  const len = Math.hypot(fx, fy);
  return len === 0 ? { x: 0, y: 0 } : { x: fx / len, y: fy / len };
}

/** Gema de XP mais próxima dentro de 5 tiles (e sem afastar demais do jogador). */
function gemaPerto(world: World, p: Vec, lider: Vec): Vec | null {
  let melhor: Vec | null = null;
  let d2 = GEM_PX * GEM_PX;
  for (const g of world.gems.active) {
    const dx = g.x - p.x;
    const dy = g.y - p.y;
    const q = dx * dx + dy * dy;
    if (q >= d2) continue;
    if (Math.hypot(g.x - lider.x, g.y - lider.y) > RUN_PX) continue; // não se afasta demais do jogador
    d2 = q;
    melhor = g;
  }
  return melhor;
}

/** Comida no chão perto, para quando está machucado. */
function comidaPerto(world: World, p: Vec, lider: Vec): Vec | null {
  let melhor: Vec | null = null;
  let d2 = FOOD_PX * FOOD_PX;
  for (const f of world.foods.active) {
    if (!f.alive) continue;
    const dx = f.x - p.x;
    const dy = f.y - p.y;
    const q = dx * dx + dy * dy;
    if (q >= d2) continue;
    if (Math.hypot(f.x - lider.x, f.y - lider.y) > RUN_PX * 1.2) continue;
    d2 = q;
    melhor = f;
  }
  return melhor;
}

/** Veiculo do proprio companheiro esperando no chao, perto dele e sem afastar demais do jogador. */
function veiculoPerto(world: World, self: Player, lider: Vec): Vec | null {
  const v = world.vehiclePickups.find((x) => x.slot === self.slot);
  if (!v) return null;
  if (Math.hypot(v.x - self.x, v.y - self.y) > GEM_PX * 1.6) return null;
  if (Math.hypot(v.x - lider.x, v.y - lider.y) > RUN_PX) return null;
  return v;
}

/** Aliado caído mais perto (para ir levantar). Vale a corrida em qualquer distância: sozinho ninguém levanta. */
function caidoPerto(world: World, self: Player): Player | null {
  let melhor: Player | null = null;
  let d2 = Infinity;
  for (const q of world.players) {
    if (q === self || q.hp > 0) continue;
    const dx = q.x - self.x;
    const dy = q.y - self.y;
    const dist = dx * dx + dy * dy;
    if (dist < d2) {
      d2 = dist;
      melhor = q;
    }
  }
  return melhor;
}

/** Distância em que o personagem quer ficar do inimigo mais próximo. */
function distanciaIdeal(self: Player): number {
  const k = self.kit;
  switch (k?.type) {
    case 'felipe':
      if (k.active === 'bateria') return 34;
      if (k.active === 'flauta') return 60;
      return 105;
    case 'mauro':
      return 120;
    case 'melissa':
      return alcanceDoFlorete(k) * 0.55;
    case 'thaisa':
      return alcanceDoGolpe(k) * 0.65;
    default:
      return 40;
  }
}

/** Fração de vida do jogador. */
function vidaDe(p: Player): number {
  return p.maxHp > 0 ? p.hp / p.maxHp : 1;
}

/** O aliado vivo mais machucado (incluindo o próprio). */
function menorVidaDoTime(world: World, self: Player, de: Vec, raio: number): number {
  let menor = vidaDe(self);
  for (const q of world.players) {
    if (q === self || q.hp <= 0) continue;
    if (Math.hypot(q.x - de.x, q.y - de.y) > raio) continue;
    menor = Math.min(menor, vidaDe(q));
  }
  return menor;
}

interface Acao {
  /** Quer tocar a tecla de ação neste passo. */
  tocar: boolean;
  /** Direção de movimento a usar (a investida da Melissa segue o movimento do toque). */
  mover?: Vec;
}

/**
 * Decide se vale tocar na tecla de ação, de acordo com o kit.
 * `caido` é o aliado a levantar, se houver.
 */
function decidirAcao(world: World, self: Player, lider: Player, caido: Player | null): Acao {
  const k = self.kit;
  if (!k) return { tocar: false };
  const hp = vidaDe(self);

  if (k.type === 'thayssa') {
    if (k.transitionLeft > 0 || k.sinceSwitch < 3) return { tocar: false };
    const raio = raioDaAura(k) * 1.3;
    // Sobrecarga (-25% de dano e regeneração) quando alguém do time está machucado ou a coisa está cheia;
    // Euforia (+20% de velocidade de ataque e pulso de dano) quando tudo vai bem.
    const apertado = menorVidaDoTime(world, self, self, raio) < 0.5 || contarPerto(world, self, raio + 30) >= 5;
    const folgado = menorVidaDoTime(world, self, self, raio) > 0.75 && contarPerto(world, self, raio + 30) <= 3;
    if (k.mode === 'euforia' && apertado) return { tocar: true };
    if (k.mode === 'sobrecarga' && folgado) return { tocar: true };
    return { tocar: false };
  }

  if (k.type === 'felipe') {
    if (k.tuneLeft > 0) return { tocar: false };
    let quer: 'violao' | 'bateria' | 'flauta' = 'violao';
    const machucado = menorVidaDoTime(world, self, self, 84) < 0.55;
    const nearby = contarPerto(world, self, 60);
    if (machucado && k.ammo.flauta >= 3) quer = 'flauta';
    else if (nearby >= 3 && k.ammo.bateria >= 2) quer = 'bateria';
    else if (nearby >= 2 && hp < 0.5 && k.ammo.bateria >= 2) quer = 'bateria';
    // O Violão é o padrão; se estiver sem munição, deixa a troca automática escolher.
    if (quer === 'violao' && k.ammo.violao < 8) return { tocar: false };
    if (k.active === quer || !k.owned.includes(quer)) return { tocar: false };
    return { tocar: true };
  }

  if (k.type === 'melissa') {
    if (!k.mods.investida || k.dashLeft > 0 || (k.dashCd > 0 && !k.bisReady)) return { tocar: false };
    // 1) Chegar rápido a um aliado caído.
    if (caido) {
      const d = Math.hypot(caido.x - self.x, caido.y - self.y);
      if (d > 90) return { tocar: true, mover: para(self, caido) };
    }
    const alvo = inimigoMaisPerto(world, self, 90);
    // 2) Sair do aperto: pouca vida e inimigos colados, avança em direção ao jogador (ou para longe deles).
    if (hp < 0.4 && alvo && contarPerto(world, self, 40) >= 2) {
      const fuga = lider.hp > 0 && Math.hypot(lider.x - self.x, lider.y - self.y) > 30 ? para(self, lider) : repulsao(world, self, 60);
      if (fuga.x !== 0 || fuga.y !== 0) return { tocar: true, mover: fuga };
    }
    // 3) Atacar: o avanço corta tudo no caminho, então vale contra grupos.
    if (alvo && hp >= 0.4) {
      const d = Math.hypot(alvo.x - self.x, alvo.y - self.y);
      if (d > 24 && d < 62 && contarPerto(world, alvo, 40) >= 2) return { tocar: true, mover: para(self, alvo) };
    }
    return { tocar: false };
  }

  return { tocar: false };
}

/** Escolhe o movimento do combate / acompanhamento. */
function movimentoDeCombate(world: World, self: Player, lider: Player, perfil: Perfil): Vec {
  const hp = vidaDe(self);
  const ref: Vec = lider.hp > 0 ? lider : self;
  const inim = inimigoMaisPerto(world, self, 190, lider.hp > 0 ? lider : undefined);

  if (perfil.papel === 'corpo') {
    if (inim && hp > 0.35) {
      // Entra no alcance da arma. Thaisa é a tanque: pode ir um pouco mais longe do jogador.
      const dist = Math.hypot(inim.x - self.x, inim.y - self.y);
      const ideal = distanciaIdeal(self) + (inim.def?.radius ?? 6);
      if (dist > ideal) return para(self, inim, ideal);
      return ZERO; // já está batendo: não precisa andar
    }
    if (inim && hp <= 0.35) {
      // Pouca vida: volta para perto do jogador, longe dos inimigos.
      const volta = para(self, ref, 20);
      const longe = repulsao(world, self, 70);
      return normalizar({ x: volta.x + longe.x * 1.2, y: volta.y + longe.y * 1.2 });
    }
  }

  if (perfil.papel === 'distancia') {
    if (inim) {
      const dist = Math.hypot(inim.x - self.x, inim.y - self.y);
      const ideal = distanciaIdeal(self);
      const baixa = hp < 0.4 ? 1.3 : 1;
      if (dist < ideal * 0.6 * baixa) {
        // Está colado: afasta, puxando levemente para o lado do jogador para não se isolar.
        const longe = repulsao(world, self, ideal * 0.9);
        const volta = para(self, ref, 30);
        return normalizar({ x: longe.x * 1.4 + volta.x * 0.4, y: longe.y * 1.4 + volta.y * 0.4 });
      }
      if (dist > ideal * 1.35) {
        // Longe demais para atacar (ou para a bateria): chega até a distância ideal, sem passar do jogador.
        return para(self, inim, ideal);
      }
      // Na distância boa: fica por perto do jogador, sem se mexer à toa.
      return para(self, ref, FOLLOW_PX * 0.7);
    }
  }

  // Suporte, ou sem inimigo por perto: fica com o jogador, com a postura do personagem.
  let alvo: Vec = ref;
  if (perfil.postura !== 0) {
    const nl = inimigoMaisPerto(world, lider.hp > 0 ? lider : self, 200);
    if (nl) {
      const dir = para(ref, nl);
      alvo = { x: ref.x + dir.x * perfil.postura, y: ref.y + dir.y * perfil.postura };
    }
  }
  let folga = perfil.postura > 0 ? 8 : perfil.postura < 0 ? 10 : FOLLOW_PX * 0.6;
  // A Thayssa precisa manter o jogador dentro da aura.
  if (self.kit?.type === 'thayssa') folga = Math.max(6, Math.min(FOLLOW_PX * 0.6, raioDaAura(self.kit) * 0.45));
  const v = para(self, alvo, folga);
  if (perfil.papel === 'suporte') {
    // Não deixa os inimigos encostarem enquanto acompanha.
    const longe = repulsao(world, self, 26);
    if (longe.x !== 0 || longe.y !== 0) return normalizar({ x: v.x + longe.x * 0.8, y: v.y + longe.y * 0.8 });
  }
  return v;
}

/** Segundos de fuga entre uma janela de contato e a próxima entrada. */
const KITE_FUGA_S = 0.9;
/** Distância do RM a partir da qual a IA começa a encostar na Melissa encantada. */
const KITE_LONGE_DO_RM_PX = 130;

/**
 * Transe da Melissa: em vez de ficar colada nela (o que a mantinha parada do lado do RM), a IA faz kite.
 * - Thayssa: fica na faixa da aura (55 a 80 px), sempre se mexendo em volta; nunca precisa encostar nem toma golpe.
 * - Os outros: primeiro a IA foge para puxar a Melissa para longe do RM (ela persegue o aliado mais próximo). Depois, o golpe dela tem recarga. Logo depois de ela bater (janela segura) a IA encosta e gira em volta dela, o que
 *   esvazia a barra; quando a recarga está acabando, foge por um instante, puxando-a para longe do RM, e depois volta a entrar.
 */
function kiteDoTransePara(world: World, self: Player, enc: Player, mem: Memoria): Vec {
  const dx = enc.x - self.x;
  const dy = enc.y - self.y;
  const d = Math.hypot(dx, dy) || 1;
  const para_ = { x: dx / d, y: dy / d };
  const tangente = { x: -para_.y, y: para_.x };
  const rm = world.enemies.active.find((e) => e.alive && e.def.id === 'rm');
  const longeDoRm = rm ? normalizar({ x: self.x - rm.x, y: self.y - rm.y }) : ZERO;
  /** Foge dela, curvando e puxando-a para longe do RM. */
  const fugir = (): Vec => normalizar({ x: -para_.x + tangente.x * 0.6 + longeDoRm.x * 0.5, y: -para_.y + tangente.y * 0.6 + longeDoRm.y * 0.5 });

  if (self.kit?.type === 'thayssa') {
    const perto = Math.min(RM_CFG.trance.thayssaRadius, 90) * 0.6;
    const longe = Math.min(RM_CFG.trance.thayssaRadius, 90) * 0.88;
    if (d < perto) return fugir();
    if (d > longe) return normalizar({ x: para_.x + tangente.x * 0.3, y: para_.y + tangente.y * 0.3 });
    return tangente;
  }

  const janelaSegura = enc.weaponCd > 0.25;
  if (janelaSegura) {
    mem.kiteFase = 0;
    // Encostada e girando em volta dela: a barra esvazia e o golpe ainda está recarregando.
    const radial = Math.max(-1, Math.min(1, (d - 14) / 10));
    return normalizar({ x: para_.x * radial + tangente.x * 0.9, y: para_.y * radial + tangente.y * 0.9 });
  }
  // Primeiro leva a Melissa para longe do RM (ela persegue o aliado mais próximo): fugir antes de começar os contatos.
  if (rm && Math.hypot(enc.x - rm.x, enc.y - rm.y) < KITE_LONGE_DO_RM_PX) return fugir();
  if (mem.kiteFase === 0) {
    // A janela acabou: foge um instante.
    mem.kiteFase = 1;
    mem.kiteAte = world.tick + Math.round(KITE_FUGA_S / STEP_S);
  }
  if (mem.kiteFase === 1) {
    if (world.tick < mem.kiteAte) return fugir();
    mem.kiteFase = 2;
  }
  // Entra para tomar o golpe e voltar a encostar.
  return para_;
}

/** Decide a entrada do companheiro `self` seguindo o jogador `lider`. */
export function decidir(world: World, self: Player, lider: Player, mem: Memoria = novaMemoria()): PlayerInput {
  if (self.hp <= 0) return NO_INPUT;

  // Ultimate de dupla pronta e o jogador no alcance.
  const quer = lider.hp > 0 && ultimateDisponivel(world, self) !== null;
  const perfil = PERFIS[self.characterId] ?? { papel: 'distancia', postura: 0 };

  const saida = (v: Vec, caido: Player | null = null): PlayerInput => {
    const a = decidirAcao(world, self, lider, caido);
    const pode = world.tick - mem.ultimoToque >= TAP_MIN_TICKS;
    const toca = a.tocar && pode;
    if (toca) mem.ultimoToque = world.tick;
    const m = toca && a.mover ? a.mover : v;
    return { moveX: m.x, moveY: m.y, action: toca, ultimate: quer };
  };

  // 1) Perigo no chão: sair dele vale mais que tudo.
  const fuga = desvioDePerigos(world, self);
  if (fuga.x !== 0 || fuga.y !== 0) return saida(fuga);

  // 2) Aliado caído: vai até ele (em qualquer distância) e fica ao lado até levantá-lo.
  const caido = caidoPerto(world, self);
  if (caido) return saida(para(self, caido, 6), caido);

  const distLider = Math.hypot(lider.x - self.x, lider.y - self.y);

  // 2b) Luta do RM: ajuda a quebrar o transe da Melissa. Encostar nela esvazia a barra (cada aliado encostado ajuda), a Thayssa
  // precisa ficar dentro da aura e a Ultimate "Pausa Dramática" também quebra. A IA só age depois de ela ser pega: segurá-la contra o
  // feixe é coisa de jogador (a IA segurando para sempre impedia o transe de acontecer).
  const enc = world.trance?.caught ? encantadaAtual(world) : undefined;
  if (enc && enc !== self && vidaDe(self) > 0.25) return saida(kiteDoTransePara(world, self, enc, mem));

  // 3) Longe demais: corre para perto, sem parar para nada.
  if (distLider > RUN_PX) return saida(para(self, lider));

  // 4) Machucado: comida por perto.
  if (vidaDe(self) < 0.65) {
    const comida = comidaPerto(world, self, lider);
    if (comida) return saida(para(self, comida));
  }

  // 4b) Veiculo proprio no chao (monta para ganhar velocidade e buff).
  const veiculo = veiculoPerto(world, self, lider);
  if (veiculo) return saida(para(self, veiculo));

  // 4c) Gemas de XP por perto (ranged e suporte não correm para dentro de uma briga só por isso).
  const gema = gemaPerto(world, self, lider);
  if (gema && (perfil.papel === 'corpo' || contarPerto(world, self, 40) === 0)) return saida(para(self, gema));

  // 5) Posição de combate.
  return saida(movimentoDeCombate(world, self, lider, perfil));
}

/** Fonte de entrada do companheiro. `getWorld` devolve o mundo atual (muda ao recomeçar a partida). */
export class CompanionInput implements InputSource {
  private readonly mem = novaMemoria();

  constructor(
    private readonly getWorld: () => World,
    private readonly slot: number,
    private readonly leaderSlot = 0,
  ) {}

  poll(): PlayerInput {
    const w = this.getWorld();
    const self = w.players[this.slot];
    const lider = w.players[this.leaderSlot];
    if (!self || !lider) return NO_INPUT;
    if (w.tick < this.mem.ultimoToque) this.mem.ultimoToque = -9999; // partida reiniciada
    return decidir(w, self, lider, this.mem);
  }
}

// ---------------------------------------------------------------------------------------------
// Cartas
// ---------------------------------------------------------------------------------------------

const PESO_RARIDADE: Readonly<Record<string, number>> = { comum: 1, rara: 2, epica: 3.2, lendaria: 4 };

/** Quanto cada carta ajuda o kit quando jogado pela IA (o resto fica em 0). */
const VALOR_CARTA: Readonly<Record<string, number>> = {
  // Felipe
  'felipe-requiem': 4, // levanta quem cai
  'felipe-viola': 2,
  'felipe-pedal': 2.5,
  'felipe-turne': 2.5,
  'felipe-encore': 2.5,
  'felipe-roadie': 2,
  'felipe-ensaio': 1.5,
  'felipe-microfone': 1.5,
  'felipe-solo': 1,
  'felipe-afinacao': 1.5,
  'felipe-fa-clube': 1.5,
  'felipe-bis': 1.5,
  'felipe-camarim': 1,
  'felipe-passagem': 1,
  // Mauro
  'mauro-sobrecarga': 3,
  'mauro-orbita': 3,
  'mauro-pe-de-pagina': 2,
  'mauro-referencia': 2.5,
  'mauro-mestre': 2.5,
  'mauro-nota-dupla': 2.5,
  'mauro-enciclopedia': 2,
  'mauro-edicao': 2,
  'mauro-leitura-dinamica': 1.5,
  'mauro-fichamento': 1.5,
  'mauro-rodape': 1.5,
  'mauro-indice': 1,
  'mauro-biblio': 1,
  'mauro-postit': 1,
  'mauro-sala': -1, // exige ficar parado
  // Melissa
  'melissa-investida': 5, // abre a investida e as cartas que dependem dela
  'melissa-extra': 3,
  'melissa-bastidores': 3,
  'melissa-lightstick': 2.5,
  'melissa-protagonista': 2.5,
  'melissa-show': 2.5,
  'melissa-rotina': 2,
  'melissa-autografo': 2,
  'melissa-bis': 2,
  'melissa-closeup': 1.5,
  'melissa-camera': 1.5,
  'melissa-ensaio': 1.5,
  'melissa-passo': 1.5,
  'melissa-fancam': 1.5,
  'melissa-fandom': 1,
  'melissa-afterparty': 1,
  // Thaisa
  'thaisa-fortaleza': 3.5,
  'thaisa-rodizio': 3,
  'thaisa-costela': 3,
  'thaisa-bufe': 3,
  'thaisa-sismica': 2.5,
  'thaisa-cardapio': 2.5,
  'thaisa-pe-firme': 2,
  'thaisa-repeteco': 2,
  'thaisa-grave': 1.5,
  'thaisa-afinacao': 1.5,
  'thaisa-sopa': 1.5,
  'thaisa-colher': 1.5,
  'thaisa-marmita': 1.5,
  'thaisa-segunda': 1,
  'thaisa-arco': 1,
  // Thayssa
  'thayssa-ressonancia': 3,
  'thayssa-abraco': 3,
  'thayssa-ultimo': 3,
  'thayssa-coracao-grande': 3,
  'thayssa-sincronia': 2.5,
  'thayssa-lagrima-doce': 2.5,
  'thayssa-abraco-apertado': 2.5,
  'thayssa-pe-no-chao': 2,
  'thayssa-drop': 2,
  'thayssa-playlist': 2,
  'thayssa-cadeia': 2,
  'thayssa-metronomo': 2,
  'thayssa-palmas': 2,
  'thayssa-gargalhada': 1,
  'thayssa-entrega': 1,
  'thayssa-danca': -1, // pede cinco trocas seguidas
  // Cartas de equipe que protegem o jogador
  'team-thaisa-muro': 2,
  'team-thaisa-retaguarda': 2,
  'team-thayssa-escudo': 1.5,
  'team-melissa-cobertura': 1.5,
  'team-thayssa-abraco': 1.5,
  // Compartilhadas
  'shared-fogos': 3,
  'shared-cafe-requentado': 3,
  'shared-pipoca': 2,
  'shared-panela': 2,
  'shared-mangueira': 2,
  'shared-roteador': 1.5,
};

/** Cartas defensivas valem mais quando a IA está sofrendo. */
const DEFENSIVAS: ReadonlySet<string> = new Set([
  'shared-almofada',
  'shared-plano-saude',
  'shared-soro',
  'shared-pao-alho',
  'shared-capa-espinhos',
  'shared-abraco-urso',
  'shared-guarda-chuva',
  'shared-noite-dormida',
  'shared-tenis',
]);

/** Nota de uma carta para este jogador: raridade + utilidade para o kit + bônus por subir de nível. */
export function pontuarCarta(self: Player, card: CardDef, nivel = 1): number {
  let nota = PESO_RARIDADE[String(card.rarity)] ?? 1;
  nota += VALOR_CARTA[card.id] ?? 0;
  if (DEFENSIVAS.has(card.id)) nota += vidaDe(self) < 0.6 ? 1.5 : 0.8;
  if (card.kind === 'weapon') nota += 1; // armas do pool atacam sozinhas
  if (card.kind === 'team') nota += 0.4; // o jogador também se beneficia
  if (nivel > 1) nota += 0.6; // reforçar uma carta que já tem
  return nota;
}

/** Escolhe sozinho as cartas dos jogadores controlados pela IA (a primeira da fila é a que bloqueia o jogo). */
export function escolherCartasDaIA(world: World, slotsIA: readonly number[]): void {
  const c = world.choices[0];
  if (!c || !slotsIA.includes(c.slot)) return;
  const self = world.players[c.slot];
  if (!self) return;
  let melhor = 0;
  let melhorNota = -Infinity;
  c.cards.forEach((card, i) => {
    const nota = pontuarCarta(self, card, c.levels[i] ?? 1);
    if (nota > melhorNota) {
      melhorNota = nota;
      melhor = i;
    }
  });
  // Oferta fraca e ainda sobra reroll: tenta de novo (a próxima chamada avalia a nova oferta).
  if (melhorNota < 2.2 && self.rerolls > 0 && c.level > 1) {
    if (rerollChoice(world, c.slot)) return;
  }
  chooseCard(world, c.slot, melhor);
}

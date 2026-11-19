// Liga o lockstep ao mundo do jogo: aplica comandos, avança cutscenes e transições (que no jogo local andam no
// quadro de tela, aqui andam no passo, senão cada navegador veria um tempo diferente), faz a IA assumir o
// lugar de quem saiu e confere se todos continuam vendo o mesmo jogo (checksum).

import { CompanionInput, escolherCartasDaIA } from '../ai/companion';
import { chooseAdvice } from '../combat/advice';
import { banCard, chooseCard, rerollChoice } from '../combat/leveling';
import { aoFimDaCutscene, pularTransicao, tickTransicao } from '../combat/run';
import { NO_INPUT, type PlayerInput } from '../engine/input';
import { stepWorld, type World } from '../engine/world';
import { skipDialogue } from '../narrative/interactions';
import { interagir, tickCutscene } from '../ui/cutscene';
import { PARK_TICKS, type Lockstep, type NetCmd, type NetStep } from './lockstep';

/** A cada quantos passos os navegadores trocam o checksum (2 s). */
export const HASH_EVERY = 120;
/** Máximo de passos extras para recuperar o tempo perdido numa espera. */
const MAX_CATCHUP = 5;

/** Resumo do estado da simulação. Dois navegadores em sincronia devolvem o mesmo número no mesmo passo. */
export function hashWorld(world: World): number {
  let h = 2166136261;
  const mix = (n: number): void => {
    h = Math.imul(h ^ (Math.round(n * 64) | 0), 16777619) >>> 0;
  };
  mix(world.tick);
  mix(world.rng.peek());
  mix(world.nextUid);
  mix(world.act);
  for (const p of world.players) {
    mix(p.x);
    mix(p.y);
    mix(p.hp);
    mix(p.xp);
    mix(p.level);
  }
  for (const e of world.enemies.active) {
    mix(e.x);
    mix(e.y);
    mix(e.hp);
  }
  mix(world.projectiles.size);
  mix(world.gems.size);
  return h;
}

export interface NetGameOptions {
  /** As cutscenes passam sozinhas (escolha do anfitrião). */
  autoCut: boolean;
  /** Manda o checksum do passo aos outros. */
  sendHash: (tick: number, hash: number) => void;
}

export class NetGame {
  /** Slots que a IA joga (quem saiu da partida). */
  readonly aiSlots: number[] = [];
  autoCut: boolean;
  /** Primeiro passo em que o checksum de alguém divergiu do nosso, ou -1. */
  desyncAt = -1;
  /** Passos que faltam para recuperar o tempo perdido nas esperas. */
  private debt = 0;
  /** Vezes seguidas em que o laço pediu um passo e ele não pôde rodar (para o aviso "esperando"). */
  stalled = 0;
  private readonly ais = new Map<number, CompanionInput>();
  private readonly mine = new Map<number, number>();
  private readonly theirs = new Map<number, { slot: number; h: number }[]>();

  constructor(
    readonly world: World,
    readonly ls: Lockstep,
    private readonly opts: NetGameOptions,
  ) {
    this.autoCut = opts.autoCut;
  }

  /** Um passo do laço de 60 Hz. Roda de 0 a 1 + atraso acumulado passos da simulação. */
  update(): number {
    const want = 1 + this.debt;
    let ran = 0;
    while (ran < want) {
      const st = this.ls.step();
      if (!st) break;
      this.apply(st);
      ran++;
    }
    this.stalled = ran === 0 ? this.stalled + 1 : 0;
    this.debt = Math.min(MAX_CATCHUP, Math.max(0, want - ran));
    this.ls.flush();
    return ran;
  }

  /** Aplica um comando de um jogador (o mesmo código roda em todos os navegadores). */
  private command(slot: number, cmd: NetCmd): void {
    const w = this.world;
    switch (cmd.c) {
      case 'pick':
        chooseCard(w, slot, cmd.i);
        break;
      case 'reroll':
        rerollChoice(w, slot);
        break;
      case 'ban':
        banCard(w, slot, cmd.i);
        break;
      case 'advice':
        chooseAdvice(w, cmd.i);
        break;
      case 'cut':
        if (cmd.k === 'auto') this.autoCut = !this.autoCut;
        else if (w.cutscene) {
          if (cmd.k === 'skip' || interagir(w.cutscene) === 'fim') this.endCutscene();
        }
        break;
      case 'trans':
        pularTransicao(w);
        break;
      case 'dlg':
        skipDialogue(w);
        break;
    }
  }

  private endCutscene(): void {
    this.world.cutscene = null;
    aoFimDaCutscene(this.world);
  }

  private apply(st: NetStep): void {
    const w = this.world;
    for (const { slot, cmd } of st.cmds) this.command(slot, cmd);

    // Cutscene e transição andam por passo (no jogo local, por quadro de tela).
    if (w.cutscene && tickCutscene(w.cutscene, this.autoCut) === 'fim') this.endCutscene();
    if (!w.cutscene && w.transicao) tickTransicao(w);

    // Quem saiu: as cartas dele são escolhidas na hora; o personagem fica parado por 15 s e depois vira IA.
    const inputs: PlayerInput[] = st.inputs.slice();
    this.aiSlots.length = 0;
    for (let s = 0; s < st.gone.length; s++) {
      if (!st.gone[s]) continue;
      if (st.goneFor[s]! >= PARK_TICKS) {
        this.aiSlots.push(s);
        let ai = this.ais.get(s);
        if (!ai) {
          const lider = st.gone.findIndex((g) => !g);
          ai = new CompanionInput(() => this.world, s, lider >= 0 ? lider : 0);
          this.ais.set(s, ai);
        }
        inputs[s] = ai.poll();
      } else inputs[s] = NO_INPUT;
    }
    const gone = st.gone.map((g, s) => (g ? s : -1)).filter((s) => s >= 0);
    if (gone.length > 0) escolherCartasDaIA(w, gone);

    stepWorld(w, inputs);

    if (st.tick % HASH_EVERY === 0) this.checkpoint(st.tick);
  }

  private checkpoint(tick: number): void {
    const h = hashWorld(this.world);
    this.mine.set(tick, h);
    this.opts.sendHash(tick, h);
    const outros = this.theirs.get(tick);
    if (outros) {
      this.theirs.delete(tick);
      for (const o of outros) this.compare(tick, h, o.h);
    }
    this.mine.delete(tick - HASH_EVERY * 8);
  }

  private compare(tick: number, a: number, b: number): void {
    if (a !== b && this.desyncAt < 0) this.desyncAt = tick;
  }

  /** Checksum recebido de outro jogador. */
  receiveHash(slot: number, tick: number, h: number): void {
    const meu = this.mine.get(tick);
    if (meu !== undefined) return this.compare(tick, meu, h);
    // Chegou antes de nós chegarmos nesse passo: guarda para conferir depois.
    const lista = this.theirs.get(tick) ?? [];
    lista.push({ slot, h });
    this.theirs.set(tick, lista);
    if (this.theirs.size > 32) this.theirs.delete(this.theirs.keys().next().value as number);
  }
}

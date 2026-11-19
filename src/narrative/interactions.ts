// Interações locais (GDD A.10): detecta duas pessoas perto de um ponto de interesse e conduz a conversa.
// Faz parte da simulação, então vale igual no solo (com a IA), no co-op local e no online.

import {
  INTERACTION_ENEMY_BLOCK_PX,
  INTERACTION_LINE_SECONDS,
  INTERACTION_PAIR_COOLDOWN_S,
  INTERACTION_TRIGGER_PX,
  POIS,
  todasAsInteracoes,
  type Interaction,
  type Who,
} from '../data/interactions';
import { SAFE_ROOMS } from '../data/safeRooms';
import type { World } from '../engine/world';
import type { Player } from '../entities/player';
import { STEP_S } from '../data/balance';

export interface DialogueLine {
  /** Slot de quem fala. */
  slot: number;
  text: string;
}

export interface Dialogue {
  id: string;
  lines: DialogueLine[];
  index: number;
  /** Segundos que a linha atual já ficou na tela. */
  t: number;
  pairKey: string;
}

export interface InteractionState {
  /** Interações já vistas nesta partida. */
  used: string[];
  /** Segundo da partida em que cada par conversou pela última vez. */
  pairLast: Record<string, number>;
  /** Pode repetir uma interação já vista (opção do jogador). */
  repeat: boolean;
  dialogue: Dialogue | null;
}

export function createInteractionState(repeat = false): InteractionState {
  return { used: [], pairLast: {}, repeat, dialogue: null };
}

/** Quanto tempo a linha fica na tela: curta para frases curtas, mais longa para as compridas. */
export function lineSeconds(text: string): number {
  return Math.min(5, Math.max(2.2, INTERACTION_LINE_SECONDS - 0.6 + text.length * 0.02));
}

const CHECK_EVERY_TICKS = 20;

function pairKey(a: Player, b: Player): string {
  return [a.characterId, b.characterId].sort().join('+');
}

function matches(who: Who, p: Player): boolean {
  return who === 'qualquer' || who === p.characterId;
}

function ehSafeRoom(id: string): boolean {
  return SAFE_ROOMS.some((s) => s.id === id);
}

function perto(a: Player, x: number, y: number, r: number): boolean {
  return Math.hypot(a.x - x, a.y - y) <= r;
}

function inimigoPerto(world: World, ps: readonly Player[]): boolean {
  const r2 = INTERACTION_ENEMY_BLOCK_PX * INTERACTION_ENEMY_BLOCK_PX;
  for (const e of world.enemies.active) {
    if (e.untargetable) continue;
    for (const p of ps) {
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy <= r2) return true;
    }
  }
  return false;
}

interface Candidata {
  inter: Interaction;
  a: Player;
  b: Player;
}

/** Interações que podem disparar agora, no estado atual do mundo. */
export function candidatas(world: World): Candidata[] {
  const st = world.interactions;
  const agora = world.tick * STEP_S;
  const todas = todasAsInteracoes();
  const out: Candidata[] = [];
  for (const poi of POIS) {
    if (!poi.acts.includes(world.act)) continue;
    const presentes = world.players.filter((p) => p.hp > 0 && perto(p, poi.x, poi.y, INTERACTION_TRIGGER_PX));
    if (presentes.length < 2) continue;
    for (let i = 0; i < presentes.length; i++) {
      for (let j = i + 1; j < presentes.length; j++) {
        const p = presentes[i]!;
        const q = presentes[j]!;
        if (Math.hypot(p.x - q.x, p.y - q.y) > INTERACTION_TRIGGER_PX) continue;
        const key = pairKey(p, q);
        const ultima = st.pairLast[key];
        if (ultima !== undefined && agora - ultima < INTERACTION_PAIR_COOLDOWN_S) continue;
        if (inimigoPerto(world, [p, q])) continue;
        for (const inter of todas) {
          if (inter.poi !== poi.id) continue;
          if (inter.a === 'lucas') continue; // o Lucas só entra no epílogo
          // Nas Safe Rooms a conversa vale em qualquer humor (a sala é o lugar de respirar).
          if (!ehSafeRoom(poi.id) && inter.tag !== 'livre' && inter.tag !== world.mood) continue;
          if (!st.repeat && st.used.includes(inter.id)) continue;
          if (matches(inter.a, p) && matches(inter.b, q)) out.push({ inter, a: p, b: q });
          else if (matches(inter.a, q) && matches(inter.b, p)) out.push({ inter, a: q, b: p });
        }
      }
    }
  }
  return out;
}

export function startDialogue(world: World, c: Candidata): void {
  const st = world.interactions;
  st.dialogue = {
    id: c.inter.id,
    lines: c.inter.lines.map((l) => ({ slot: (l.who === 'a' ? c.a : c.b).slot, text: l.text })),
    index: 0,
    t: 0,
    pairKey: pairKey(c.a, c.b),
  };
  if (!st.used.includes(c.inter.id)) st.used.push(c.inter.id);
}

function encerrar(world: World): void {
  const st = world.interactions;
  if (st.dialogue) st.pairLast[st.dialogue.pairKey] = world.tick * STEP_S;
  st.dialogue = null;
}

/** Pula para a próxima linha (ou encerra a conversa). */
export function skipDialogue(world: World): void {
  const d = world.interactions.dialogue;
  if (!d) return;
  d.index++;
  d.t = 0;
  if (d.index >= d.lines.length) encerrar(world);
}

export function updateInteractions(world: World): void {
  const st = world.interactions;
  const d = st.dialogue;
  if (d) {
    const line = d.lines[d.index];
    const quem = line ? world.players[line.slot] : undefined;
    // Se quem fala cai, a conversa acaba.
    if (!line || !quem || quem.hp <= 0) {
      encerrar(world);
      return;
    }
    d.t += STEP_S;
    if (d.t >= lineSeconds(line.text)) skipDialogue(world);
    return;
  }
  if (world.tick % CHECK_EVERY_TICKS !== 0) return;
  const lista = candidatas(world);
  if (lista.length === 0) return;
  startDialogue(world, lista[world.rng.int(0, lista.length - 1)]!);
}
